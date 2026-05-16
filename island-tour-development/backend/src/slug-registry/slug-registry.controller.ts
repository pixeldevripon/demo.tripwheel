import { Public } from '@/auth/decorators/public.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResolveSlugQueryDto } from './dto/slug-registry.dto';
import { ApiResolveSlugDocs } from './slug-registry.swagger';
import { SlugRegistryService } from './slug-registry.service';

@ApiTags('Slug Registry')
@Controller('slug-registry')
export class SlugRegistryController {
  constructor(private readonly slugRegistryService: SlugRegistryService) {}

  /**
   * GET /slug-registry/resolve?destinationSlug=curacao&slug=boat-tours
   *
   * Resolves a (destinationSlug, slug) pair to an entity type and ID.
   * The frontend calls this to decide which page component to render.
   * Returns 404 if the slug is unknown or inactive (entity was soft-deleted).
   */
  @Get('resolve')
  @Public()
  @ApiResolveSlugDocs()
  resolve(@Query() query: ResolveSlugQueryDto) {
    return this.slugRegistryService.resolve(query.destinationSlug, query.slug);
  }
}
