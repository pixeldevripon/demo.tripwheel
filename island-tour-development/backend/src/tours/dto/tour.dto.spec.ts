import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTourDto, UpdateTourDto } from './tour.dto';

/**
 * Pastel #22: `instantConfirmation` must never be client-writable. Every
 * consumer surface promises instant confirmation ("Confirmed in seconds" on
 * All Tours) and there is no request-to-book flow behind an off state - so the
 * field is gone from both write DTOs and the global ValidationPipe
 * (`whitelist` + `forbidNonWhitelisted`) 400s any body that still carries it.
 * These tests mirror the pipe's options exactly; if the field is ever re-added
 * to a DTO they fail, forcing the full pending-booking spec first.
 */
async function whitelistErrorsFor(
  cls: ClassConstructor<CreateTourDto | UpdateTourDto>,
  payload: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors
    .filter((e) => e.constraints?.whitelistValidation)
    .map((e) => e.property);
}

describe('tour write DTOs - instantConfirmation is not client-writable (Pastel #22)', () => {
  it('UpdateTourDto rejects the key outright', async () => {
    expect(
      await whitelistErrorsFor(UpdateTourDto, { instantConfirmation: false }),
    ).toEqual(['instantConfirmation']);
  });

  it('UpdateTourDto rejects it even when set to true', async () => {
    expect(
      await whitelistErrorsFor(UpdateTourDto, { instantConfirmation: true }),
    ).toEqual(['instantConfirmation']);
  });

  it('CreateTourDto rejects the key outright', async () => {
    expect(
      await whitelistErrorsFor(CreateTourDto, { instantConfirmation: false }),
    ).toEqual(['instantConfirmation']);
  });

  it('an UpdateTourDto body without the key stays clean', async () => {
    expect(
      await whitelistErrorsFor(UpdateTourDto, { weatherDependent: true }),
    ).toEqual([]);
  });
});
