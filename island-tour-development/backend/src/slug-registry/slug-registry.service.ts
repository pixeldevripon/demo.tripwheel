import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class SlugRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(destinationSlug: string, slug: string) {
    const entry = await this.prisma.slugRegistry.findUnique({
      where: { destinationSlug_slug: { destinationSlug, slug } },
      select: { destinationSlug: true, slug: true, entityType: true, entityId: true, isActive: true },
    });

    if (!entry || !entry.isActive) {
      throw new NotFoundException(
        `No active slug "${slug}" found for destination "${destinationSlug}"`,
      );
    }

    return {
      destinationSlug: entry.destinationSlug,
      slug: entry.slug,
      entityType: entry.entityType,
      entityId: entry.entityId,
    };
  }
}
