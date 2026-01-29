export function sanitizeFilename(name: string) {
  const base = (name || "arquivo")
    .replace(/[^\p{L}\p{N}\-._ ]/gu, "")
    .trim()
    .slice(0, 120);
  return base.length ? base : "arquivo";
}

