export function jsonErr(e: unknown): string {
  if (!e) return "Неизвестная ошибка";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function toNum(v: string): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return n;
}
