import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof responseBody === 'string'
        ? responseBody
        : typeof responseBody === 'object' &&
            responseBody !== null &&
            'message' in responseBody
          ? (responseBody as Record<string, unknown>).message
          : 'Internal server error';

    // A machine-readable discriminator some endpoints attach to an ambiguous
    // status (e.g. the OTP request's 429 `reason: 'otp-pending'`, which the
    // login card must tell apart from the generic per-IP throttle). Carried
    // through verbatim - this filter otherwise rebuilds the body and would
    // silently strip it.
    const reason =
      typeof responseBody === 'object' &&
      responseBody !== null &&
      'reason' in responseBody
        ? (responseBody as Record<string, unknown>).reason
        : undefined;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message,
      ...(reason !== undefined ? { reason } : {}),
    });
  }
}
