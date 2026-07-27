import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getLoginSurfaces, isLoginSurface } from '@/auth/login-surfaces';
import {
  SessionSurfaceResponseDto,
  UpdateSessionSurfaceDto,
} from './dto/session-surface.dto';

/**
 * In-session view switching for multi-hat accounts (one email, many hats).
 *
 * `Session.surface` is stamped at sign-in from the door the user entered
 * through, and the dashboard shapes its UI by it (customer shell vs staff
 * shell). A staff member who also travels would otherwise have to log out and
 * back in through the other door just to see their bookings - this endpoint
 * re-stamps the CURRENT session instead.
 *
 * Security: purely presentational. The requested surface must be one the
 * account's identities already grant (same `getLoginSurfaces` derivation the
 * sign-in hook enforces), and authorization stays with RolesGuard /
 * PermissionsGuard on every API route - a re-stamp never widens access.
 */
@Injectable()
export class SessionSurfaceService {
  private readonly logger = new Logger(SessionSurfaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    sessionId: string,
  ): Promise<SessionSurfaceResponseDto> {
    const [available, session] = await Promise.all([
      getLoginSurfaces(this.prisma, userId),
      // The userId predicate is redundant TODAY (sessionId always comes from
      // the guard-validated request) but makes the query fail safe if a
      // future refactor ever threads a client-supplied session id in here.
      this.prisma.session.findFirst({
        where: { id: sessionId, userId },
        select: { surface: true },
      }),
    ]);
    return {
      current: isLoginSurface(session?.surface) ? session.surface : null,
      available,
    };
  }

  async update(
    userId: string,
    sessionId: string,
    dto: UpdateSessionSurfaceDto,
  ): Promise<SessionSurfaceResponseDto> {
    const available = await getLoginSurfaces(this.prisma, userId);
    if (!available.includes(dto.surface)) {
      // Same wording family as the sign-in hook: never confirm WHY the
      // surface is off-limits for this account.
      throw new ForbiddenException(
        'This account cannot use that login surface.',
      );
    }

    // updateMany so the ownership predicate actually gates the write (same
    // fail-safe rationale as the read above); count 0 = the session vanished
    // or is not the caller's - either way, nothing was stamped.
    const stamped = await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { surface: dto.surface },
    });
    if (stamped.count === 0) {
      throw new ForbiddenException(
        'This account cannot use that login surface.',
      );
    }

    this.logger.log(`Session surface switched to ${dto.surface}`);
    return { current: dto.surface, available };
  }
}
