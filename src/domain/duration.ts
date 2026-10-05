export const WORK_DAY_MINUTES = 470;
export function usesDays(process: string): boolean { return process === "assembly" || process === "trial"; }
export function enteredDuration(process: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(usesDays(process) ? "所要日数は1日以上の整数で入力してください" : "所要時間を正しく入力してください");
  if (!usesDays(process) && value % 30) throw new Error("所要時間は30分単位で入力してください");
  return usesDays(process) ? value * WORK_DAY_MINUTES : value;
}
// 既存の時間登録をそのまま再計算できるよう、旧30分単位も受け付ける。
export function validDuration(process: string, minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0 && (minutes % 30 === 0 || (usesDays(process) && minutes % WORK_DAY_MINUTES === 0));
}
