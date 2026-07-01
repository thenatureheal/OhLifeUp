/** Format an ISO date string as YYYY-MM-DD. */
export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Mask an author name: keep first char, replace the rest with asterisks. */
export function maskName(name = ""): string {
  return name.length <= 1 ? name : name[0] + "*".repeat(name.length - 1);
}
