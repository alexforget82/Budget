// Boundary validation, before any ledger mutation. Never silently round fractional cents.
export function toCents(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) >= 100000000
  )
    return null;
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const decimals = (mantissa.split(".")[1] || "").length - Number(exponent);
  if (decimals > 2) return null;
  return Math.round(value * 100);
}
