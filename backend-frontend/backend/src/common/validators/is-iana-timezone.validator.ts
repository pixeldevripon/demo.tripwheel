import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * The canonical IANA zone identifiers this runtime knows, e.g. `America/Curacao`.
 * Lazily built once. `Intl.supportedValuesOf` returns only primary identifiers,
 * so it excludes the ambiguous legacy abbreviations (`AST`, `EST`, `GMT`) that
 * `Intl.DateTimeFormat` would otherwise silently accept.
 */
let ianaZones: Set<string> | null = null;
function getIanaZones(): Set<string> | null {
  if (ianaZones) return ianaZones;
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported !== 'function') return null; // pre-Node-18 fallback below
  ianaZones = new Set(supported('timeZone'));
  return ianaZones;
}

/**
 * True when `value` is a real IANA timezone name (e.g. `America/Curacao`, or
 * `UTC`). Rejects offset labels (`UTC-4`, `+4`), legacy abbreviations (`AST`,
 * `EST`, `GMT`), human labels (`Curacao`), empty strings, and stray whitespace.
 *
 * We must always anchor tour/departure math to an IANA *rule set*, never a
 * fixed offset - only the zone name knows the correct offset at a given
 * instant (DST + historical changes). See `common/utils/timezone.util.ts`.
 */
export function isValidIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.trim() !== value || value.length === 0) return false;
  if (value === 'UTC') return true; // canonical, but not enumerated by supportedValuesOf

  const zones = getIanaZones();
  if (zones) return zones.has(value);

  // Fallback for runtimes without supportedValuesOf: at least reject the
  // obvious offset/abbreviation shapes, then defer to Intl.
  if (!value.includes('/')) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * class-validator decorator: the field must be a valid IANA timezone name.
 * Pair with `@IsOptional()` for nullable fields - it only runs when a value
 * is present.
 */
export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return isValidIanaTimeZone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA timezone name (e.g. "America/Curacao"), not an offset like "UTC-4" or "+4"`;
        },
      },
    });
  };
}

/**
 * Known launch-destination timezones, keyed by destination slug. Used to
 * derive a destination's timezone when an admin omits it on create, so a
 * launch island can never silently fall back to Curaçao's clock.
 */
export const DEFAULT_DESTINATION_TIMEZONES: Record<string, string> = {
  curacao: 'America/Curacao',
  aruba: 'America/Aruba',
  'sint-maarten': 'America/Lower_Princes',
  'saint-lucia': 'America/St_Lucia',
  bahamas: 'America/Nassau',
};
