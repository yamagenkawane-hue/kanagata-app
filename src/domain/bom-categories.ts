import type { BomCategory } from "./planning.ts";
export const DEFAULT_BOM_CATEGORIES: BomCategory[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "プレート", kind: "plate", active: true },
  { id: "00000000-0000-4000-8000-000000000002", name: "パーツ", kind: "part", active: true },
];
