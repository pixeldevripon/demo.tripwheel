import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateRecommendationCategoryDto,
  UpdateRecommendationCategoryDto,
} from './dto/recommendation.dto';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  icon: true,
  displayOrder: true,
  isSeeded: true,
  _count: { select: { recommendations: true } },
} as const;

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  displayOrder: number;
  isSeeded: boolean;
  _count: { recommendations: number };
};

/**
 * The admin-managed recommendation taxonomy (Hotel, Restaurant, Car rental, …).
 * A pure organising layer for the recommendation library - the label is English
 * management copy, not publicly rendered, so it is not in the translation pipeline.
 */
@Injectable()
export class RecommendationCategoriesService {
  private readonly logger = new Logger(RecommendationCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const rows = await this.prisma.recommendationCategory.findMany({
      select: CATEGORY_SELECT,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(this.toShape);
  }

  async findOne(id: string) {
    const row = await this.prisma.recommendationCategory.findUnique({
      where: { id },
      select: CATEGORY_SELECT,
    });
    if (!row) throw new NotFoundException(`Category ${id} not found`);
    return this.toShape(row);
  }

  async create(dto: CreateRecommendationCategoryDto, adminId: string) {
    const slug = generateSlug(dto.slug || dto.name);

    try {
      const row = await this.prisma.recommendationCategory.create({
        data: {
          name: dto.name,
          slug,
          icon: dto.icon ?? null,
          displayOrder: dto.displayOrder ?? 0,
        },
        select: CATEGORY_SELECT,
      });
      this.logger.log(
        `Admin ${adminId} created recommendation category ${row.id}`,
      );
      return this.toShape(row);
    } catch (err) {
      throw this.mapConflict(err, slug);
    }
  }

  async update(
    id: string,
    dto: UpdateRecommendationCategoryDto,
    adminId: string,
  ) {
    await this.assertExists(id);
    const slug = dto.slug !== undefined ? generateSlug(dto.slug) : undefined;

    try {
      const row = await this.prisma.recommendationCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(slug !== undefined && { slug }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.displayOrder !== undefined && {
            displayOrder: dto.displayOrder,
          }),
        },
        select: CATEGORY_SELECT,
      });
      this.logger.log(`Admin ${adminId} updated recommendation category ${id}`);
      return this.toShape(row);
    } catch (err) {
      throw this.mapConflict(err, slug ?? '');
    }
  }

  /**
   * Delete a category. Seeded categories are protected (403), the same contract as
   * seeded destinations. Recommendations filed under it are NOT deleted - the FK is
   * SetNull, so they fall back to uncategorised.
   */
  async remove(id: string, adminId: string) {
    const row = await this.prisma.recommendationCategory.findUnique({
      where: { id },
      select: { id: true, isSeeded: true },
    });
    if (!row) throw new NotFoundException(`Category ${id} not found`);

    if (row.isSeeded) {
      throw new ForbiddenException('Seeded categories cannot be deleted.');
    }

    await this.prisma.recommendationCategory.delete({ where: { id } });
    this.logger.log(`Admin ${adminId} deleted recommendation category ${id}`);
    return { message: 'Category deleted successfully' };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private toShape(row: CategoryRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon,
      displayOrder: row.displayOrder,
      isSeeded: row.isSeeded,
      recommendationCount: row._count.recommendations,
    };
  }

  private async assertExists(id: string) {
    const found = await this.prisma.recommendationCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Category ${id} not found`);
  }

  private mapConflict(err: unknown, slug: string) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        `A recommendation category with the slug "${slug}" already exists.`,
      );
    }
    return err;
  }
}
