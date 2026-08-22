import { Global, Module } from '@nestjs/common';
import { PageContentSectionService } from './page-content-section.service';

/**
 * PageContentSectionModule - provides the shared authored-section service used by
 * every entity page that renders heading + body blocks (destination first).
 * Global so any module can inject PageContentSectionService without re-importing,
 * matching FaqModule.
 */
@Global()
@Module({
  providers: [PageContentSectionService],
  exports: [PageContentSectionService],
})
export class PageContentSectionModule {}
