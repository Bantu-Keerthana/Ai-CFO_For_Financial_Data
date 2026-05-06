import { describe, expect, it } from "vitest";
import { getFinanceData } from "../lib/finance";

describe("finance calculations", () => {
  it("calculates key April CFO metrics from CSV data", () => {
    const data = getFinanceData();

    expect(data.asOfDate).toBe("2026-04-30");

    expect(data.kpis.customerCashCollected).toBe(176500);
    expect(data.kpis.aiComputeApril).toBe(33530);

    expect(data.kpis.netBurnLast30Days).toBeGreaterThan(130000);
    expect(data.kpis.netBurnLast30Days).toBeLessThan(145000);

    const wiseTotal = data.wiseContractorPayments.reduce(
      (total, payment) => total + payment.sourceAmountUsd,
      0
    );

    expect(wiseTotal).toBe(28305);
  });

  it("groups spend categories for executive dashboard display", () => {
    const data = getFinanceData();

    const categoryNames = data.spendByCategory.map((item) => item.category);

    expect(categoryNames).toContain("Payroll");
    expect(categoryNames).toContain("AI Compute");
    expect(categoryNames).toContain("Software");
    expect(categoryNames).toContain("Other");
  });
});