import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@/auth/auth.types';
import { UpdateSessionSurfaceDto } from './dto/session-surface.dto';
import {
  ApiGetSessionSurfaceDocs,
  ApiUpdateSessionSurfaceDocs,
} from './session-surface.swagger';
import { SessionSurfaceService } from './session-surface.service';

/**
 * Authenticated (no @Public): AuthGuard attaches request.user + request.session.
 * The session id comes from the guard-validated session, never from the body -
 * a caller can only ever re-stamp their OWN current session.
 */
@ApiTags('Auth')
@Controller('auth')
export class SessionSurfaceController {
  constructor(private readonly sessionSurfaceService: SessionSurfaceService) {}

  @Get('session-surface')
  @ApiGetSessionSurfaceDocs()
  get(@Req() req: AuthenticatedRequest) {
    const { user, session } = this.assertContext(req);
    return this.sessionSurfaceService.get(user.id, session.id);
  }

  @Patch('session-surface')
  @ApiUpdateSessionSurfaceDocs()
  update(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSessionSurfaceDto,
  ) {
    const { user, session } = this.assertContext(req);
    return this.sessionSurfaceService.update(user.id, session.id, dto);
  }

  /** AuthGuard guarantees these on non-public routes; narrow the types once. */
  private assertContext(req: AuthenticatedRequest) {
    if (!req.user || !req.session) {
      throw new UnauthorizedException('No active session');
    }
    return { user: req.user, session: req.session };
  }
}
