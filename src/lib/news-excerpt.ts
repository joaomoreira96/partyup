export function newsExcerpt(content: string, maxLength = 160): string {
  const plain = content.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}
