import { auth } from '@/auth/auth.instance';
import { decrypt, encrypt } from '@/common/utils/crypto.util';
import {
  getPortalUrl,
  provisionInvitedAccount,
} from '@/common/utils/invite-provisioning.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, StaffSeatRole, StaffStatus } from '@prisma/client';

import {
  CreateOperatorDto,
  OnboardOperatorDto,
  OperatorQueryDto,
  UpdateOperatorCompanyInfoDto,
  UpdateOperatorDto,
  UpdateOperatorMollieConfigDto,
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

  constructor(private readonly prisma: PrismaService) {}

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

  /** Masks an encrypted secret for display: bullet prefix + last 4 plaintext chars. */
  private maskSecret(encrypted: string | null): string | null {
    if (!encrypted) return null;
    return '••••••••' + decrypt(encrypted).slice(-4);
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
    // Shared invite util: unique email + user row + throwaway credential so
    // the invite's reset flow can set the real password.
    const { email, user, authCtx } = await provisionInvitedAccount(
      this.prisma,
      { email: dto.email, name: dto.name, role: Role.TOUR_OPERATOR },
    );

    let operatorId: string | undefined;
    try {
      const operator = await this.prisma.operator.create({
        data: {
          userId: user.id,
          isActive: dto.isActive ?? true,
          contactEmail: email,
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

      this.logger.log(
        `Operator account created and invited: ${email} (operator ${operator.id})`,
      );
      return operator;
    } catch (err) {
      // Roll back everything we created so a failure leaves no orphans.
      if (operatorId) {
        await this.prisma.operator
          .delete({ where: { id: operatorId } })
          .catch(() => undefined);
      }
      await authCtx.internalAdapter.deleteUser(user.id).catch(() => undefined);
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
    const { search, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OperatorWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
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
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
          companyInfo: { select: { companyName: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, data };
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

    return this.prisma.operator.findUnique({
      where: { id },
      select: this.operatorSelect,
    });
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
      secretKey: this.maskSecret(result.secretKey),
      webhookSecret: this.maskSecret(result.webhookSecret),
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
      secretKey: this.maskSecret(config.secretKey),
      webhookSecret: this.maskSecret(config.webhookSecret),
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
      apiKey: this.maskSecret(result.apiKey),
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
      apiKey: this.maskSecret(config.apiKey),
    };
  }
}
