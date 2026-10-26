/** Progress ring: the app's one visual motif. Value 0–100. */
export function Ring({ value, size = 44, stroke = 5, color = "var(--accent)", label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${v}% mastered`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        {v > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
        )}
      </svg>
      {size >= 40 && <span className="absolute text-[11px] font-semibold tabular-nums text-ink" aria-hidden>{v}</span>}
    </span>
  );
}
