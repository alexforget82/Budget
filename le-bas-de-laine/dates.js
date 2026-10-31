import { occurrenceInfo } from "./calendar.js";
export const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export const addDays = (s, n) =>
  new Date(Date.parse(s + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function periodStart(category, date) {
  if (category.period === "weekly") {
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    return addDays(date, -((weekday - category.renewal_day + 7) % 7));
  }
  if (category.period === "monthly") {
    const day = Math.min(
      category.renewal_day,
      new Date(
        Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 0, 12),
      ).getUTCDate(),
    );
    const start = date.slice(0, 8) + String(day).padStart(2, "0");
    if (start <= date) return start;
    const d = new Date(date.slice(0, 8) + "01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 1);
    return (
      d.toISOString().slice(0, 8) +
      String(
        Math.min(
          category.renewal_day,
          new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
          ).getUTCDate(),
        ),
      ).padStart(2, "0")
    );
  }
  return null;
}
export function nextPeriod(category, start) {
  if (category.period === "weekly") return addDays(start, 7);
  const d = new Date(start.slice(0, 8) + "01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return (
    d.toISOString().slice(0, 8) +
    String(
      Math.min(
        category.renewal_day,
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    ).padStart(2, "0")
  );
}
export function occurrences(rule, from, to) {
  const result = [];
  // Nominal occurrence keys remain stable when a date is shifted.
  for (let i = 0; i < 30000; i++) {
    const info = occurrenceInfo(
      rule.start_on,
      rule.frequency,
      i,
      rule.day_adjust || "none",
    );
    if (info.date > to) break;
    if (info.date >= from)
      result.push({
        key: rule.id + ":" + info.date,
        rule_id: rule.id,
        date: info.date,
        original_on: info.date,
        name: rule.name,
        kind: rule.kind,
        amount_cents: rule.amount_cents,
        account_id: rule.account_id,
        to_account_id: rule.to_account_id,
        category_id: rule.category_id,
      });
    if (rule.one_time) break;
  }
  return result;
}
