import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/auth/decorators/public.decorator';
import { LoginPrecheckDto } from './dto/login-precheck.dto';
import { ApiLoginPrecheckDocs } from './login-precheck.swagger';
import { LoginPrecheckService } from './login-precheck.service';

/**
 * Public pre-login check, mounted under the api/v1 prefix (unlike the Better
 * Auth catch-all). Throttled to sign-in's budget - it reveals door hints for
 * known emails, so it must never be cheaper to hammer than sign-in.
 */
@ApiTags('Auth')
@Controller('auth')
export class LoginPrecheckController {
  constructor(private readonly loginPrecheckService: LoginPrecheckService) {}

  @Post('login-precheck')
  @Public()
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiLoginPrecheckDocs()
  precheck(@Body() dto: LoginPrecheckDto) {
    return this.loginPrecheckService.precheck(dto);
  }
}
