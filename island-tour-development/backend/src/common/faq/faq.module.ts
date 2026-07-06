import { Global, Module } from '@nestjs/common';
import { FaqGroupService } from './faq-group.service';

/**
 * FaqModule — provides the shared grouped-FAQ service used by every entity that
 * owns FAQs (destination, category, hub, collection). Global so any module can
 * inject FaqGroupService without re-importing.
 */
@Global()
@Module({
  providers: [FaqGroupService],
  exports: [FaqGroupService],
})
export class FaqModule {}
