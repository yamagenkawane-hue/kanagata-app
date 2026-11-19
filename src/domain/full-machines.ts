import { at, BREAKS, type PlanData } from "./planning.ts";

const requiredMinutes = 60;
export function fullMachines(data: PlanData, days: string[]): Set<string> {
  const full = new Set<string>();
  const shifts = [[530, BREAKS[0][0]], [BREAKS[0][1], BREAKS[1][0]], [BREAKS[1][1], 1060]];
  const slots = days.filter(day => data.calendar[day]).flatMap(day =>
    shifts.flatMap(([from, to]) => {
      const starts: {start: number; fits: boolean}[] = [];
      for (let minute = Math.ceil(from / 30) * 30; minute < to; minute += 30)
        starts.push({start: Date.parse(at(day, minute)), fits: minute + requiredMinutes <= to});
      return starts;
    })
  );
  if (days.some(day => !Object.hasOwn(data.calendar, day))) return full;
  for (const machine of data.equipment.filter(item => item.active !== false)) {
    const occupied = data.tasks.filter(task => task.equipmentId === machine.id).flatMap(task => {
      const intervals = task.status === "completed" && task.actualStart && task.actualEnd
        ? [{start: task.actualStart, end: task.actualEnd}]
        : task.segments.length ? task.segments : [{start: task.plannedStart, end: task.plannedEnd}];
      return intervals.map(interval => ({start: Date.parse(interval.start), end: Date.parse(interval.end)}));
    }).sort((a,b) => a.start - b.start);
    const continuous = ["machining","grinding","wire"].includes(machine.process);
    let index = 0;
    const available = slots.some(slot => {
      if (!continuous && !slot.fits) return false;
      while (index < occupied.length && occupied[index].end <= slot.start) index++;
      return index === occupied.length || occupied[index].start >= slot.start + requiredMinutes * 60000;
    });
    if (!available) full.add(machine.id);
  }
  return full;
}
