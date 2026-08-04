import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateFeaturedExperienceDto,
  UpdateFeaturedExperienceDto,
} from './dto/featured-experience.dto';

/**
 * Public cap. The dashboard nudges toward a small deck (RECOMMENDED_MAX in the
 * dashboard repo); this is the hard stop so a runaway list cannot flood the
 * homepage. Logged when it trims so the admin list does not silently claim
 * "everything is showing" when it is not.
 */
const MAX_PUBLIC_EXPERIENCES = 8;

/**
 * A resolved card: everything the frontend needs, nothing it has to look up.
 *
 * PRESENTATION ONLY (founder, 2026-08-04): a card is an admin-typed label +
 * poster + optional video. No category/hub reference, no destination scoping,
 * no link - the reel is a mood board of the platform's activities, not
 * navigation. The label is a single admin-entered string, not translated
 * across locales.
 */
export interface ResolvedExperience {
  id: string;
  title: string;
  image: string | null;
  videoUrl: string | null;
}

@Injectable()
export class FeaturedExperiencesService {
  private readonly logger = new Logger(FeaturedExperiencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  /**
   * The homepage reel, in display order. The only gate left is "has a poster":
   * the slide is a full-bleed image with the title over it, so a card without
   * one renders as a grey rectangle in the middle of the carousel - dropped,
   * with a warning so the gap is explainable from the logs.
   */
  async resolvePublic(): Promise<ResolvedExperience[]> {
    const rows = await this.prisma.featuredExperience.findMany({
      where: { isActive: true },
      select: FEATURED_SELECT,
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });

    const resolved: ResolvedExperience[] = [];
    for (const row of rows) {
      if (!row.posterUrl) {
        this.logger.warn(
          `Featured card ${row.id} ("${row.title}") has no poster - dropped`,
        );
        continue;
      }
      resolved.push({
        id: row.id,
        title: row.title,
        image: row.posterUrl,
        videoUrl: row.videoUrl,
      });
    }

    if (resolved.length > MAX_PUBLIC_EXPERIENCES) {
      this.logger.warn(
        `Featured experiences resolved ${resolved.length} cards; showing the first ${MAX_PUBLIC_EXPERIENCES} by display order`,
      );
      return resolved.slice(0, MAX_PUBLIC_EXPERIENCES);
    }
    return resolved;
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async list() {
    return this.prisma.featuredExperience.findMany({
      select: FEATURED_SELECT,
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateFeaturedExperienceDto, adminId: string) {
    const created = await this.prisma.featuredExperience.create({
      data: {
        title: dto.title,
        videoUrl: dto.videoUrl ?? null,
        posterUrl: dto.posterUrl ?? null,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: FEATURED_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} featured card "${created.title}" (${created.id})`,
    );
    return created;
  }

  async update(id: string, dto: UpdateFeaturedExperienceDto, adminId: string) {
    const updated = await this.prisma.featuredExperience
      .update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
          ...(dto.posterUrl !== undefined && { posterUrl: dto.posterUrl }),
          ...(dto.displayOrder !== undefined && {
            displayOrder: dto.displayOrder,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: FEATURED_SELECT,
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === 'P2025')
          throw new NotFoundException('Featured experience not found');
        throw err;
      });

    this.logger.log(`Admin ${adminId} updated featured card ${id}`);
    return updated;
  }

  async remove(id: string, adminId: string) {
    await this.prisma.featuredExperience
      .delete({ where: { id } })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === 'P2025')
          throw new NotFoundException('Featured experience not found');
        throw err;
      });

    this.logger.log(`Admin ${adminId} removed featured card ${id}`);
    return { message: 'Featured experience removed' };
  }
}

const FEATURED_SELECT = {
  id: true,
  title: true,
  videoUrl: true,
  posterUrl: true,
  displayOrder: true,
  isActive: true,
} satisfies Prisma.FeaturedExperienceSelect;
