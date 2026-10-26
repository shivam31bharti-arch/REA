/** Width of a strip entry's length bar: its share of the longest entry, across the track left of the label. */
export function stripBarWidth(amount: number, longest: number) {
  if (amount <= 0) return 0;
  return `calc((100% - 60px) * ${Math.max(amount / Math.max(longest, 1), 0.06)})`;
}
