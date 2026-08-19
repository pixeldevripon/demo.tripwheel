import { ImageResponse } from 'next/og';

/**
 * Social share card, generated at request time by next/og. Mirrors the hero:
 * deep teal-blue gradient, wordmark, tagline. Referenced automatically as
 * og:image (and explicitly as the twitter image in app/layout.tsx).
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'TripWheel - The growth platform for modern travel agencies';

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                        'linear-gradient(180deg, #0e2537 0%, #114d70 55%, #1f79a6 100%)',
                    color: '#ffffff',
                    fontSize: 72,
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                }}>
                <div style={{ display: 'flex' }}>TripWheel</div>
                <div
                    style={{
                        display: 'flex',
                        marginTop: 28,
                        fontSize: 32,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        color: 'rgba(235, 234, 252, 0.85)',
                    }}>
                    The growth platform for modern travel agencies
                </div>
            </div>
        ),
        size
    );
}
