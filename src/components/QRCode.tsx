'use client';

import { useMemo } from 'react';
import { encodeQR } from '@/src/lib/qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  /** Foreground module color. Defaults to ink-900 for max scan contrast. */
  fg?: string;
  bg?: string;
}

/**
 * Self-contained SVG QR code renderer — no runtime CDN dependency. Encoding
 * happens in src/lib/qrcode.ts (vendored MIT-licensed algorithm).
 */
export default function QRCode({ value, size = 200, className = '', fg = '#0B0F19', bg = '#FFFFFF' }: QRCodeProps) {
  const matrix = useMemo(() => encodeQR(value, 'M'), [value]);
  const moduleCount = matrix.length;
  // Quiet zone of 4 modules per spec, on all sides.
  const quiet = 4;
  const dim = moduleCount + quiet * 2;

  const path = useMemo(() => {
    let d = '';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          d += `M${c + quiet},${r + quiet}h1v1h-1z`;
        }
      }
    }
    return d;
  }, [matrix, moduleCount]);

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="QR code linking to the team portal"
      shapeRendering="crispEdges"
    >
      <rect width={dim} height={dim} fill={bg} />
      <path d={path} fill={fg} />
    </svg>
  );
}
