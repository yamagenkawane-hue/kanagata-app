import type { BomItem } from "./planning.ts";

export const PLATE_NAMES = [
  "PPパンチプレート", "PBパンチバッキング", "SPストリッパープレート",
  "SBストリッパーバッキング", "DPダイプレート", "DB1ダイバッキング",
  "DB2ダイバッキング", "DB3ダイバッキング", "DS1ダイセット", "DS2ダイセット",
] as const;

export function availablePlates(items: BomItem[], productId: string, editingId?: string): string[] {
  const current = items.find(item => item.id === editingId && item.productId === productId);
  const used = new Set(items.filter(item => item.productId === productId && item.kind === "plate" && !item.archived && item.id !== editingId).map(item => item.name));
  return PLATE_NAMES.filter(name => !used.has(name) || current?.name === name);
}

export function validatePlate(items: BomItem[], item: Partial<BomItem>): void {
  if (item.kind !== "plate" || item.archived) return;
  const current = items.find(row => row.id === item.id);
  if (current?.kind === "plate" && current.productId === item.productId && current.name === item.name) return;
  if (!PLATE_NAMES.some(name => name === item.name)) throw new Error("プレートは一覧から選択してください");
  if (items.some(row => row.id !== item.id && row.productId === item.productId && row.kind === "plate" && row.name === item.name && !row.archived)) throw new Error("同じ金型にこのプレートは登録済みです。既存の行を編集してください");
}
