'use client';

import { useMemo } from 'react';

interface Props {
  data:       number[];
  width?:     number;
  height?:    number;
  color?:     string;
  fillColor?: string;
}

export function SparkLine({ data, width = 120, height = 32, color = '#a855f7', fillColor }: Props) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const xStep = width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * xStep;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    const linePath = `M ${points.join(' L ')}`;
    if (!fillColor) return linePath;

    const last  = points[points.length - 1].split(',');
    const first = points[0].split(',');
    return `${linePath} L ${last[0]},${height} L ${first[0]},${height} Z`;
  }, [data, width, height, fillColor]);

  if (!path) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      {fillColor && (
        <path d={path} fill={fillColor} opacity={0.2} />
      )}
      <path
        d={path.split(' L ').slice(0, data.length).join(' L ')}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
