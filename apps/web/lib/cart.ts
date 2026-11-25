import { create } from "zustand";
import Decimal from "decimal.js";
import {applyAmountDiscount,canonicalQuantity,lineAmounts,total,validateSellingItem,type SaleItem} from "@agristore/domain";
import { quantityFromDisplay } from "./quantity-entry";
const ExactQuantity=Decimal.clone({precision:80});
export interface LineDraft {
  draft: string;
  display: "kg" | "g" | "liter" | "ml";
  budgetMode: boolean;
  budget: string;
  budgetError: string;
  original: SaleItem | null;
  focus?: "quantity" | "budget" | null;
  discount?: string;
  discountKind?: "amount";
  discountError?: string;
}
export type SaleEntry = "unit" | "weight" | "budget";

/** A cached valid item must not price a different or unfinished typed quantity.
 * Valid peso estimates still have an amount while awaiting weight confirmation. */
export function draftLineTotal(
  item: SaleItem,
  draft?: Pick<LineDraft, "draft" | "display" | "discountError">,
) {
  if (!draft || draft.discountError) return null;
  try {
    const quantity = quantityFromDisplay(draft.draft, draft.display === "g" || draft.display === "ml");
    return new Decimal(quantity).eq(item.quantity) ? item.lineTotal : null;
  } catch {
    return null;
  }
}

interface Cart {
  credit: {enabled:boolean;clientId:string;term:number;customTerm?:boolean;officialReference:string;cash:string};
  creditAttempt?: Record<string,unknown>;
  heldDraftId: string | null;
  items: SaleItem[];
  lineIds: string[];
  drafts: Record<string, LineDraft>;
  edit: (lineId: string, patch: Partial<LineDraft>) => void;
  quantityErrors: Record<string, string>;
  quantityError: (lineId: string, error?: string) => void;
  attemptId: string | null;
  add: (item: SaleItem, entry?: SaleEntry) => string;
  replace: (index: number, item: SaleItem) => void;
  confirmPackaging: (index:number,confirmed:boolean) => void;
  discount: (index:number,amount:number) => void;
  remove: (index: number) => void;
  clear: () => void;
  attempt: () => string;
}
export function cartAmount(items:Pick<SaleItem,'lineTotal'>[]):number|null{try{return total(items);}catch{return null;}}
export function hasCartErrors(cart:Pick<Cart,'quantityErrors'|'drafts'>&{items?:SaleItem[]}){return Object.keys(cart.quantityErrors).length>0||Object.values(cart.drafts).some(d=>!!d.discountError)||!!cart.items&&(cart.items.length>100||cartAmount(cart.items)===null||cart.items.some(item=>{try{validateSellingItem(item,item.branchId);return false;}catch{return true;}}));}
function sameSellingSnapshot(a:SaleItem,b:SaleItem){
 const keys=['productId','unitId','batchId','name','unitName','factor','unitPrice','unitCost','priceVersion','branchId','branchPriceId','branchPriceVersion'] as const;
 return keys.every(key=>a[key]===b[key])&&(a.sellingPolicy??'fractional')===(b.sellingPolicy??'fractional');
}
export const useCart = create<Cart>((set, get) => ({
  credit: {enabled:false,clientId:'',term:30,officialReference:'',cash:''},
  creditAttempt: undefined,
  heldDraftId: null,
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
  confirmPackaging: (index,confirmed) => set(s=>({items:s.items.map((item,i)=>i===index?{...item,intactPackagingConfirmed:confirmed}:item),attemptId:null})),
  add: (item, entry = "unit") => {
    let targetLineId='';
    set((s) => {
      const index=entry==='unit'&&lineAmounts(item).discount===0?s.items.findIndex((previous,i)=>{
        const id=s.lineIds[i],draft=s.drafts[id];
        return sameSellingSnapshot(previous,item)&&draft&&!s.quantityErrors[id]&&!draft.discountError&&!draft.budgetMode&&!draft.budgetError&&!draft.original&&draftLineTotal(previous,draft)!==null;
      }):-1;
      if(index>=0){
        const previous=s.items[index],id=s.lineIds[index],draft=s.drafts[id];
        const quantity=new ExactQuantity(previous.quantity).plus(item.quantity).toFixed();
        canonicalQuantity(quantity,previous.factor);
        if(previous.sellingPolicy==='sealed_whole'&&!new ExactQuantity(quantity).isInteger())throw Error('Sealed packs require whole quantities.');
        const combined=applyAmountDiscount({...previous,quantity},lineAmounts(previous).discount);
        if(combined.sellingPolicy==='sealed_whole')combined.intactPackagingConfirmed=false;
        const thousandth=draft.display==='g'||draft.display==='ml',displayed=thousandth?new ExactQuantity(quantity).mul(1000).toFixed():quantity;
        quantityFromDisplay(displayed,thousandth);
        const items=s.items.map((value,i)=>i===index?combined:value);total(items);targetLineId=id;
        return{items,attemptId:null,drafts:{...s.drafts,[id]:{...draft,draft:displayed}}};
      }
      if(s.items.length>=100)throw Error('A receipt supports up to 100 lines. Increase an existing quantity or start another sale.');
      total([...s.items,item]);
      const lineId = crypto.randomUUID();
      targetLineId=lineId;
      return {
        items: [...s.items, item],
        lineIds: [...s.lineIds, lineId],
        attemptId: null,
        quantityErrors:
          entry === "unit"
            ? s.quantityErrors
            : {
                ...s.quantityErrors,
                [lineId]:
                  entry === "weight"
                    ? "Enter the customer's weight in kg or grams."
                    : "Enter a peso budget and confirm the actual scale weight.",
              },
        drafts: {
          ...s.drafts,
          [lineId]: {
            draft: entry === "unit" ? item.quantity : "",
            display: "kg",
            budgetMode: entry === "budget",
            budget: "",
            budgetError: "",
            original: null,
            focus:
              entry === "weight"
                ? "quantity"
                : entry === "budget"
                  ? "budget"
                  : null,
          },
        },
      };
    });
    return targetLineId;
  },
  replace: (index, item) =>
    set((s) => {
      total(s.items.map((value,n)=>n===index?item:value));
      const quantityErrors = { ...s.quantityErrors };
      delete quantityErrors[s.lineIds[index]];
      return {
        items: s.items.map((v, i) => (i === index ? item : v)),
        quantityErrors,
        attemptId: null,
      };
    }),
  discount:(index,amount)=>set(s=>{const items=s.items.map((item,n)=>n===index?applyAmountDiscount(item,amount):item);total(items);return {items,attemptId:null};}),
  remove: (index) =>
    set((s) => {
      const quantityErrors = { ...s.quantityErrors };
      delete quantityErrors[s.lineIds[index]];
      const drafts = { ...s.drafts };
      delete drafts[s.lineIds[index]];
      return {
        drafts,
        items: s.items.filter((_, i) => i !== index),
        heldDraftId: s.items.length===1?null:s.heldDraftId,
        lineIds: s.lineIds.filter((_, i) => i !== index),
        quantityErrors,
        attemptId: null,
      };
    }),
  clear: () =>
    set({
      credit: {enabled:false,clientId:'',term:30,officialReference:'',cash:''},
      creditAttempt: undefined,
      heldDraftId: null,
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
