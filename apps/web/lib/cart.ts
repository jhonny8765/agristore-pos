import { create } from "zustand";
import type { SaleItem } from "@agristore/domain";
interface Cart {
  items: SaleItem[];
  attemptId: string | null;
  add: (item: SaleItem) => void;
  replace: (index: number, item: SaleItem) => void;
  remove: (index: number) => void;
  clear: () => void;
  attempt: () => string;
}
export const useCart = create<Cart>((set, get) => ({
  items: [],
  attemptId: null,
  add: (item) => set((s) => ({ items: [...s.items, item], attemptId: null })),
  replace: (index, item) =>
    set((s) => ({
      items: s.items.map((v, i) => (i === index ? item : v)),
      attemptId: null,
    })),
  remove: (index) =>
    set((s) => ({
      items: s.items.filter((_, i) => i !== index),
      attemptId: null,
    })),
  clear: () => set({ items: [], attemptId: null }),
  attempt: () => {
    const id = get().attemptId ?? crypto.randomUUID();
    set({ attemptId: id });
    return id;
  },
}));
