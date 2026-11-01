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
export { periodStart, nextPeriod } from "./public/periods.js";
export function occurrences(rule, from, to) {
  const result = [];
  // Keep the existing scheduled-date key format; rule edits remap saved states atomically.
  for (let i = 0; i < 30000; i++) {
    const info = occurrenceInfo(
      rule.start_on,
      rule.frequency,
      i,
      rule.day_adjust || "none",
      !!rule.calendar_legacy,
      !!rule.calendar_legacy,
      rule.second_day,
    );
    if (info.date > to) break;
    if (info.date >= from)
      result.push({
        key: rule.id + ":" + info.date,
        rule_id: rule.id,
        date: info.date,
        original_on: info.date,
        ...(rule.frequency === "rrq" ? { estimated: info.estimated } : {}),
        ...(info.nominal !== info.date ? { nominal_on: info.nominal } : {}),
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
