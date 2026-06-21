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

    if (entry?.isActive) {
      return {
        redirect: false as const,
        destinationSlug: entry.destinationSlug,
        slug: entry.slug,
        entityType: entry.entityType,
        entityId: entry.entityId,
      };
    }

    // No active row — a renamed slug leaves a 301 redirect behind (master slug-registry rule).
    const redirect = await this.prisma.slugRedirect.findUnique({
      where: { destinationSlug_fromSlug: { destinationSlug, fromSlug: slug } },
      select: { toSlug: true, statusCode: true, entityType: true },
    });

    if (redirect) {
      return {
        redirect: true as const,
        statusCode: redirect.statusCode,
        destinationSlug,
        fromSlug: slug,
        toSlug: redirect.toSlug,
        entityType: redirect.entityType,
      };
    }

    // Either unknown, or a slug that is disabled / in its post-deletion cooldown → 404.
    throw new NotFoundException(
      `No active slug "${slug}" found for destination "${destinationSlug}"`,
    );
  }
}
