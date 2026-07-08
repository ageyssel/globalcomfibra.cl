export function formatClp(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}${value.length === 10 ? "T12:00:00" : ""}`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(date);
}

export function normalizeRut(value: string) {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
