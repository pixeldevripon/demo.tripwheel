import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OCTO_ERROR, OctoException, OctoExceptionFilter } from './octo-error';

function mockHost(): {
  host: ArgumentsHost;
  res: { status: jest.Mock; json: jest.Mock };
} {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('OctoException factories', () => {
  it('invalidTourId → 400 + flat envelope with context', () => {
    const ex = OctoException.invalidTourId('t-1');
    expect(ex.getStatus()).toBe(400);
    expect(ex.getResponse()).toEqual({
      error: OCTO_ERROR.INVALID_TOUR_ID,
      errorMessage: 'The tourId is invalid.',
      tourId: 't-1',
    });
  });

  it('unprocessable → 422', () => {
    const ex = OctoException.unprocessable('Sold out', {
      availabilityId: 'a-1',
    });
    expect(ex.getStatus()).toBe(422);
    expect(ex.getResponse()).toMatchObject({
      error: OCTO_ERROR.UNPROCESSABLE_ENTITY,
      availabilityId: 'a-1',
    });
  });
});

describe('OctoExceptionFilter', () => {
  let filter: OctoExceptionFilter;
  beforeEach(() => {
    filter = new OctoExceptionFilter();
  });

  it('emits an OctoException body verbatim', () => {
    const { host, res } = mockHost();
    filter.catch(OctoException.invalidOptionId('o-1'), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: OCTO_ERROR.INVALID_OPTION_ID,
      errorMessage: 'The optionId is invalid.',
      optionId: 'o-1',
    });
  });

  it('maps a generic NotFoundException → BAD_REQUEST (OCTO has no 404)', () => {
    const { host, res } = mockHost();
    filter.catch(new NotFoundException('nope'), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: OCTO_ERROR.BAD_REQUEST,
      errorMessage: 'nope',
    });
  });

  it('maps ForbiddenException → FORBIDDEN', () => {
    const { host, res } = mockHost();
    filter.catch(new ForbiddenException(), host);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: OCTO_ERROR.FORBIDDEN }),
    );
  });

  it('flattens a ValidationPipe message array', () => {
    const { host, res } = mockHost();
    filter.catch(
      new BadRequestException({
        message: ['a must be a string', 'b is required'],
      }),
      host,
    );
    expect(res.json).toHaveBeenCalledWith({
      error: OCTO_ERROR.BAD_REQUEST,
      errorMessage: 'a must be a string; b is required',
    });
  });

  it('maps an unknown error → 500 without leaking internals', () => {
    const { host, res } = mockHost();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('boom: secret stack'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: OCTO_ERROR.INTERNAL_SERVER_ERROR,
      errorMessage: 'An unexpected error occurred.',
    });
  });
});
