import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { checkCustomScripts } from '@/common/utils/custom-scripts.util';

/**
 * class-validator decorator for an admin-pasted vendor snippet
 * (`CustomScript.code`). Runs the structural allowlist in
 * `common/utils/custom-scripts.util.ts` and surfaces its reason verbatim, so the
 * admin gets "<base> is not allowed" in the 400 instead of a generic
 * "code is invalid" they cannot act on.
 *
 * The check is structural only - it can never validate what the JavaScript
 * DOES. Read the header of custom-scripts.util.ts for what that means and why
 * `MANAGE_SETTINGS` is the actual control.
 */
export function IsSafeCustomScript(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeCustomScript',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return checkCustomScripts(value).ok;
        },
        defaultMessage(args: ValidationArguments) {
          if (typeof args.value !== 'string') {
            return `${args.property} must be a string`;
          }
          return (
            checkCustomScripts(args.value).reason ??
            `${args.property} is not a valid script block`
          );
        },
      },
    });
  };
}
