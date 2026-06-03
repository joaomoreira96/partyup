import type { Dictionary } from "@/i18n/dictionaries/pt";

type DictValue = string | { [key: string]: DictValue };

export function translate(
  dict: Dictionary,
  key: string,
  params?: Record<string, string | number>
): string {
  const parts = key.split(".");
  let current: DictValue = dict as DictValue;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return key;
    }
    current = current[part];
  }

  if (typeof current !== "string") return key;

  if (!params) return current;

  return current.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value !== undefined ? String(value) : `{${name}}`;
  });
}
