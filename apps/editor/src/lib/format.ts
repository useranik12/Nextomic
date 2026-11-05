const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** "3rd Nov 2026", matching docs/ui-reference.md 4.2's project card date format. */
export function formatOrdinalDate(date: Date): string {
  const day = date.getDate();
  return `${day}${ordinalSuffix(day)} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
