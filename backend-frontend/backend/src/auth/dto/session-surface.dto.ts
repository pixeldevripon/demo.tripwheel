import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { LOGIN_SURFACES, type LoginSurface } from '@/auth/login-surfaces';

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class SessionSurfaceResponseDto {
  @ApiProperty({
    enum: LOGIN_SURFACES,
    nullable: true,
    example: 'staff',
    description:
      'The surface stamped on the CURRENT session (null for sessions minted ' +
      'outside password sign-in, e.g. verify-email - consumers route by ' +
      'role then).',
  })
  current!: LoginSurface | null;

  @ApiProperty({
    enum: LOGIN_SURFACES,
    isArray: true,
    example: ['staff', 'account'],
    description:
      'Every surface this account may use - one entry per attached identity ' +
      '(hat). A multi-hat user can re-stamp the session to any of these.',
  })
  available!: LoginSurface[];
}

// ─── Request DTOs ────────────────────────────────────────────────────────────

export class UpdateSessionSurfaceDto {
  @ApiProperty({
    enum: LOGIN_SURFACES,
    example: 'account',
    description: 'The surface to re-stamp the current session with.',
  })
  @IsIn(LOGIN_SURFACES)
  surface!: LoginSurface;
}
