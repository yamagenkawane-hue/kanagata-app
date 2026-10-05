import type { BomItem, BomName } from "./planning.ts";
import { availablePlates } from "./plates.ts";
export function availableBomNames(names: BomName[], items: BomItem[], productId: string, categoryId: string, kind: "plate" | "part", editingId?: string): string[] {
  const candidates = names.filter(name => name.categoryId === categoryId && name.active).map(name => name.name);
  return kind === "plate" ? availablePlates(items, productId, editingId, candidates) : candidates;
}
