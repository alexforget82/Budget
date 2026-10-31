import { occurrenceInfo } from "./calendar.js";
// Calendar 0.4.0 also closed June 24. Preserve saved decisions by occurrence index,
// never by changing the actual purchase date or amount.
export function calendarStateChanges(state, onlyIds = null) {
  const changes = [];
  for (const rule of state.recurrences) {
    if (onlyIds && !onlyIds.has(rule.id)) continue;
    const rows = state.occurrence_states
      .filter((s) => s.rule_id === rule.id)
      .sort((a, b) => a.original_on.localeCompare(b.original_on));
    if (!rows.length) continue;
    const keys = new Map();
    const last = rows.at(-1).original_on;
    for (let i = 0; i < 30000; i++) {
      const old = occurrenceInfo(
        rule.start_on,
        rule.frequency,
        i,
        rule.day_adjust || "none",
        true,
      ).date;
      if (old > last) break;
      const current = occurrenceInfo(
        rule.start_on,
        rule.frequency,
        i,
        rule.day_adjust || "none",
      ).date;
      if (old !== current) keys.set(old, current);
      if (rule.one_time) break;
    }
    const mapped = rows.map((row) => ({
      ...row,
      original_on: keys.get(row.original_on) || row.original_on,
    }));
    if (new Set(mapped.map((r) => r.original_on)).size !== mapped.length)
      throw Error("Conflit de calendrier : aucune échéance déplacée.");
    if (mapped.some((r, i) => r.original_on !== rows[i].original_on))
      changes.push({ rule_id: rule.id, rows: mapped });
  }
  return changes;
}
export function applyCalendarStateChanges(store, changes) {
  for (const change of changes) {
    store.run("DELETE FROM occurrence_states WHERE rule_id=?", change.rule_id);
    for (const row of change.rows)
      store.run(
        "INSERT INTO occurrence_states(rule_id,original_on,status,postponed_on,amount_cents,transaction_id,transfer_id) VALUES(?,?,?,?,?,?,?)",
        row.rule_id,
        row.original_on,
        row.status,
        row.postponed_on,
        row.amount_cents,
        row.transaction_id,
        row.transfer_id,
      );
  }
}

export function nationalOccurrenceDate(rule, legacyDate) {
  if (
    !rule ||
    legacyDate.slice(5, 7) !== "06" ||
    +legacyDate.slice(8) < 22 ||
    +legacyDate.slice(8) > 27
  )
    return legacyDate;
  for (let i = 0; i < 30000; i++) {
    const old = occurrenceInfo(
      rule.start_on,
      rule.frequency,
      i,
      rule.day_adjust || "none",
      true,
    ).date;
    if (old === legacyDate)
      return occurrenceInfo(
        rule.start_on,
        rule.frequency,
        i,
        rule.day_adjust || "none",
      ).date;
    if (old > legacyDate || rule.one_time) break;
  }
  return legacyDate;
}
