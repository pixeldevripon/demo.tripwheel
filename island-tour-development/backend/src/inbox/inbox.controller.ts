import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import {
  ClearInboxDto,
  ListInboxQueryDto,
  MarkInboxReadDto,
} from './dto/inbox.dto';
import { InboxService } from './inbox.service';
import {
  ApiClearInboxDocs,
  ApiInboxDigestDocs,
  ApiInboxSummaryDocs,
  ApiInboxTag,
  ApiListInboxDocs,
  ApiMarkInboxReadDocs,
  ApiRemoveInboxDocs,
} from './inbox.swagger';

/**
 * The signed-in user's own notifications.
 *
 * No `@RequirePermissions`, deliberately: every route is scoped to
 * `user.id` from the session, so there is nothing here to authorise beyond
 * being signed in. Adding a permission would only lock people out of their own
 * bell. Entitlement was already decided at fan-out time - a row exists only
 * because its recipient could open the page it links to.
 */
@ApiInboxTag()
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  // Static routes before dynamic ones - there are no dynamic ones here yet,
  // but `summary` and `digest` must stay above any future `:id`.

  @Get('summary')
  @ApiInboxSummaryDocs()
  summary(@AuthenticatedUser() user: TypedAuthUser) {
    return this.inbox.summary(user.id);
  }

  @Get()
  @ApiListInboxDocs()
  list(
    @Query() query: ListInboxQueryDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.inbox.list(user.id, query);
  }

  @Patch('read')
  @ApiMarkInboxReadDocs()
  markRead(
    @Body() dto: MarkInboxReadDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.inbox.markRead(user.id, dto);
  }

  @Post('digest')
  @ApiInboxDigestDocs()
  digest(@AuthenticatedUser() user: TypedAuthUser) {
    return this.inbox.digest(user.id);
  }

  /**
   * Bulk clear. `DELETE` with a body rather than a POST: it deletes, and the
   * verb should say so. Declared BEFORE `:id` - a static segment must never sit
   * behind a dynamic one, and NestJS matches top to bottom.
   */
  @Delete()
  @ApiClearInboxDocs()
  clear(@Body() dto: ClearInboxDto, @AuthenticatedUser() user: TypedAuthUser) {
    return this.inbox.clear(user.id, dto);
  }

  @Delete(':id')
  @ApiRemoveInboxDocs()
  remove(@Param('id') id: string, @AuthenticatedUser() user: TypedAuthUser) {
    return this.inbox.remove(user.id, id);
  }
}
