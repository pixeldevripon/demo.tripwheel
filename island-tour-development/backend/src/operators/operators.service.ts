import { auth } from '@/auth/auth.instance';
import { decrypt, encrypt, maskSecret } from '@/common/utils/crypto.util';
import { defaultTeamDesignationRows } from '@/config/team-designations.config';
import {
  getPortalUrl,
  provisionOrAttachAccount,
  rollbackProvisionOrAttach,
} from '@/common/utils/invite-provisioning.util';
import { dashboardAppBase } from '@/common/utils/app-urls.util';
import { salesRecipient } from '@/common/utils/sales-recipient.util';
import { EmailLogService } from '@/mail/email-log.service';
import { MailService } from '@/mail/mail.service';
import { OnboardingEmailsService } from '@/mail/onboarding-emails.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmailStream,
  EmailTemplateKey,
  OperatorVerificationStatus,
  PaymentProvider,
  Prisma,
  Role,
  StaffSeatRole,
  StaffStatus,
} from '@prisma/client';

import {
  CreateOperatorDto,
  DecideVerificationDto,
  OnboardOperatorDto,
  OperatorQueryDto,
  UpdateOperatorCompanyInfoDto,
  UpdateOperatorDto,
  UpdateOperatorMollieConfigDto,
  UpdateOperatorPaymentProviderDto,
  UpdateOperatorSocialMediaDto,
  UpdateOperatorStripeConfigDto,
} from './dto/operator.dto';

@Injectable()
export class OperatorsService {
  private readonly logger = new Logger(OperatorsService.name);
  private readonly portalUrl = getPortalUrl();

