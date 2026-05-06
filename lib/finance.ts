import fs from "fs";
import path from "path";
import Papa from "papaparse";

type MercuryRow = {
  Date: string;
  Description: string;
  Amount: string;
  Status: string;
  Counterparty: string;
  Category: string;
  Reference: string;
  Account: string;
};

type WiseRow = {
  Date: string;
  TransferID: string;
  Type: string;
  Status: string;
  SourceAmount: string;
  SourceCurrency: string;
  TargetAmount: string;
  TargetCurrency: string;
  ExchangeRate: string;
  WiseFeeUSD: string;
  Recipient: string;
  RecipientCountry: string;
  Reference: string;
};

function readCsv<T>(filePath: string): T[] {
  const csv = fs.readFileSync(filePath, "utf8");

  const parsed = Papa.parse<T>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error(parsed.errors);
    throw new Error(`CSV parsing failed for ${filePath}`);
  }

  return parsed.data;
}

function money(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getFinanceData() {
  const mercuryPath = path.join(
    process.cwd(),
    "data",
    "mercury_transactions_mar_apr_2026.csv"
  );

  const wisePath = path.join(
    process.cwd(),
    "data",
    "wise_transactions_mar_apr_2026.csv"
  );

  const mercury = readCsv<MercuryRow>(mercuryPath);
  const wise = readCsv<WiseRow>(wisePath);

  const openingCash = Number(process.env.OPENING_CASH_USD || 3578000);

  const aprilStart = "2026-04-01";
  const aprilEnd = "2026-04-30";
  const marchStart = "2026-03-01";
  const marchEnd = "2026-03-31";

  const aprilMercury = mercury.filter((row) =>
    isBetween(row.Date, aprilStart, aprilEnd)
  );

  const marchMercury = mercury.filter((row) =>
    isBetween(row.Date, marchStart, marchEnd)
  );

  const aprilWise = wise.filter((row) =>
    isBetween(row.Date, aprilStart, aprilEnd)
  );

  const marchWise = wise.filter((row) =>
    isBetween(row.Date, marchStart, marchEnd)
  );

  function calculatePeriodBurn(
    mercuryRows: MercuryRow[],
    wiseRows: WiseRow[]
  ) {
    const inflows = sum(
      mercuryRows
        .filter((row) => money(row.Amount) > 0)
        .map((row) => money(row.Amount))
    );

    const mercuryOutflowsExcludingInternal = sum(
      mercuryRows
        .filter(
          (row) =>
            money(row.Amount) < 0 && row.Category !== "Internal Transfer"
        )
        .map((row) => Math.abs(money(row.Amount)))
    );

    const wiseContractorSends = sum(
      wiseRows
        .filter((row) => row.Type === "Send")
        .map((row) => money(row.SourceAmount))
    );

    const totalRealOutflows =
      mercuryOutflowsExcludingInternal + wiseContractorSends;

    const netBurn = totalRealOutflows - inflows;

    return {
      inflows: round(inflows),
      totalRealOutflows: round(totalRealOutflows),
      netBurn: round(netBurn),
    };
  }

  const aprilBurn = calculatePeriodBurn(aprilMercury, aprilWise);
  const marchBurn = calculatePeriodBurn(marchMercury, marchWise);

  const customerCashCollected = sum(
    aprilMercury
      .filter(
        (row) => row.Category === "Sales Revenue" && money(row.Amount) > 0
      )
      .map((row) => money(row.Amount))
  );

  const totalTransactionMovement =
    sum(mercury.map((row) => money(row.Amount))) -
    sum(wise.filter((row) => row.Type === "Send").map((row) => money(row.SourceAmount))) -
    sum(wise.filter((row) => row.Type === "Send").map((row) => money(row.WiseFeeUSD)));

  const totalCashPosition = openingCash + totalTransactionMovement;

  const monthlyBurnRate = aprilBurn.netBurn;
  const runwayMonths =
    monthlyBurnRate > 0 ? totalCashPosition / monthlyBurnRate : 0;

const categoryMap: Record<string, string> = {
  Payroll: "Payroll",
  "AI Compute": "AI Compute",
  "Software & Tools": "Software",
  Benefits: "Benefits",
  Recruiting: "Recruiting",
  Legal: "Other",
  "Rent & Utilities": "Other",
};

const spendByCategory = Object.entries(
  aprilMercury
    .filter(
      (row) =>
        money(row.Amount) < 0 && row.Category !== "Internal Transfer"
    )
    .reduce<Record<string, number>>((acc, row) => {
      const displayCategory = categoryMap[row.Category] || "Other";

      acc[displayCategory] =
        (acc[displayCategory] || 0) + Math.abs(money(row.Amount));

      return acc;
    }, {})
)
  .map(([category, amount]) => ({
    category,
    amount: round(amount),
  }))
  .sort((a, b) => b.amount - a.amount);

  const customerInflows = Object.entries(
    mercury
      .filter(
        (row) => row.Category === "Sales Revenue" && money(row.Amount) > 0
      )
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.Counterparty] =
          (acc[row.Counterparty] || 0) + money(row.Amount);
        return acc;
      }, {})
  )
    .map(([counterparty, amount]) => ({
      counterparty,
      amount: round(amount),
    }))
    .sort((a, b) => b.amount - a.amount);

    


  const contractorSpendByCurrency = Object.entries(
    aprilWise
      .filter((row) => row.Type === "Send")
      .reduce<Record<string, { sentUsd: number; feesUsd: number }>>(
        (acc, row) => {
          if (!acc[row.TargetCurrency]) {
            acc[row.TargetCurrency] = {
              sentUsd: 0,
              feesUsd: 0,
            };
          }

          acc[row.TargetCurrency].sentUsd += money(row.SourceAmount);
          acc[row.TargetCurrency].feesUsd += money(row.WiseFeeUSD);

          return acc;
        },
        {}
      )
  ).map(([currency, values]) => ({
    currency,
    sentUsd: round(values.sentUsd),
    feesUsd: round(values.feesUsd),
  }));

  const wiseContractorPayments = aprilWise
    .filter((row) => row.Type === "Send")
    .map((row) => ({
      date: row.Date,
      recipient: row.Recipient,
      country: row.RecipientCountry,
      sourceAmountUsd: money(row.SourceAmount),
      targetAmount: money(row.TargetAmount),
      targetCurrency: row.TargetCurrency,
      feeUsd: money(row.WiseFeeUSD),
      reference: row.Reference,
    }));

  const aiComputeApril = sum(
    aprilMercury
      .filter((row) => row.Category === "AI Compute")
      .map((row) => Math.abs(money(row.Amount)))
  );

  const dailyCashBalance = mercury
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .reduce<{ date: string; balance: number }[]>((acc, row) => {
      const previousBalance =
        acc.length === 0 ? openingCash : acc[acc.length - 1].balance;

      acc.push({
        date: row.Date,
        balance: round(previousBalance + money(row.Amount)),
      });

      return acc;
    }, []);

  return {
    asOfDate: "2026-04-30",
    kpis: {
      totalCashPosition: round(totalCashPosition),
      netBurnLast30Days: aprilBurn.netBurn,
      marchNetBurn: marchBurn.netBurn,
      totalRealOutflowsLast30Days: aprilBurn.totalRealOutflows,
      totalInflowsLast30Days: aprilBurn.inflows,
      customerCashCollected: round(customerCashCollected),
      runwayMonths: round(runwayMonths),
      aiComputeApril: round(aiComputeApril),
    },
    spendByCategory,
    customerInflows,
    contractorSpendByCurrency,
    wiseContractorPayments,
    dailyCashBalance,
  };
}