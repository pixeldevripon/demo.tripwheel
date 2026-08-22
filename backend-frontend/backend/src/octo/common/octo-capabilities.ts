import {
  Injectable,
  NestMiddleware,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * OCTO capabilities (the core content/pricing negotiation mechanism).
 *
 * ## What it does
 * Core (no capabilities) returns only the mandatory OCTO fields. Each enabled
 * capability unlocks an extra block of fields on the serialized objects. The
 * consumer opts in via the `Octo-Capabilities` request header (comma-separated)
 * or the equivalent `_capabilities` query param; the server echoes the active
 * set back in the `Octo-Capabilities` response header.
 *
 * ## Usage
 * `OctoCapabilitiesMiddleware` populates `req.octoCapabilities` (a `Set<string>`)
 * and echoes the response header. Controllers read it via the `@OctoCaps()`
 * param decorator and pass it to the serializers, which gate fields with `has()`.
 */
export const OCTO_CAP = {
  CONTENT: 'octo/content',
  PRICING: 'octo/pricing',
  PICKUPS: 'octo/pickups',
  DROPOFFS: 'octo/dropoffs',
  NOTIFICATIONS: 'octo/notifications',
} as const;

export type OctoCapability = (typeof OCTO_CAP)[keyof typeof OCTO_CAP];

/** Capabilities this server recognises (unknown ones are ignored, never echoed). */
const SUPPORTED: ReadonlySet<string> = new Set(Object.values(OCTO_CAP));

export type OctoCapabilitySet = Set<string>;

/** Request with the capability set attached by {@link OctoCapabilitiesMiddleware}. */
type RequestWithCaps = Request & { octoCapabilities?: OctoCapabilitySet };

function parseList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class OctoCapabilitiesMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['octo-capabilities'];
    const fromHeader = parseList(
      Array.isArray(header) ? header.join(',') : header,
    );
    const fromQuery = parseList(req.query?._capabilities);

    const active = new Set<string>(
      [...fromHeader, ...fromQuery].filter((c) => SUPPORTED.has(c)),
    );

    (req as RequestWithCaps).octoCapabilities = active;
    // Echo the initialized capabilities (OCTO contract).
    res.setHeader('Octo-Capabilities', [...active].join(', '));
    next();
  }
}

/** Injects the active OCTO capability set (defaults to an empty set = core only). */
export const OctoCaps = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OctoCapabilitySet => {
    const req = ctx.switchToHttp().getRequest<RequestWithCaps>();
    return req.octoCapabilities ?? new Set<string>();
  },
);
