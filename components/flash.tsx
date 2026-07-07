export function Flash({ error, good }: { error?: string; good?: string }) {
  if (error) return <p className="notice">{error}</p>;
  if (good) return <p className="notice good">{good}</p>;
  return null;
}
