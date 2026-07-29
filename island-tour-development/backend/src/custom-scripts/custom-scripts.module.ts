import { Module } from '@nestjs/common';

import { CustomScriptsController } from './custom-scripts.controller';
import { CustomScriptsService } from './custom-scripts.service';

/**
 * Custom scripts: admin-pasted vendor snippets injected into every public page.
 * PrismaService is `@Global()`, so nothing else needs importing here.
 */
@Module({
  controllers: [CustomScriptsController],
  providers: [CustomScriptsService],
  exports: [CustomScriptsService],
})
export class CustomScriptsModule {}
