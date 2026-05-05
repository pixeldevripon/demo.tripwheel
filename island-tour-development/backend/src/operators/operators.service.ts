import { decrypt, encrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  CreateOperatorDto,
  OperatorQueryDto,
  UpdateOperatorCompanyInfoDto,
  UpdateOperatorDto,
  UpdateOperatorMollieConfigDto,
  UpdateOperatorSocialMediaDto,
  UpdateOperatorStripeConfigDto,
} from './dto/operator.dto';

@Injectable()
export class OperatorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shared ownership guard ─────────────────────────────────────────────────

  private async resolveOperator(operatorId: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      include: { user: true },
    });

    if (!operator)
      throw new NotFoundException(`Operator ${operatorId} not found`);
    return operator;
  }

  private assertOwnerOrAdmin(
    operator: { userId: string },
    requestingUserId: string,
    requestingUserRole: Role,
  ) {
    if (requestingUserRole === Role.ADMIN) return; // admin bypasses ownership
    if (operator.userId !== requestingUserId) {
      throw new ForbiddenException(
        'You can only manage your own operator profile',
      );
    }
  }

  // ── Core Operator CRUD ─────────────────────────────────────────────────────

  async create(dto: CreateOperatorDto) {
    return this.prisma.operator.create({
      data: dto,
    });
  }

  async findAll(query: OperatorQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.operator.count(),
      this.prisma.operator.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, data };
  }
  async findOne(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
    });

    if (!operator) throw new NotFoundException(`Operator ${id} not found`);
    return operator;
  }

  async update(id: string, dto: UpdateOperatorDto) {
    await this.findOne(id);
    return this.prisma.operator.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.operator.delete({
      where: { id },
    });
  }

  // ── Company Information ────────────────────────────────────────────────────

  async getCompanyInfo(operatorId: string) {
    await this.findOne(operatorId); // ensure operator exists
    return this.prisma.operatorCompanyInfo.findUnique({
      where: { operatorId },
    }); // returns null if not yet filled — frontend handles empty state
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

  async getSocialMedia(operatorId: string) {
    await this.findOne(operatorId);
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
      // publishableKey is public — no encryption needed
    };

    const result = await this.prisma.operatorStripeConfig.upsert({
      where: { operatorId },
      update: { ...data },
      create: { operatorId, ...data },
    });
    return {
      ...result,
      secretKey: result.secretKey
        ? '••••••••' + decrypt(result.secretKey).slice(-4)
        : null,
      webhookSecret: result.webhookSecret
        ? '••••••••' + decrypt(result.webhookSecret).slice(-4)
        : null,
    };
  }

  async getStripeConfig(operatorId: string) {
    await this.findOne(operatorId);
    const config = await this.prisma.operatorStripeConfig.findUnique({
      where: { operatorId },
    });

    if (!config) return null;

    return {
      ...config,
      secretKey: config.secretKey
        ? '••••••••' + decrypt(config.secretKey).slice(-4)
        : null,
      webhookSecret: config.webhookSecret
        ? '••••••••' + decrypt(config.webhookSecret).slice(-4)
        : null,
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
      apiKey: result.apiKey
        ? '••••••••' + decrypt(result.apiKey).slice(-4)
        : null,
    };
  }

  async getMollieConfig(operatorId: string) {
    await this.findOne(operatorId);
    const config = await this.prisma.operatorMollieConfig.findUnique({
      where: { operatorId },
    });

    if (!config) return null;

    return {
      ...config,
      apiKey: config.apiKey
        ? '••••••••' + decrypt(config.apiKey).slice(-4)
        : null,
    };
  }
}
