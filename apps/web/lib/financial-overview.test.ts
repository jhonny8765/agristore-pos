import { describe, expect, it } from "vitest";
import { financialPeriod, groupFinancialRows, summarizeFinancialRows, type FinancialRow } from "./financial-overview";

const row = (overrides: Partial<FinancialRow> = {}): FinancialRow => ({
  branchId: "magpet", bucket: "2026-11-25", gross: "2846000", refunds: "46000",
  cost: "1876000", expenses: "196000", notebook: false, overlap: false, ...overrides,
});

describe("financial Overview", () => {
  it("uses Philippine calendar boundaries for today and the seven-day preset", () => {
    const now = new Date("2026-11-24T16:02:00Z");
    expect(financialPeriod("today", now)).toEqual({ from: "2026-11-25", through: "2026-11-25" });
    expect(financialPeriod("seven", now)).toEqual({ from: "2026-11-19", through: "2026-11-25" });
  });

  it("calculates net sales and profits in exact centavos", () => {
    expect(summarizeFinancialRows([row()])).toMatchObject({ net: "2800000", grossProfit: "924000", profit: "728000" });
    expect(summarizeFinancialRows([row({ gross: "0", refunds: "-100", cost: "40", expenses: "200" })])).toMatchObject({ net: "100", profit: "-140" });
  });

  it("preserves notebook totals and unavailable profit across branches and months", () => {
    const notebook = row({ bucket: "2026-11-23", gross: "1999200", refunds: null, cost: null, expenses: "188000", notebook: true });
    const rows = [notebook, row({ branchId: "antipas" })];
    expect(summarizeFinancialRows(rows)).toMatchObject({ gross: "4845200", expenses: "384000", net: null, profit: null });
    expect(groupFinancialRows(rows,{ from:"2026-11-23",through:"2026-11-25" },"day").map(x=>x.profit)).toEqual([null,"0","728000"]);
    expect(groupFinancialRows(rows,{ from:"2026-11-23",through:"2026-11-25" },"month")[0]).toMatchObject({ gross:"4845200", profit:null });
  });
});
