import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const size = Math.min(
    512,
    Math.max(16, parseInt(request.nextUrl.searchParams.get('size') ?? '192', 10))
  );
  const r = Math.round(size * 0.18); // border-radius

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #1e40af 0%, #1e3a8a 60%, #172554 100%)',
          borderRadius: r,
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: Math.round(size * 0.38),
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          MB
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
