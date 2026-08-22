import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * OCTO error envelope (spec §9).
 *
 * ## What it does
 * OCTO returns a **flat** error object `{ error, errorMessage, <context…> }` - NOT
 * the native NestJS `{ statusCode, timestamp, path, message }` shape produced by
 * `AllExceptionsFilter`. `OctoException` carries the OCTO code + HTTP status +
 * optional context (tourId/optionId/unitId/availabilityId/uuid). `OctoExceptionFilter`
 * renders that flat body and is bound **per-controller** (`@UseFilters`) so only the
 * `/api/v1/octo/**` surface gets the OCTO envelope; the rest of `/api/v1` keeps its
 * native one.
 *
 * ## Usage
 * Throw `OctoException.invalidTourId(id)` etc. from OCTO services/controllers, and
 * decorate every OCTO controller with `@UseFilters(OctoExceptionFilter)`.
 */

/** OCTO error codes (spec §9) - `tour` substituted for `product` per our naming. */
export const OCTO_ERROR = {
  INVALID_TOUR_ID: 'INVALID_TOUR_ID',
  INVALID_OPTION_ID: 'INVALID_OPTION_ID',
  INVALID_UNIT_ID: 'INVALID_UNIT_ID',
  INVALID_AVAILABILITY_ID: 'INVALID_AVAILABILITY_ID',
  INVALID_BOOKING_UUID: 'INVALID_BOOKING_UUID',
  BAD_REQUEST: 'BAD_REQUEST',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type OctoErrorCode = (typeof OCTO_ERROR)[keyof typeof OCTO_ERROR];

/** Optional context fields surfaced alongside the error (spec §9). */
export type OctoErrorContext = Record<string, string | number | boolean>;

interface OctoErrorBody {
  error: OctoErrorCode;
  errorMessage: string;
  [key: string]: unknown;
}

/** An HttpException whose response body is already an OCTO-shaped flat error. */
export class OctoException extends HttpException {
  constructor(
    status: HttpStatus,
    error: OctoErrorCode,
    errorMessage: string,
    context: OctoErrorContext = {},
  ) {
    super({ error, errorMessage, ...context } satisfies OctoErrorBody, status);
  }

  static invalidTourId(tourId: string): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.INVALID_TOUR_ID,
      'The tourId is invalid.',
      { tourId },
    );
  }

  static invalidOptionId(optionId: string): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.INVALID_OPTION_ID,
      'The optionId is invalid.',
      { optionId },
    );
  }

  static invalidUnitId(unitId: string): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.INVALID_UNIT_ID,
      'The unitId is invalid.',
      { unitId },
    );
  }

  static invalidAvailabilityId(availabilityId: string): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.INVALID_AVAILABILITY_ID,
      'The availabilityId is invalid.',
      { availabilityId },
    );
  }

  static invalidBookingUuid(uuid: string): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.INVALID_BOOKING_UUID,
      'The booking uuid is invalid.',
      { uuid },
    );
  }

  static unprocessable(
    errorMessage: string,
    context: OctoErrorContext = {},
  ): OctoException {
    return new OctoException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      OCTO_ERROR.UNPROCESSABLE_ENTITY,
      errorMessage,
      context,
    );
  }

  static badRequest(
    errorMessage: string,
    context: OctoErrorContext = {},
  ): OctoException {
    return new OctoException(
      HttpStatus.BAD_REQUEST,
      OCTO_ERROR.BAD_REQUEST,
      errorMessage,
      context,
    );
  }
}

/** Maps a generic HTTP status to the closest OCTO error code (spec §9 table). */
function codeForStatus(status: number): OctoErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return OCTO_ERROR.BAD_REQUEST;
    case HttpStatus.UNAUTHORIZED:
      return OCTO_ERROR.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return OCTO_ERROR.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      // OCTO has no NOT_FOUND; an unknown id is a bad request.
      return OCTO_ERROR.BAD_REQUEST;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return OCTO_ERROR.UNPROCESSABLE_ENTITY;
    default:
      return status >= 500
        ? OCTO_ERROR.INTERNAL_SERVER_ERROR
        : OCTO_ERROR.BAD_REQUEST;
  }
}

/**
 * Renders the flat OCTO error envelope. Bound per-OCTO-controller via `@UseFilters`
 * so it never affects the native `/api/v1` surface.
 */
@Catch()
export class OctoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OctoExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Already an OCTO-shaped body (from OctoException) → emit verbatim.
    if (exception instanceof OctoException) {
      const status = exception.getStatus();
      res.status(status).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const errorMessage =
        typeof body === 'string'
          ? body
          : (extractMessage((body as Record<string, unknown>)?.message) ??
            exception.message);
      res.status(status).json({
        error: codeForStatus(status),
        errorMessage,
      });
      return;
    }

    // Unknown / programmer error → 500, do not leak internals.
    this.logger.error(
      'Unhandled OCTO error',
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: OCTO_ERROR.INTERNAL_SERVER_ERROR,
      errorMessage: 'An unexpected error occurred.',
    });
  }
}

/** ValidationPipe puts an array of messages under `message`; flatten to one string. */
function extractMessage(message: unknown): string | null {
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string') return message;
  return null;
}
