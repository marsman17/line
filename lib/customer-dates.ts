export type CustomerDateRange = { start: string; end: string; label: string };
export function dateRangeLabel(range: CustomerDateRange, locale: string) {
  if (range.label !== "Custom dates" && !/^\d{4}-\d{2}-\d{2}/.test(range.label))
    return range.label;
  const format = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = format.format(new Date(range.start + "T00:00:00"));
  const end = format.format(new Date(range.end + "T00:00:00"));
  return range.start === range.end ? start : `${start} – ${end}`;
}
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateBounds(range: CustomerDateRange) {
  const start = new Date(range.start + "T00:00:00");
  const end = new Date(range.end + "T00:00:00");
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
export function datePreset(value: string, now = new Date()): CustomerDateRange {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  if (value === "yesterday") end.setDate(end.getDate() - 1);
  const start = new Date(end);
  if (value !== "today" && value !== "yesterday")
    start.setDate(start.getDate() - (Number(value) - 1));
  return {
    start: dateKey(start),
    end: dateKey(end),
    label:
      value === "today"
        ? "Today"
        : value === "yesterday"
          ? "Yesterday"
          : `Last ${value} days`,
  };
}
