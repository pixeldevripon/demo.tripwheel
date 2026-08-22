import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * The filter's contract: whatever leaves it as `message` must be words a user
 * can act on. Prisma constraint errors used to fall through as a bare
 * 500 "Internal server error"; these tests pin the mapping.
 */
describe('AllExceptionsFilter - Prisma mapping', () => {
  const filter = new AllExceptionsFilter();

  function run(exception: unknown): { status: number; body: any } {
    let status = 0;
    let body: any;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
      },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'DELETE', url: '/api/v1/operators/x' }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    return { status, body };
  }

  function prismaError(
    code: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('db says no', {
      code,
      clientVersion: 'test',
      meta,
    });
  }

  it('maps P2003 (FK restrict) to a 409 naming the blocking table', () => {
    const { status, body } = run(
      prismaError('P2003', { constraint: 'bookings_operatorId_fkey' }),
    );
    expect(status).toBe(409);
    expect(body.message).toContain('existing bookings');
    expect(body.message).not.toContain('Internal server error');
  });

  it('maps P2003 with only field_name meta (older engines)', () => {
    const { status, body } = run(
      prismaError('P2003', { field_name: 'tour_categories_categoryId_fkey' }),
    );
    expect(status).toBe(409);
    expect(body.message).toContain('existing tour categories');
  });

  it('maps P2002 (unique) to a 409 naming the duplicate fields', () => {
    const { status, body } = run(prismaError('P2002', { target: ['slug'] }));
    expect(status).toBe(409);
    expect(body.message).toContain('slug');
    expect(body.message).toContain('already exists');
  });

  it('maps P2025 (row vanished) to a 404 with refresh advice', () => {
    const { status, body } = run(prismaError('P2025'));
    expect(status).toBe(404);
    expect(body.message).toContain('no longer exists');
  });

  it('leaves unrecognised Prisma codes as the generic 500', () => {
    const { status, body } = run(prismaError('P1001'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it('keeps HttpException copy verbatim (business messages own their words)', () => {
    const { status, body } = run(
      new ConflictException('This operator still has 2 tours.'),
    );
    expect(status).toBe(409);
    expect(body.message).toBe('This operator still has 2 tours.');
  });

  it('keeps flattening unknown plain Errors to the generic 500', () => {
    const { status, body } = run(new Error('ECONNREFUSED 10.0.0.3:5432'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });
});
