const addDays = (s, n) =>
  new Date(Date.parse(s + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export function twiceMonthlyDates(date, first, second) {
  const last = new Date(
    Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 0),
  ).getUTCDate();
  return [first, second].map(
    (day) => date.slice(0, 8) + String(Math.min(day, last)).padStart(2, "0"),
  );
}
export function periodStart(category, date) {
  if (category.period === "semimonthly") {
    const dates = twiceMonthlyDates(
      date,
      category.renewal_day,
      category.renewal_day2,
    );
    const eligible = dates.filter((d) => d <= date);
    if (eligible.length) return eligible.at(-1);
    return twiceMonthlyDates(
      addDays(date.slice(0, 8) + "01", -1),
      category.renewal_day,
      category.renewal_day2,
    )[1];
  }
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
  if (category.period === "semimonthly") {
    const next = twiceMonthlyDates(
      start,
      category.renewal_day,
      category.renewal_day2,
    ).find((d) => d > start);
    if (next) return next;
    const d = new Date(start.slice(0, 8) + "01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    return twiceMonthlyDates(
      d.toISOString().slice(0, 10),
      category.renewal_day,
      category.renewal_day2,
    )[0];
  }
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
