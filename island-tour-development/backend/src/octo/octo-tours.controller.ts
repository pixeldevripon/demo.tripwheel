import {
  Controller,
  Get,
  Headers,
  Param,
  Res,
  UseFilters,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '@/auth/decorators/public.decorator';
import {
  OctoCaps,
  type OctoCapabilitySet,
} from '@/octo/common/octo-capabilities';
import { OctoExceptionFilter } from '@/octo/common/octo-error';
import { negotiateLocale } from '@/octo/common/octo-locale';
import { OctoService } from '@/octo/octo.service';

/**
 * OCTO Tours endpoint (= OCTO "products"; spec §3, §4.2, §8.1).
 *
 * Naming: `tour`/`tourId`, never `product`, per decision D-naming. The list and
 * detail responses share one shape; capability-gated fields (`octo/content`,
 * `octo/pricing`) are negotiated by `OctoCapabilitiesMiddleware`. Content locale
 * comes from `Accept-Language` and is echoed in `Content-Language`.
 */
@ApiTags('OCTO')
@Public()
@UseFilters(OctoExceptionFilter)
@Controller('octo/tours')
export class OctoToursController {
  constructor(private readonly octoService: OctoService) {}

  @Get()
  @ApiOperation({ summary: 'Get Tour List (OCTO §3 - Get Product List)' })
  @ApiOkResponse({ description: 'Array of OCTO Tour (Product) objects.' })
  async listTours(
    @OctoCaps() caps: OctoCapabilitySet,
    @Headers('accept-language') acceptLanguage: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const locale = negotiateLocale(acceptLanguage);
    res.setHeader('Content-Language', locale);
    return this.octoService.listTours(caps, locale);
  }

  @Get(':tourId')
  @ApiOperation({ summary: 'Get Tour (OCTO §4.2 - Get Product)' })
  @ApiParam({ name: 'tourId', description: 'Tour (product) id.' })
  @ApiOkResponse({ description: 'Single OCTO Tour (Product) object.' })
  async getTour(
    @Param('tourId') tourId: string,
    @OctoCaps() caps: OctoCapabilitySet,
    @Headers('accept-language') acceptLanguage: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const locale = negotiateLocale(acceptLanguage);
    res.setHeader('Content-Language', locale);
    return this.octoService.getTour(tourId, caps, locale);
  }
}
