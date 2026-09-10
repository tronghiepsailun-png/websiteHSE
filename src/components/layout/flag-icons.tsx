// Small inline SVG flags — used instead of emoji flags because Windows' bundled emoji font
// has historically rendered regional-indicator emoji (🇻🇳/🇨🇳) as plain two-letter text
// instead of an actual flag glyph, which this app's users are likely to hit.
function starPoints(cx: number, cy: number, outerR: number, innerR: number, rotationDeg = -90) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = ((rotationDeg + i * 36) * Math.PI) / 180;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(" ");
}

export function VietnamFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon points={starPoints(15, 10, 6, 2.4)} fill="#FFCD00" />
    </svg>
  );
}

export function ChinaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#DE2910" />
      <polygon points={starPoints(6.5, 5, 3.2, 1.28)} fill="#FFDE00" />
      {[
        { cx: 12, cy: 2.2, angle: 26 },
        { cx: 13.7, cy: 5, angle: 60 },
        { cx: 13.7, cy: 8.4, angle: 100 },
        { cx: 12, cy: 11, angle: 128 },
      ].map((s, i) => (
        <polygon key={i} points={starPoints(s.cx, s.cy, 1.1, 0.44, s.angle)} fill="#FFDE00" />
      ))}
    </svg>
  );
}
