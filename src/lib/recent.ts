/**
 * Markets this browser opened recently (ids only, newest first), so tools like
 * Hedge Lab can offer "the market you were just looking at". Local only.
 */
const KEY = "hp_recent";
const MAX = 8;

export function recentIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberMarket(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...recentIds().filter((x) => x !== id)].slice(0, MAX)));
  } catch {
    /* private mode: nothing to remember */
  }
}
