import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  SURFACE_USER_SELECT,
  suggestedSurface,
  surfacesForUser,
} from '@/auth/login-surfaces';
import {
  LoginPrecheckDto,
  LoginPrecheckResponseDto,
} from './dto/login-precheck.dto';

/**
 * Pre-login door check: tells a login page whether the email it is about to
 * submit belongs at that page, so the UI can point multi-hat users to the
 * right door BEFORE a password is typed.
 *
 * Deliberately advisory - the real gate is the x-login-surface enforcement in
 * the sign-in hook (auth.instance.ts), which runs after password verification.
 *
 * Enumeration tradeoff (accepted, throttled): a known email probed at a wrong
 * surface reveals that the account exists and what kind it is. Unknown emails
 * always return ok=true, so bulk existence-scanning through this endpoint is
 * no cheaper than through sign-in itself.
 */
@Injectable()
export class LoginPrecheckService {
  private readonly logger = new Logger(LoginPrecheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  async precheck(dto: LoginPrecheckDto): Promise<LoginPrecheckResponseDto> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: SURFACE_USER_SELECT,
    });

    // Unknown email: pretend all is well; sign-in will fail generically.
    if (!user) return { ok: true };

    const surfaces = surfacesForUser(user);

    // Allowed here - or allowed nowhere (legacy roles with no door): both get
    // ok=true and the sign-in endpoint delivers the real (generic) verdict.
    if (surfaces.length === 0 || surfaces.includes(dto.surface)) {
      return { ok: true };
    }

    return {
      ok: false,
      surfaces,
      suggested: suggestedSurface(surfaces) ?? undefined,
    };
  }
}
