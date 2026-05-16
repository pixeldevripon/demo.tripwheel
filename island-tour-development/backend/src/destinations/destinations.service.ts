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
  CreateDestinationDto,
  DestinationQueryDto,
  UpdateDestinationDto,
} from './dto/destination.dto';

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly destinationSelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async getAll(query: DestinationQueryDto) {
    const { isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        select: this.destinationSelect,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getActive() {
    return this.prisma.destination.findMany({
      where: { isActive: true },
      select: this.destinationSelect,
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });

    if (!destination) throw new NotFoundException(`Destination ${id} not found`);

    return destination;
  }

  async getBySlug(slug: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: this.destinationSelect,
    });

    if (!destination) {
      throw new NotFoundException(`Destination with slug "${slug}" not found`);
    }

    return destination;
  }

  async create(dto: CreateDestinationDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the destination
      const destination = await tx.destination
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage,
            createdBy: adminId,
          },
          select: { id: true, slug: true },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Destination slug "${slug}" already exists`,
            );
          }
          throw err;
        });

      // 2. Seed the RESERVED 'tours' slug — protects the /<destination>/tours/ URL
      await tx.slugRegistry.create({
        data: {
          destinationSlug: destination.slug,
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
        },
      });

      // 3. Seed one CATEGORY slug_registry row per existing active category (Rule #5 mirror)
      const categories = await tx.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      });

      if (categories.length > 0) {
        await tx.slugRegistry.createMany({
          data: categories.map((cat) => ({
            destinationSlug: destination.slug,
            slug: cat.slug,
            entityType: SlugEntityType.CATEGORY,
            entityId: cat.id,
          })),
        });
      }

      const result = await tx.destination.findUniqueOrThrow({
        where: { id: destination.id },
        select: this.destinationSelect,
      });

      this.logger.log(
        `Admin ${adminId} created destination "${dto.name}" (${destination.id}), ` +
          `seeded ${categories.length} category slug(s) + 1 reserved`,
      );

      return result;
    });
  }

  async update(id: string, dto: UpdateDestinationDto, adminId: string) {
    await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.destination.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: this.destinationSelect,
      });

      // Mirror isActive onto all slug_registry rows seeded for this destination's slug
      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { destinationSlug: updated.slug },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated destination ${id}`);

      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    const destination = await this.getById(id);

    if (destination.isSeeded) {
      throw new ForbiddenException('Seeded destinations cannot be deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.trip.count({ where: { destinationId: id } });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate destination: ${tripCount} trip(s) are still assigned to it`,
        );
      }

      await tx.destination.update({
        where: { id },
        data: { isActive: false },
      });

      // Deactivate all slug_registry rows seeded for this destination's slug
      await tx.slugRegistry.updateMany({
        where: { destinationSlug: destination.slug },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated destination ${id}`);

    return { message: 'Destination deactivated successfully' };
  }
}