  // Shared projection for operator detail responses - never return raw rows.
  private readonly operatorSelect = {
    id: true,
    userId: true,
    isActive: true,
    verificationStatus: true,
    verificationDecidedAt: true,
    firstTourLiveAt: true,
    contactEmail: true,
    contactPhone: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    totalBookings: true,
    cancellationRate90d: true,
    forceMajeurePardons: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { id: true, name: true, email: true } },
    companyInfo: { select: { companyName: true } },
  } satisfies Prisma.OperatorSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailLog: EmailLogService,
    private readonly onboardingEmails: OnboardingEmailsService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  // ── Shared helpers ─────────────────────────────────────────────────────────

  private async resolveOperator(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator)
      throw new NotFoundException(`Operator ${operatorId} not found`);
    return operator;
  }

  private async ensureExists(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: { id: true },
    });
    if (!operator)
      throw new NotFoundException(`Operator ${operatorId} not found`);
  }

  /**
   * OWNER-only gate: the operator account itself (or an admin). Team seats -
   * even managers - never pass. Use for payout/bank config (Stripe/Mollie),
   * per the login doc's owner-only rule.
   */
  private assertOwnerOrAdmin(
    operator: { userId: string },
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    if (requestingUserRole === Role.ADMIN) return; // admin bypasses ownership
    if (requestingUserRole === Role.USER) {
      throw new ForbiddenException(
        'Traveler accounts are not allowed to manage operator resources',
      );
    }
    if (operator.userId !== requestingUserId) {
      throw new ForbiddenException(
        'You can only access your own operator profile',
      );
    }
  }

  /**
   * Membership gate: the owner account, an admin, or an ACTIVE team seat of
   * THIS operator. Use for profile-level resources (detail, company info,
   * social media) - the PermissionsGuard has already checked the caller's
   * fine-grained permission; this only pins them to their own operator.
   */
  private async assertMemberOrAdmin(
    operator: { id: string; userId: string },
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    if (requestingUserRole === Role.ADMIN) return;
    if (requestingUserRole === Role.USER) {
      throw new ForbiddenException(
        'Traveler accounts are not allowed to manage operator resources',
      );
    }
    if (operator.userId === requestingUserId) return;

    const seat = await this.prisma.staffMember.findUnique({
      where: { userId: requestingUserId },
      select: { operatorId: true, status: true },
    });
    if (
      seat?.operatorId === operator.id &&
      seat.status !== StaffStatus.SUSPENDED
    ) {
      return;
    }
    throw new ForbiddenException(
      'You can only access your own operator profile',
    );
  }

  // ── Core Operator CRUD ─────────────────────────────────────────────────────

  /**
   * Admin-initiated operator creation.
   *
   * Provisions a TOUR_OPERATOR auth account (no password the operator knows),
   * links the Operator profile row, and emails a set-password invite link. The
   * operator follows the link, sets their own password, logs in, and completes
   * onboarding. There is no public sign-up - this is the only operator-creation path.
   */
  async create(dto: CreateOperatorDto) {
    // Same-hat conflicts before touching anything: one operator link per
    // account, and the OWNER seat below needs the unique staff row free.
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        operator: { select: { id: true } },
        staffMember: { select: { operatorId: true } },
      },
    });
    if (existing?.operator) {
      throw new ConflictException(
        `${normalizedEmail} already belongs to an operator account`,
      );
    }
    if (existing?.staffMember) {
      throw new ConflictException(
        existing.staffMember.operatorId
          ? `${normalizedEmail} is already on a team`
          : `${normalizedEmail} is a platform staff member and cannot become an operator`,
      );
    }

    // Shared invite util: user row + throwaway credential for a new email, or
    // attach-and-elevate for an existing customer account (one email, many
    // hats - the person keeps their password and their bookings).
    const provisioned = await provisionOrAttachAccount(this.prisma, {
      email: dto.email,
      name: dto.name,
      role: Role.TOUR_OPERATOR,
    });
    const { email, user, created, hadPassword } = provisioned;

    let operatorId: string | undefined;
    try {
      const operator = await this.prisma.operator.create({
        data: {
          userId: user.id,
          isActive: dto.isActive ?? true,
          contactEmail: email,
          // The onboarding state machine starts at "accepted" = PENDING
          // (EMAIL-IMPLEMENTATION-PLAN §2.4). The schema default stays
          // UNVERIFIED for legacy rows, so the creation path says it out loud.
          verificationStatus: OperatorVerificationStatus.PENDING,
        },
        select: {
          id: true,
          userId: true,
          isActive: true,
          verificationStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      operatorId = operator.id;

      // The operator account IS the team's OWNER seat (login doc Phase 2).
      // Owner seats are never permission-managed; the row makes the seat model
      // uniform for the team dashboard. Cascades away with user/operator on
      // the rollback below.
      await this.prisma.staffMember.create({
        data: {
          userId: user.id,
          operatorId: operator.id,
          seatRole: StaffSeatRole.OWNER,
          status: StaffStatus.ACTIVE,
          activatedAt: new Date(),
        },
        select: { id: true },
      });

      // Every team starts with the default designation templates, so the
      // first invite has real options instead of "grant manually". isSystem
      // semantics: rename/delete blocked, permission sets stay owner-editable.
      // skipDuplicates keeps this safe against the seed backfill racing us.
      await this.prisma.staffDesignation.createMany({
        data: defaultTeamDesignationRows(operator.id),
        skipDuplicates: true,
      });

      if (created || !hadPassword) {
        // Server-initiated reset -> invite branch in auth.instance.ts sends the
        // operator-invite email (set-password link) instead of a reset email.
        // The link must land on the DASHBOARD app's reset screen (/portal/reset,
        // which reads ?token=), not the public site.
        await auth.api.requestPasswordReset({
          body: {
            email,
            redirectTo: `${this.portalUrl}/reset`,
          },
        });
      } else {
        // Existing credentialed account: no set-password link - point them at
        // the portal door. Fire-and-forget; mail must not roll back the hat.
        this.mailService
          .sendHatAddedEmail(email, {
            variant: 'operator',
            loginUrl: this.portalUrl,
            name: dto.name,
          })
          .catch((err) =>
            this.logger.error(
              `Hat-added email failed for ${email}`,
              err instanceof Error ? err.stack : String(err),
            ),
          );
      }

      // Role may have been elevated on attach - drop any cached permission
      // set (documented StaffPermissionsService contract; harmless when the
      // account had no cache entry).
      this.staffPermissions.invalidate(user.id);

      this.logger.log(
        `Operator account ${created ? 'created and invited' : 'attached'}: ${email} (operator ${operator.id})`,
      );

      // INT-1: the sales pipeline hears about every new operator, instantly.
      // Fire-and-forget - a mail outage must never roll back the account.
      this.notifyOperatorSignup(operator.id);

      // OB-2 welcome + agreement to the operator (WP-D, D-08): fires with
      // INT-1 on the wireframe's `accepted` moment. Same contract.
      this.onboardingEmails.sendWelcome(operator.id);

      return operator;
    } catch (err) {
      // Roll back exactly what we created so a failure leaves no orphans.
      if (operatorId) {
        await this.prisma.operator
          .delete({ where: { id: operatorId } })
          .catch(() => undefined);
      }
      // Shared rollback contract: created user deleted outright; attached
      // account only loses the OWNER seat we added + the role elevation.
      await rollbackProvisionOrAttach(this.prisma, provisioned);
      this.staffPermissions.invalidate(user.id);
      // Two concurrent creates for the same email can both pass the pre-check
      // and race on the unique operator/staff rows - the loser gets a 409.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `${email} already belongs to an operator account`,
        );
      }
      throw err;
    }
  }

  /**
   * Self-service onboarding - the operator account already exists (created by an
   * admin via {@link create}); here the operator fills in their company profile.
   */
  async onboard(userId: string, dto: OnboardOperatorDto) {
    const operator = await this.prisma.operator.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!operator) {
      throw new NotFoundException(
        'No operator account found for this user. Please contact an administrator.',
      );
    }

    const {
      companyName,
      companyCountry,
      companyCity,
      companyPhone,
      plannedTripCount,
      yearlySalesTarget,
    } = dto;

    const data = {
      companyName,
      companyCountry,
      companyCity,
      companyPhone,
      plannedTripCount,
      yearlySalesTarget,
    };

    await this.prisma.operatorCompanyInfo.upsert({
      where: { operatorId: operator.id },
      update: data,
      create: { operatorId: operator.id, ...data },
    });

    return this.prisma.operator.findUnique({
      where: { id: operator.id },
      select: this.operatorSelect,
    });
  }

  async findAll(query: OperatorQueryDto) {
    const {
      search,
      isActive,
      verificationStatus,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OperatorWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        {
          companyInfo: {
            companyName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.operator.count({ where }),
      this.prisma.operator.findMany({
        where,
        select: {
          id: true,
          isActive: true,
          verificationStatus: true,
          verificationDecidedAt: true,
          firstTourLiveAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
          companyInfo: { select: { companyName: true } },
          // toursSubmitted is DERIVED at read time (plan §2.4): tours that
          // were EVER submitted for review (submittedAt survives approval and
          // publish). Filtered relation count - one query, no N+1.
          _count: {
            select: { tours: { where: { submittedAt: { not: null } } } },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: data.map(({ _count, ...operator }) => ({
        ...operator,
        toursSubmitted: _count.tours,
      })),
    };
  }

  async findOne(
    id: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(id);
    await this.assertMemberOrAdmin(
      operator,
      requestingUserId,
      requestingUserRole,
    );

    const decided = await this.prisma.operator.findUnique({
      where: { id },
      select: this.operatorSelect,
    });
    if (!decided) {
      // Deleted between the guarded update and this read - vanishingly rare,
      // but returning null would 201 with an empty body against the swagger
      // contract.
      throw new NotFoundException('Operator not found');
    }
    return decided;
  }

  async update(id: string, dto: UpdateOperatorDto) {
    await this.ensureExists(id);
    return this.prisma.operator.update({
      where: { id },
      data: dto,
      select: this.operatorSelect,
    });
  }

  /**
   * The ONLY sanctioned writer of `verificationStatus` (plan §2.5): approve or
   * reject a PENDING operator. The guarded `updateMany` makes the transition
   * race-free - two parallel decides produce exactly one winner (the
   * hold-expiry idiom from bookings.service.ts) - and one-shot: VERIFIED and
   * REJECTED are terminal until an admin re-pends through a future flow.
   * Approval fires OB-2A best-effort; a mail failure never fails the decision.
   */
  async decideVerification(
    id: string,
    dto: DecideVerificationDto,
    actorId: string,
  ) {
    await this.ensureExists(id);

    const res = await this.prisma.operator.updateMany({
      where: { id, verificationStatus: OperatorVerificationStatus.PENDING },
      data: {
        verificationStatus: dto.decision,
        verificationDecidedAt: new Date(),
      },
    });

    if (res.count === 0) {
      // Lost the guard: either already decided (race, double-click) or never
      // moved to PENDING. Tell the caller which state blocked the decision.
      const current = await this.prisma.operator.findUnique({
        where: { id },
        select: { verificationStatus: true },
      });
      if (!current) throw new NotFoundException(`Operator ${id} not found`);
      throw new ConflictException(
        `Operator verification is ${current.verificationStatus} - only a PENDING operator can be decided`,
      );
    }

    this.logger.log(
      `Admin ${actorId} decided operator ${id} verification: ${dto.decision}`,
    );

    if (dto.decision === OperatorVerificationStatus.VERIFIED) {
      // OB-2A. One-shot by construction: only the guarded transition above
      // reaches this line, and it succeeds exactly once per PENDING spell.
      this.notifyOperatorApproved(id);
    }

    return this.prisma.operator.findUnique({
      where: { id },
      select: this.operatorSelect,
    });
  }

  /**
   * INT-1 "New operator" to the sales pipeline. Fire-and-forget off the
   * creation path (the tours.service notifyReviewSubmitted pattern): loads
   * its own recipient data, never fails the mutation, logs-and-skips when no
   * recipient env is configured.
   */
  private notifyOperatorSignup(operatorId: string): void {
    const to = salesRecipient();
    if (!to) {
      this.logger.error(
        `SALES_EMAIL/ADMIN_EMAIL are not configured - operator ${operatorId} signed up with nobody alerted`,
      );
      return;
    }

    void this.prisma.operator
      .findUnique({
        where: { id: operatorId },
        select: {
          createdAt: true,
          contactPhone: true,
          user: { select: { name: true, email: true } },
          companyInfo: { select: { companyName: true, companyPhone: true } },
        },
      })
      .then((operator) => {
        if (!operator) return;
        // WP-D: through the send log (scope = operatorId; creation happens
        // once, so send-once semantics fit). claimAndSend never throws.
        return this.emailLog.claimAndSend({
          templateKey: EmailTemplateKey.INT1_NEW_OPERATOR,
          scopeId: operatorId,
          toEmail: to,
          stream: EmailStream.INTERNAL,
          send: () =>
            this.mailService.sendOperatorSignupInternalEmail(to, {
              operatorName:
                operator.companyInfo?.companyName ?? operator.user.name,
              signatoryName: operator.user.name,
              email: operator.user.email,
              phone:
                operator.contactPhone ?? operator.companyInfo?.companyPhone,
              acceptedAt: operator.createdAt,
              reviewUrl: `${dashboardAppBase()}/tour-operators/${operatorId}/edit`,
            }),
        });
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Operator-signup internal alert failed for operator ${operatorId}`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  /**
   * OB-2A "You're approved" to the operator's login mailbox. Same
   * fire-and-forget contract as {@link notifyOperatorSignup}: the approval is
   * already committed when this runs, and it must stay committed even when
   * the mail transport is down.
   */
  private notifyOperatorApproved(operatorId: string): void {
    void this.prisma.operator
      .findUnique({
        where: { id: operatorId },
        select: {
          user: { select: { name: true, email: true } },
          companyInfo: { select: { companyName: true } },
        },
      })
      .then((operator) => {
        if (!operator) return;
        const dashboardUrl = dashboardAppBase();
        // WP-D (D-19): through the send log, so the guarded one-shot
        // transition gains a second, durable guard AND the send appears on
        // the dashboard timeline. claimAndSend never throws.
        return this.emailLog.claimAndSend({
          templateKey: EmailTemplateKey.OB2A_APPROVED,
          scopeId: operatorId,
          toEmail: operator.user.email,
          stream: EmailStream.TRANSACTIONAL,
          send: () =>
            this.mailService.sendOperatorApprovedEmail(operator.user.email, {
              firstName: operator.user.name?.trim().split(/\s+/)[0],
              companyName:
                operator.companyInfo?.companyName ?? operator.user.name,
              addTourUrl: `${dashboardUrl}/trips/new`,
              dashboardUrl,
            }),
        });
      })
      .catch((err: unknown) =>
        this.logger.error(
          `Operator-approved email failed for operator ${operatorId}`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  /**
   * Deletes the operator AND its auth user (the invite created both, see
   * {@link create}) - otherwise the email stays claimed and can never be
   * re-invited. The user is removed only when it is a plain TOUR_OPERATOR:
   * an ADMIN's auto-provisioned operator record (rule #19) must never take
   * the admin account down with it.
   */
  async remove(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      select: { userId: true, user: { select: { role: true, email: true } } },
    });
    if (!operator) throw new NotFoundException('Operator not found');

    // Team seats cascade with the operator row, but the seat USERS are
    // separate TOUR_OPERATOR accounts that would otherwise linger with live
    // sessions and no operator - delete them (owner handled below).
    const seats = await this.prisma.staffMember.findMany({
      where: {
        operatorId: id,
        userId: { not: operator.userId },
        user: { role: Role.TOUR_OPERATOR },
      },
      select: { userId: true },
    });

    await this.prisma.operator.delete({
      where: { id },
      select: { id: true },
    });

    if (seats.length > 0) {
      const authCtx = await auth.$context;
      for (const seat of seats) {
        // Removes the user plus their sessions/accounts (immediate sign-out).
        await authCtx.internalAdapter
          .deleteUser(seat.userId)
          .catch(() => undefined);
      }
      this.logger.log(
        `Operator ${id}: removed ${seats.length} team seat account(s)`,
      );
    }

    if (operator.user.role === Role.TOUR_OPERATOR) {
      // internalAdapter.deleteUser also removes sessions/accounts, so the
      // email is fully released for a future re-invite.
      const authCtx = await auth.$context;
      await authCtx.internalAdapter.deleteUser(operator.userId);
      this.logger.log(
        `Operator ${id} deleted along with user account ${operator.user.email}`,
      );
    } else {
      this.logger.log(
        `Operator ${id} deleted; user ${operator.user.email} kept (role ${operator.user.role})`,
      );
    }

    return { message: 'Operator deleted successfully' };
  }

  // ── Company Information ────────────────────────────────────────────────────

  async getCompanyInfo(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(operatorId);
    await this.assertMemberOrAdmin(
      operator,
      requestingUserId,
      requestingUserRole,
    );

    return this.prisma.operatorCompanyInfo.findUnique({
      where: { operatorId },
    }); // returns null if not yet filled - frontend handles empty state
  }

  async updateCompanyInfo(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
    dto: UpdateOperatorCompanyInfoDto,
  ) {
    const operator = await this.resolveOperator(operatorId);
    await this.assertMemberOrAdmin(
      operator,
      requestingUserId,
      requestingUserRole,
    );

    return this.prisma.operatorCompanyInfo.upsert({
      where: { operatorId },
      update: { ...dto },
      create: { operatorId, ...dto },
    });
  }

  // ── Social Media ───────────────────────────────────────────────────────────

  async getSocialMedia(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(operatorId);
    await this.assertMemberOrAdmin(
      operator,
      requestingUserId,
      requestingUserRole,
    );

    return this.prisma.operatorSocialMedia.findUnique({
      where: { operatorId },
    });
  }

  async updateSocialMedia(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
    dto: UpdateOperatorSocialMediaDto,
  ) {
    const operator = await this.resolveOperator(operatorId);
    await this.assertMemberOrAdmin(
      operator,
      requestingUserId,
      requestingUserRole,
    );

    return this.prisma.operatorSocialMedia.upsert({
      where: { operatorId },
      update: { ...dto },
      create: { operatorId, ...dto },
    });
  }

  // ── Stripe ─────────────────────────────────────────────────────────────────

  async updateStripeConfig(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
    dto: UpdateOperatorStripeConfigDto,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    const data = {
      ...dto,
      ...(dto.secretKey && { secretKey: encrypt(dto.secretKey) }),
      ...(dto.webhookSecret && { webhookSecret: encrypt(dto.webhookSecret) }),
      // publishableKey is public - no encryption needed
    };

    const result = await this.prisma.operatorStripeConfig.upsert({
      where: { operatorId },
      update: { ...data },
      create: { operatorId, ...data },
    });
    return {
      ...result,
      secretKey: maskSecret(result.secretKey),
      webhookSecret: maskSecret(result.webhookSecret),
    };
  }

  async getStripeConfig(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    const config = await this.prisma.operatorStripeConfig.findUnique({
      where: { operatorId },
    });

    if (!config) return null;

    return {
      ...config,
      secretKey: maskSecret(config.secretKey),
      webhookSecret: maskSecret(config.webhookSecret),
    };
  }

  // ── Mollie ─────────────────────────────────────────────────────────────────

  async updateMollieConfig(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
    dto: UpdateOperatorMollieConfigDto,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    const data = {
      ...dto,
      ...(dto.apiKey && { apiKey: encrypt(dto.apiKey) }),
    };

    const result = await this.prisma.operatorMollieConfig.upsert({
      where: { operatorId },
      update: { ...data },
      create: { operatorId, ...data },
    });
    return {
      ...result,
      apiKey: maskSecret(result.apiKey),
    };
  }

  async getMollieConfig(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    const config = await this.prisma.operatorMollieConfig.findUnique({
      where: { operatorId },
    });

    if (!config) return null;

    return {
      ...config,
      apiKey: maskSecret(config.apiKey),
    };
  }

  // ── Active payment provider (mirrors the platform payment_settings switch) ──

  async getPaymentProvider(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    return {
      activeProvider: operator.activePaymentProvider,
      updatedAt: operator.updatedAt,
    };
  }

  /**
   * Switch the operator's charging PSP. Same contract as the platform switch
   * (settings.service): the TARGET provider must already hold usable
   * credentials or the switch is rejected with a 400 - flipping to an
   * unconfigured provider would dead-end every charge. The per-config
   * `isActive` flags are kept in sync so config reads stay coherent.
   */
  async updatePaymentProvider(
    operatorId: string,
    requestingUserId: string,
    requestingUserRole: Role,
    dto: UpdateOperatorPaymentProviderDto,
  ) {
    const operator = await this.resolveOperator(operatorId);
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

    if (dto.activeProvider === PaymentProvider.MOLLIE) {
      const mollie = await this.prisma.operatorMollieConfig.findUnique({
        where: { operatorId },
        select: { apiKey: true },
      });
      if (!mollie?.apiKey) {
        throw new BadRequestException(
          'Configure the Mollie API key before making Mollie the active provider',
        );
      }
    } else {
      const stripe = await this.prisma.operatorStripeConfig.findUnique({
        where: { operatorId },
        select: { secretKey: true, webhookSecret: true },
      });
      if (!stripe?.secretKey || !stripe.webhookSecret) {
        throw new BadRequestException(
          'Configure the Stripe secret key and webhook secret before making Stripe the active provider',
        );
      }
    }

    const updated = await this.prisma.operator.update({
      where: { id: operatorId },
      data: { activePaymentProvider: dto.activeProvider },
      select: { activePaymentProvider: true, updatedAt: true },
    });
    // Keep the per-config isActive flags coherent with the single switch.
    await this.prisma.operatorStripeConfig.updateMany({
      where: { operatorId },
      data: { isActive: dto.activeProvider === PaymentProvider.STRIPE },
    });
    await this.prisma.operatorMollieConfig.updateMany({
      where: { operatorId },
      data: { isActive: dto.activeProvider === PaymentProvider.MOLLIE },
    });

    this.logger.log(
      `Operator ${operatorId} active payment provider set to ${updated.activePaymentProvider}`,
    );
    return {
      activeProvider: updated.activePaymentProvider,
      updatedAt: updated.updatedAt,
    };
  }
}
