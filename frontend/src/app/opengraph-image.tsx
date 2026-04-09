import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'linear-gradient(135deg, rgb(15, 23, 42) 0%, rgb(30, 64, 175) 45%, rgb(14, 165, 233) 100%)',
          color: 'white',
          padding: 56,
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              opacity: 0.92,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Buy on Sedifex
          </div>
          <div style={{ fontSize: 70, lineHeight: 1.05, fontWeight: 800, maxWidth: 920 }}>
            Discover products from businesses across Ghana
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, opacity: 0.9 }}>
          <span>Promote your store</span>
          <span>Order via WhatsApp</span>
          <span>Built for Ghana</span>
        </div>
      </div>
    ),
    size,
  );
}
