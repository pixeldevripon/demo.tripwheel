import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { OctoCapabilitiesMiddleware } from '@/octo/common/octo-capabilities';
import { OctoService } from '@/octo/octo.service';
import { OctoSupplierController } from '@/octo/octo-supplier.controller';
import { OctoToursController } from '@/octo/octo-tours.controller';

/**
 * OCTO API module (spec-compliant catalog surface under `/api/v1/octo`).
 *
 * Phase 0+1: capabilities negotiation + Supplier + Tour list/detail. The capabilities
 * middleware is applied to every `octo/*` route so `@OctoCaps()` is populated and the
 * `Octo-Capabilities` response header is echoed. `PrismaService` is `@Global()`, so it
 * is not imported here.
 */
@Module({
  controllers: [OctoSupplierController, OctoToursController],
  providers: [OctoService],
})
export class OctoModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OctoCapabilitiesMiddleware).forRoutes('octo');
  }
}
