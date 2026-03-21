export function generateFilename(
  from: string,
  to: string,
  tmmsId: string,
  createdAt: string,
): string {
  const date = new Date(createdAt);
  const datePart = formatDatePart(date);
  const shortId = tmmsId.slice(0, 8);
  const safFrom = sanitizeName(from);
  const safeTo = sanitizeName(to);
  return `${datePart}_${safFrom}_to_${safeTo}_${shortId}.md`;
}

function formatDatePart(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function sanitizeName(name: string): string {
  // Replace characters that are problematic in filenames with hyphens
  return name.replace(/[/\\:*?"<>|]/g, "-");
}
