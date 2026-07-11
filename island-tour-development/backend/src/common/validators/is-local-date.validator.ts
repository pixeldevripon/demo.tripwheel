import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when `value` is a strict `YYYY-MM-DD` calendar date - and a real one
 * (rejects `2026-13-40`). Unlike `@IsDateString()` it refuses full ISO
 * timestamps (`2026-07-01T00:00:00Z`), which is what we want for destination-
 * local calendar fields: the value is a wall-clock day, never an instant.
 */
export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trip through UTC parts so the components must form a real date
  // (e.g. Feb 30 collapses to Mar and fails the equality check).
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * class-validator decorator: the field must be a strict `YYYY-MM-DD` calendar
 * date. Pair with `@IsOptional()` for nullable fields.
 */
export function IsLocalDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLocalDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isValidLocalDate(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a calendar date in YYYY-MM-DD format (not a timestamp)`;
        },
      },
    });
  };
}
