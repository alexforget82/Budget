// Budget-only date counting. Never creates payments or changes the cash forecast.
export const usesCalendar = frequency => frequency === 'weekly' || frequency === 'biweekly';
export const validReferenceDate = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;
export function validCalendarMetadata(plan) {
  const date = plan.reference_on, rule = plan.calendar_rule_id;
  return (date == null || usesCalendar(plan.frequency) && validReferenceDate(date)) &&
    (rule == null || usesCalendar(plan.frequency) && Number.isSafeInteger(rule) && rule > 0) && !(date != null && rule != null);
}
export function datesInBudgetMonth(reference, frequency, month) {
  if (!validReferenceDate(reference) || !usesCalendar(frequency) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Choisissez une date de référence et une fréquence valides.');
  const start = Date.parse(month + '-01T12:00:00Z'), end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const anchor = Date.parse(reference + 'T12:00:00Z'), step = (frequency === 'weekly' ? 7 : 14) * 86400000;
  const dates = [];
  for (let time = anchor + Math.max(0,Math.ceil((start-anchor)/step))*step; time < end.getTime(); time += step) dates.push(new Date(time).toISOString().slice(0,10));
  return dates;
}
