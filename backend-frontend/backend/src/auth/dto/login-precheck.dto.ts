import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import { LOGIN_SURFACES, type LoginSurface } from '@/auth/login-surfaces';

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class LoginPrecheckResponseDto {
  @ApiProperty({
    example: true,
    description:
      'True when the email may sign in at the given surface (or is unknown - ' +
      'unknown emails always get true so this endpoint cannot be used to ' +
      'enumerate accounts any more cheaply than sign-in itself).',
  })
  ok!: boolean;

  @ApiPropertyOptional({
    enum: LOGIN_SURFACES,
    isArray: true,
    example: ['portal'],
    description:
      'Only when ok=false: every surface this account can sign in at.',
  })
  surfaces?: LoginSurface[];

  @ApiPropertyOptional({
    enum: LOGIN_SURFACES,
    example: 'portal',
    description:
      'Only when ok=false: the highest-priority surface to suggest to the user.',
  })
  suggested?: LoginSurface;
}

// ─── Request DTOs ────────────────────────────────────────────────────────────

export class LoginPrecheckDto {
  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: LOGIN_SURFACES,
    example: 'portal',
    description: 'The login door the user is standing at.',
  })
  @IsIn(LOGIN_SURFACES)
  surface!: LoginSurface;
}
