import { describe, expect, it } from 'vitest';
import {
    ApiError,
    humaneMessage,
    SERVER_MESSAGE,
    SESSION_MESSAGE,
    THROTTLE_MESSAGE,
} from './humane-error';

describe('humaneMessage', () => {
    it('rewrites the bare 500 fallback instead of printing "Internal server error"', () => {
        expect(
            humaneMessage(500, { statusCode: 500, message: 'Internal server error' }),
        ).toBe(SERVER_MESSAGE);
        expect(humaneMessage(500, undefined)).toBe(SERVER_MESSAGE);
        expect(humaneMessage(502, null)).toBe(SERVER_MESSAGE);
    });

    it('keeps deliberate 5xx copy (the backend answers 503 with real sentences)', () => {
        const copy =
            'The AI provider rejected the API key - check it under Settings.';
        expect(humaneMessage(503, { message: copy })).toBe(copy);
    });

    it('passes 4xx business copy through verbatim', () => {
        const copy = 'This operator still has 3 live tours - deactivate it instead.';
        expect(humaneMessage(409, { message: copy })).toBe(copy);
    });

    it('joins validation arrays and caps them at three lines', () => {
        expect(
            humaneMessage(400, { message: ['name should not be empty', 'price must be positive'] }),
        ).toBe('name should not be empty; price must be positive');
        expect(
            humaneMessage(400, { message: ['a', 'b', 'c', 'd', 'e'] }),
        ).toBe('a; b; c (+2 more)');
    });

    it('maps throttling to a wait message regardless of phrasing', () => {
        expect(humaneMessage(429, { message: 'ThrottlerException: Too Many Requests' })).toBe(
            THROTTLE_MESSAGE,
        );
        expect(humaneMessage(429, undefined)).toBe(THROTTLE_MESSAGE);
    });

    it('turns bare framework 401/403 into instructions, but keeps real copy', () => {
        expect(humaneMessage(401, { message: 'Unauthorized' })).toBe(SESSION_MESSAGE);
        expect(humaneMessage(401, { message: 'Current password is incorrect.' })).toBe(
            'Current password is incorrect.',
        );
        expect(humaneMessage(403, { message: 'Forbidden resource' })).toBe(
            "You don't have permission to do that.",
        );
        expect(
            humaneMessage(403, { message: 'Only admins can verify operators.' }),
        ).toBe('Only admins can verify operators.');
    });

    it('gives empty bodies a status-appropriate fallback', () => {
        expect(humaneMessage(404, undefined)).toBe(
            'That record could not be found - it may have been deleted in the meantime.',
        );
        expect(humaneMessage(418, undefined)).toBe(
            'The request failed (HTTP 418). Try again.',
        );
    });
});

describe('ApiError', () => {
    it('is an Error (existing `err instanceof Error` guards keep working) and carries the status', () => {
        const err = new ApiError('msg', 409, { message: 'msg' });
        expect(err).toBeInstanceOf(Error);
        expect(err.status).toBe(409);
        expect(err.message).toBe('msg');
    });
});
