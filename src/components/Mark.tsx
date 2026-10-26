export function Mark({ size = 26 }: { size?: number }) {
  // A ring with one orange arc — the progress motif as the logo.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M16 4a12 12 0 0 1 12 12" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

