export function HeartIcon({ className = "heart-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 10.2 1.7 6.1a2.3 2.3 0 0 1 3.2-3.3L6 3.8l1.1-1a2.3 2.3 0 0 1 3.2 3.3L6 10.2Z" fill="currentColor" />
    </svg>
  );
}
