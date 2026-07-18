import { auth } from '@/auth/auth.instance';
import { decrypt, encrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
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
  // Operator portal (the separated dashboard app), including the /portal path.
  // Trimmed and stripped of trailing junk defensively: this value is embedded
  // verbatim in emailed links, where a stray "/", ".", or space breaks them.
  private readonly portalUrl = (
    process.env.PORTAL_URL ?? 'http://localhost:3001/portal'
  )
    .trim()
    .replace(/[/.\s]+$/, '');

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
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }

    const authCtx = await auth.$context;

    // A credential account must exist so the invite's reset flow can set the
    // real password. This throwaway secret is never transmitted anywhere.
    const throwawayPassword = randomBytes(24).toString('base64url');
    const hashedPassword = await authCtx.password.hash(throwawayPassword);

    const user = await authCtx.internalAdapter.createUser({
      email,
      name: dto.name,
      role: Role.TOUR_OPERATOR,
      // Admin-vouched; ownership is re-proven when the operator uses the invite link.
      emailVerified: true,
    });

    let operatorId: string | undefined;
    try {
      await authCtx.internalAdapter.linkAccount({
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: hashedPassword,
      });

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
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

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

    await this.prisma.operator.delete({
      where: { id },
      select: { id: true },
    });

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
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

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
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

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
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

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
    this.assertOwnerOrAdmin(operator, requestingUserId, requestingUserRole);

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
