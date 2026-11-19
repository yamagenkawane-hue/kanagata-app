// Coordinates count only minutes shown on the chart. The origin is midnight JST.
const day = 1440;
const opening = 420;
const visible = 900;
export function chartMinute(time: number, origin: number) {
  const minutes = (time - origin) / 60000;
  const index = Math.floor(minutes / day);
  return index * visible + Math.max(0, Math.min(visible, minutes - index * day - opening));
}
export function chartTime(position: number, origin: number) {
  const index = Math.floor(position / visible);
  return origin + (index * day + opening + position - index * visible) * 60000;
}
