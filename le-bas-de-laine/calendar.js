// Quebec/Canada banking calendar; unadjusted fixed dates retain their nominal date.
const dateFrom = (s) => new Date(s + "T12:00:00Z"),
  iso = (d) => d.toISOString().slice(0, 10);
export function lastWeekday(y, m) {
  const d = new Date(Date.UTC(y, m, 0, 12));
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}
export function easter(y) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    n = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, n - 1, day, 12));
}
export function holidaySet(y) {
  const set = new Set();
  const add = (d) => set.add(iso(d));
  const fixed = (month, day) => new Date(Date.UTC(y, month - 1, day, 12));
  const observed = (month, day) => {
    let d = fixed(month, day);
    if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 2);
    if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    while ([0, 6].includes(d.getUTCDay()) || set.has(iso(d)))
      d.setUTCDate(d.getUTCDate() + 1);
    add(d);
  };
  const nthMonday = (month, n) => {
    const d = fixed(month, 1);
    d.setUTCDate(1 + ((8 - d.getUTCDay()) % 7) + (n - 1) * 7);
    add(d);
  };
  observed(1, 1);
  const good = easter(y);
  good.setUTCDate(good.getUTCDate() - 2);
  add(good);
  const victoria = fixed(5, 24);
  victoria.setUTCDate(24 - ((victoria.getUTCDay() + 6) % 7));
  add(victoria);
  observed(6, 24);
  observed(7, 1);
  nthMonday(9, 1);
  nthMonday(10, 2);
  observed(9, 30);
  observed(11, 11);
  observed(12, 25);
  observed(12, 26);
  return set;
}
export function nonBusiness(date) {
  const d = dateFrom(date);
  return (
    [0, 6].includes(d.getUTCDay()) || holidaySet(d.getUTCFullYear()).has(date)
  );
}
export function shiftDate(date, mode) {
  if (mode === "none") return date;
  const d = dateFrom(date),
    step = mode === "before" ? -1 : 1;
  for (let i = 0; i < 12 && nonBusiness(iso(d)); i++)
    d.setUTCDate(d.getUTCDate() + step);
  return iso(d);
}
export function occurrenceInfo(start, frequency, i, adjust = "none") {
  let nominal;
  if (frequency === "last_business_day" || frequency === "rrq") {
    const d = dateFrom(start);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + i);
    nominal = shiftDate(
      lastWeekday(d.getUTCFullYear(), d.getUTCMonth() + 1),
      "before",
    );
  } else nominal = nextOccurrence(start, frequency, i);
  return { date: shiftDate(nominal, adjust), estimated: false, nominal };
}
export function nextOccurrence(start, frequency, i) {
  const d = dateFrom(start);
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + i * 7);
  else if (frequency === "biweekly") d.setUTCDate(d.getUTCDate() + i * 14);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(
      d.getUTCMonth() +
        i * ({ quarterly: 3, semiannual: 6, yearly: 12 }[frequency] || 1),
    );
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return iso(d);
}
