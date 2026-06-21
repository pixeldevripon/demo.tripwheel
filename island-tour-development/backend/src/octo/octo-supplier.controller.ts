import { Controller, Get, Req, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/auth/decorators/public.decorator';
import { OctoExceptionFilter } from '@/octo/common/octo-error';
import { OctoService } from '@/octo/octo.service';

/** Builds the OCTO base endpoint the supplier advertises (no trailing slash). */
export function octoEndpoint(req: Request): string {
  const host = req.get('host') ?? 'localhost:5050';
  return `${req.protocol}://${host}/api/v1/octo`;
}

/**
 * OCTO Supplier endpoint (spec §3, §4.1).
 *
 * Public catalog metadata for the platform-as-supplier (decision D4). Auth is open
 * for v1 reads; bearer-gated for OTAs is layered later. The OCTO error envelope is
 * scoped here via `@UseFilters` so the native `/api/v1` surface keeps its own shape.
 */
@ApiTags('OCTO')
@Public()
@UseFilters(OctoExceptionFilter)
@Controller('octo/supplier')
export class OctoSupplierController {
  constructor(private readonly octoService: OctoService) {}

  @Get()
  @ApiOperation({ summary: 'Get Supplier (OCTO §4.1)' })
  @ApiOkResponse({ description: 'OCTO Supplier object.' })
  getSupplier(@Req() req: Request) {
    return this.octoService.getSupplier(octoEndpoint(req));
  }
}
