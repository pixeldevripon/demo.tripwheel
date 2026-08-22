import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';

import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';

import { CustomScriptsService } from './custom-scripts.service';
import {
  ApiCreateCustomScriptDocs,
  ApiDeleteCustomScriptDocs,
  ApiGetCustomScriptDocs,
  ApiGetPublicCustomScriptsDocs,
  ApiListCustomScriptsDocs,
  ApiReorderCustomScriptsDocs,
  ApiUpdateCustomScriptDocs,
} from './custom-scripts.swagger';
import {
  CreateCustomScriptDto,
  ReorderCustomScriptsDto,
  UpdateCustomScriptDto,
} from './dto/custom-script.dto';

/**
 * CustomScriptsController - admin-pasted vendor snippets injected into every
 * public page (dashboard: Settings > Scripts).
 *
 * ## Access
 * Reads require VIEW_SETTINGS, writes MANAGE_SETTINGS - the same split as the
 * settings and Instagram modules. Both are ADMIN-only permissions, and that is
 * the actual security control here: these rows execute JavaScript on every
 * visitor, so write access has to sit at the same level as the payment keys.
 * `GET public` is `@Public()` and returns only active snippets' markup.
 */
@ApiTags('Custom Scripts')
@Controller('custom-scripts')
export class CustomScriptsController {
  constructor(private readonly customScripts: CustomScriptsService) {}

  /** Declared first so `public` is never matched as a dynamic `:id`. */
  @Get('public')
  @Public()
  @ApiGetPublicCustomScriptsDocs()
  getPublic() {
    return this.customScripts.getPublicScripts();
  }

  @Get()
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiListCustomScriptsDocs()
  findAll() {
    return this.customScripts.findAll();
  }

  @Post()
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiCreateCustomScriptDocs()
  create(
    @Body() dto: CreateCustomScriptDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customScripts.create(dto, user.id);
  }

  /** Static route, so it must precede `:id`. */
  @Patch('reorder')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiReorderCustomScriptsDocs()
  reorder(
    @Body() dto: ReorderCustomScriptsDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customScripts.reorder(dto, user.id);
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetCustomScriptDocs()
  findOne(@Param('id') id: string) {
    return this.customScripts.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateCustomScriptDocs()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomScriptDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.customScripts.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiDeleteCustomScriptDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.customScripts.remove(id, user.id);
  }
}
