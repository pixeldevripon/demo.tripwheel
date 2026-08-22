import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as publicly accessible - skips AuthGuard session validation.
 *
 * Use for health checks, public browsing endpoints, and webhook receivers.
 *
 * @example
 *   @Public()
 *   @Get('/health')
 *   healthCheck() {}
 *
 *   @Public()
 *   @SkipThrottle()
 *   @Post('/webhooks/stripe')
 *   stripeWebhook() {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
