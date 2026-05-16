import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SlugEntityType } from '@prisma/client';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateHubDto,
  HubBySlugQueryDto,
  HubQueryDto,
  UpdateHubDto,
} from './dto/hub.dto';

@Injectable()
export class HubService {
  private readonly logger = new Logger(HubService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly hubSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly hubDetailSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    allowedCategories: {
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    },
  } as const;

  private readonly allowedCategorySelect = {
    id: true,
    categoryId: true,
    category: { select: { id: true, name: true, slug: true } },
  } as const;

  async getAll(query: HubQueryDto) {
    const { destinationId, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(destinationId !== undefined && { destinationId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.hub.count({ where }),
      this.prisma.hub.findMany({
        where,
        select: this.hubSelect,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getActive(query: ActiveHubsQueryDto) {
    const { destinationId } = query;

    return this.prisma.hub.findMany({
      where: {
        isActive: true,
        ...(destinationId !== undefined && { destinationId }),
      },
      select: this.hubDetailSelect,
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: this.hubDetailSelect,
    });

    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    return hub;
  }

  async getBySlug(slug: string, query: HubBySlugQueryDto) {
    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destination: { slug: query.destinationSlug },
      },
      select: this.hubDetailSelect,
    });

    if (!hub) {
      throw new NotFoundException(
        `Hub "${slug}" not found for destination "${query.destinationSlug}"`,
      );
    }

    return hub;
  }

  async create(dto: CreateHubDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma
      .$transaction(async (tx) => {
        // 1. Verify destination exists and get its slug for slug_registry
        const destination = await tx.destination.findUnique({
          where: { id: dto.destinationId },
          select: { slug: true },
        });
        if (!destination) {
          throw new NotFoundException(`Destination ${dto.destinationId} not found`);
        }

        // 2. Create the hub
        const hub = await tx.hub
          .create({
            data: {
              destinationId: dto.destinationId,
              name: dto.name,
              slug,
              description: dto.description,
              createdBy: adminId,
            },
            select: { id: true },
          })
          .catch((err: any) => {
            if (err?.code === 'P2002') {
              throw new ConflictException(
                `Hub slug "${slug}" already exists for this destination`,
              );
            }
            throw err;
          });

        // 3. Seed one slug_registry row for this hub's destination (Critical Rule)
        await tx.slugRegistry
          .create({
            data: {
              destinationSlug: destination.slug,
              slug,
              entityType: SlugEntityType.HUB,
              entityId: hub.id,
            },
          })
          .catch((err: any) => {
            if (err?.code === 'P2002') {
              throw new ConflictException(
                `Slug "${slug}" is already taken for destination "${destination.slug}"`,
              );
            }
            throw err;
          });

        // 4. Seed initial allowed categories if provided
        if (dto.allowedCategoryIds && dto.allowedCategoryIds.length > 0) {
          await tx.hubAllowedCategory.createMany({
            data: dto.allowedCategoryIds.map((categoryId) => ({
              hubId: hub.id,
              categoryId,
            })),
            skipDuplicates: true,
          });
        }

        this.logger.log(
          `Admin ${adminId} created hub "${dto.name}" (${hub.id}) for destination ${dto.destinationId}`,
        );

        return tx.hub.findUniqueOrThrow({
          where: { id: hub.id },
          select: this.hubDetailSelect,
        });
      })
      .catch((err: any) => {
        // Re-throw HttpExceptions as-is; only unexpected errors reach here
        if (err?.status) throw err;
        throw err;
      });
  }

  async update(id: string, dto: UpdateHubDto, adminId: string) {
    await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hub.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: this.hubDetailSelect,
      });

      // Mirror isActive onto the hub's slug_registry row
      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.HUB, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated hub ${id}`);

      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    const hub = await this.getById(id);

    if (hub.isSeeded) {
      throw new ForbiddenException('Seeded hubs cannot be deactivated');
    }

    const tripCount = await this.prisma.trip.count({ where: { hubId: id } });
    if (tripCount > 0) {
      throw new ConflictException(
        `Cannot deactivate hub: ${tripCount} trip(s) are still assigned to it`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.hub.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.HUB, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated hub ${id}`);

    return { message: 'Hub deactivated successfully' };
  }

  async addAllowedCategory(hubId: string, dto: AddAllowedCategoryDto, adminId: string) {
    await this.getById(hubId);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const allowedCategory = await this.prisma.hubAllowedCategory
      .create({
        data: { hubId, categoryId: dto.categoryId },
        select: this.allowedCategorySelect,
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `Category "${category.name}" is already allowed for this hub`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} added allowed category ${dto.categoryId} to hub ${hubId}`,
    );

    return {
      message: 'Allowed category added successfully',
      allowedCategory,
    };
  }

  async removeAllowedCategory(hubId: string, categoryId: string, adminId: string) {
    await this.getById(hubId);

    const existing = await this.prisma.hubAllowedCategory.findUnique({
      where: { hubId_categoryId: { hubId, categoryId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Category ${categoryId} is not in the allowed list for hub ${hubId}`,
      );
    }

    await this.prisma.hubAllowedCategory.delete({
      where: { hubId_categoryId: { hubId, categoryId } },
    });

    this.logger.log(
      `Admin ${adminId} removed allowed category ${categoryId} from hub ${hubId}`,
    );

    return { message: 'Allowed category removed successfully' };
  }
}
