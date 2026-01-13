'use client';

import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface QRCodeDisplayProps {
  url: string;
  gameCode: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({ url, gameCode, size = 200, className }: QRCodeDisplayProps) {
  const fullUrl = `${url}?code=${gameCode}`;
  
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="qr-container">
        <QRCodeSVG
          value={fullUrl}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      
      <div className="text-center">
        <p className="text-sm text-gray-500 mb-1">Scan to join or enter code:</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-primary-600">
          {gameCode}
        </p>
      </div>
    </div>
  );
}
