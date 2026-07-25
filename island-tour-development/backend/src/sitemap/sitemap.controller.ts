import { Public } from '@/auth/decorators/public.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiSitemapEntriesDocs } from './sitemap.swagger';
import { SitemapService } from './sitemap.service';

@ApiTags('Sitemap')
@Controller('sitemap')
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * GET /sitemap/entries
   *
   * Public enumeration of every indexable URL, consumed by the frontend's
   * app/sitemap.ts. No auth: it only exposes already-public page paths.
   */
  @Get('entries')
  @Public()
  @ApiSitemapEntriesDocs()
  getEntries() {
    return this.sitemapService.getEntries();
  }
}
