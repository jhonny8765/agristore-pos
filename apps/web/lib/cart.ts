import { create } from "zustand";
import type { SaleItem } from "@agristore/domain";
export interface LineDraft {
  draft: string;
  display: "kg" | "g";
  budgetMode: boolean;
  budget: string;
  budgetError: string;
  original: SaleItem | null;
}
interface Cart {
  items: SaleItem[];
  lineIds: string[];
  drafts: Record<string, LineDraft>;
  edit: (lineId: string, patch: Partial<LineDraft>) => void;
  quantityErrors: Record<string, string>;
  quantityError: (lineId: string, error?: string) => void;
  attemptId: string | null;
  add: (item: SaleItem) => void;
  replace: (index: number, item: SaleItem) => void;
  remove: (index: number) => void;
  clear: () => void;
  attempt: () => string;
}
export const useCart = create<Cart>((set, get) => ({
  items: [],
  lineIds: [],
  drafts: {},
  edit: (lineId, patch) =>
    set((s) => ({
      drafts: { ...s.drafts, [lineId]: { ...s.drafts[lineId], ...patch } },
    })),
  quantityErrors: {},
  quantityError: (lineId, error) =>
    set((s) => {
      if (s.quantityErrors[lineId] === error) return s;
      const quantityErrors = { ...s.quantityErrors };
      if (error) quantityErrors[lineId] = error;
      else delete quantityErrors[lineId];
      return { quantityErrors };
    }),
  attemptId: null,
  add: (item) =>
    set((s) => {
      const lineId = crypto.randomUUID();
      return {
        items: [...s.items, item],
        lineIds: [...s.lineIds, lineId],
        attemptId: null,
        drafts: {
          ...s.drafts,
          [lineId]: {
            draft: item.quantity,
            display: "kg",
            budgetMode: false,
            budget: "",
            budgetError: "",
            original: null,
          },
        },
      };
    }),
  replace: (index, item) =>
    set((s) => {
      const quantityErrors = { ...s.quantityErrors };
      delete quantityErrors[s.lineIds[index]];
      return {
        items: s.items.map((v, i) => (i === index ? item : v)),
        quantityErrors,
        attemptId: null,
      };
    }),
  remove: (index) =>
    set((s) => {
      const quantityErrors = { ...s.quantityErrors };
      delete quantityErrors[s.lineIds[index]];
      const drafts = { ...s.drafts };
      delete drafts[s.lineIds[index]];
      return {
        drafts,
        items: s.items.filter((_, i) => i !== index),
        lineIds: s.lineIds.filter((_, i) => i !== index),
        quantityErrors,
        attemptId: null,
      };
    }),
  clear: () =>
    set({
      items: [],
      lineIds: [],
      drafts: {},
      quantityErrors: {},
      attemptId: null,
    }),
  attempt: () => {
    const id = get().attemptId ?? crypto.randomUUID();
    set({ attemptId: id });
    return id;
  },
}));
