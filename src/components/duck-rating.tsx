export function DuckRating({
  score,
  size = 16,
}: {
  score: number;
  size?: number;
}) {
  const safe = Math.max(0, Math.min(5, score));
  return (
    <span
      className="rating"
      style={{ ["--r" as string]: safe, width: size * 5, height: size }}
      aria-label={`${safe} of 5`}
    />
  );
}
