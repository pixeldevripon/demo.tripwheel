import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Turn "bookings_operatorId_fkey" / "tour_categories_categoryId_fkey" into
 * the noun a user can act on ("existing bookings", "existing tour
 * categories"). Prisma puts the constraint name in `meta.constraint` (newer
 * engines) or `meta.field_name` (older).
 */
function fkNoun(meta: Record<string, unknown> | undefined): string {
  const raw =
    typeof meta?.constraint === 'string'
      ? meta.constraint
      : typeof meta?.field_name === 'string'
        ? meta.field_name
        : '';
  const table = raw
    .replace(/_[A-Za-z]+_fkey$/, '')
    .replaceAll('_', ' ')
    .trim();
  return table ? `existing ${table}` : 'other records';
}

/**
 * Prisma constraint errors are almost always USER-CAUSED (delete something
 * still referenced, create a duplicate, act on a row someone else removed),
 * yet as plain Errors they used to fall through this filter as a bare
 * `500 Internal server error`. Map the actionable codes to readable HTTP
 * errors; anything unrecognised still becomes the generic 500.
 */
function mapPrismaError(
  e: Prisma.PrismaClientKnownRequestError,
): { status: number; message: string } | null {
  const meta = e.meta;
  switch (e.code) {
    case 'P2002': {
      const target = meta?.target;
      const fields = Array.isArray(target)
        ? (target as string[]).join(', ')
        : typeof target === 'string'
          ? target
          : '';
      return {
        status: HttpStatus.CONFLICT,
        message: fields
          ? `A record with the same ${fields} already exists.`
          : 'A record with the same unique value already exists.',
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        message: `This record is still linked to ${fkNoun(meta)}, so it can't be deleted. Remove or reassign what depends on it first.`,
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message:
          'That record no longer exists - it may have been deleted by someone else. Refresh and try again.',
      };
    case 'P2014':
      return {
        status: HttpStatus.CONFLICT,
        message:
          "The change would break a required link between records, so it wasn't applied.",
      };
    default:
      return null;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const prismaMapped =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? mapPrismaError(exception)
        : null;

    const status = prismaMapped
      ? prismaMapped.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message = prismaMapped
      ? prismaMapped.message
      : typeof responseBody === 'string'
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
