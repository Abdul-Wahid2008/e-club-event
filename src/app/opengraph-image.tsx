import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'The Pitch League — NIT Warangal Startup Competition';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Composes the flame mark + wordmark on the Arena Glass gradient (same
// bg-base/brand/accent tokens as tailwind.config.js) so the WhatsApp share
// preview matches the app's real visual identity instead of a generic
// default card -- this link is going straight into WhatsApp groups where
// the preview card IS the pitch for whether someone taps it.
export default async function OpengraphImage() {
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
          background: 'radial-gradient(circle at 30% 20%, #1a2440 0%, #0A0E17 55%, #0A0E17 100%)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,75,62,0.35) 0%, rgba(255,75,62,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -140,
            left: -100,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91,124,250,0.35) 0%, rgba(91,124,250,0) 70%)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 32,
            background: 'linear-gradient(135deg, #5B7CFA 0%, #FF4B3E 55%, #FFB020 100%)',
            boxShadow: '0 0 60px rgba(91,124,250,0.45)',
            marginBottom: 36,
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C12 2 6 8 6 13a6 6 0 1012 0c0-2-1-4-2.5-5.5C14.5 9 13 7 13 4.5c0-1-.5-2-1-2.5z"
              fill="white"
            />
          </svg>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -1,
            color: '#F7F8FC',
            textAlign: 'center',
          }}
        >
          THE PITCH LEAGUE
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 600,
            color: '#FFB020',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          NIT Warangal&apos;s Live Startup Pitch Arena
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: '#9AA3B8',
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          Register solo or as a team — no deadline, no cap
        </div>
      </div>
    ),
    { ...size }
  );
}
