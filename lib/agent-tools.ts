import { getFinanceData } from "./finance";

// Tool definitions in OpenAI function-calling format (Groq-compatible)
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_cash_position",
      description:
        "Returns the company's current total cash position, including the configured opening balance and all transaction activity from Mercury and Wise.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_burn_metrics",
      description:
        "Returns net burn, total outflows, and total inflows for both April and March. Use this to answer questions about burn rate, spending trends, or month-over-month comparisons.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            enum: ["april", "march", "both"],
            description:
              "Which month to return burn metrics for. Use 'both' for comparisons.",
          },
        },
        required: ["month"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_runway",
      description:
        "Returns the current runway in months, calculated as total cash position divided by the latest monthly net burn rate.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_spend_by_category",
      description:
        "Returns April operating spend grouped by category (Payroll, AI Compute, Software, Benefits, Recruiting, Other). Each category includes the total dollar amount. Internal transfers are excluded.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_customer_inflows",
      description:
        "Returns all customer cash collected (Sales Revenue inflows), grouped by customer name with total amounts. Includes both March and April data.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contractor_spend",
      description:
        "Returns international contractor payments made via Wise, including recipient name, country, amounts in local currency, USD equivalent, and fees. Covers both March and April.",
      parameters: {
        type: "object",
        properties: {
          month: {
            type: "string",
            enum: ["april", "march", "both"],
            description: "Which month to return contractor data for.",
          },
        },
        required: ["month"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_daily_cash_trend",
      description:
        "Returns the daily cash balance over the full date range (March and April), showing how cash position changed day by day.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_ai_compute_spend",
      description:
        "Returns AI compute spend for April, broken down by vendor (OpenAI, Anthropic, Pinecone, Replicate, AWS training). Use for questions about AI/ML infrastructure costs.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// Execute a tool call against the deterministic finance data
export function executeTool(
  toolName: string,
  toolInput: Record<string, string>
): string {
  const data = getFinanceData();

  switch (toolName) {
    case "get_cash_position": {
      return JSON.stringify({
        totalCashPosition: data.kpis.totalCashPosition,
        asOfDate: data.asOfDate,
        note: "Calculated as opening cash ($3,578,000) plus all Mercury transaction activity minus Wise sends and fees.",
      });
    }

    case "get_burn_metrics": {
      const month = toolInput.month || "both";
      const result: Record<string, unknown> = {};

      if (month === "april" || month === "both") {
        result.april = {
          netBurn: data.kpis.netBurnLast30Days,
          totalOutflows: data.kpis.totalRealOutflowsLast30Days,
          totalInflows: data.kpis.totalInflowsLast30Days,
          period: "2026-04-01 to 2026-04-30",
        };
      }
      if (month === "march" || month === "both") {
        result.march = {
          netBurn: data.kpis.marchNetBurn,
          period: "2026-03-01 to 2026-03-31",
        };
      }
      if (month === "both") {
        const diff = data.kpis.netBurnLast30Days - data.kpis.marchNetBurn;
        result.comparison = {
          burnChangeUsd: diff,
          direction: diff > 0 ? "increased" : "decreased",
        };
      }

      return JSON.stringify(result);
    }

    case "get_runway": {
      return JSON.stringify({
        runwayMonths: data.kpis.runwayMonths,
        totalCashPosition: data.kpis.totalCashPosition,
        monthlyBurnRate: data.kpis.netBurnLast30Days,
        formula: "runway = totalCashPosition / monthlyNetBurn",
      });
    }

    case "get_spend_by_category": {
      return JSON.stringify({
        month: "April 2026",
        categories: data.spendByCategory,
        totalSpend: data.spendByCategory.reduce(
          (sum, cat) => sum + cat.amount,
          0
        ),
        note: "Internal transfers excluded. Wise contractor sends are tracked separately.",
      });
    }

    case "get_customer_inflows": {
      return JSON.stringify({
        aprilCustomerCashCollected: data.kpis.customerCashCollected,
        customerBreakdown: data.customerInflows,
        note: "Sales Revenue category inflows from Mercury, grouped by customer.",
      });
    }

    case "get_contractor_spend": {
      const month = toolInput.month || "april";

      if (month === "april" || month === "both") {
        const aprilTotal = data.wiseContractorPayments.reduce(
          (sum, p) => sum + p.sourceAmountUsd,
          0
        );
        const aprilFees = data.wiseContractorPayments.reduce(
          (sum, p) => sum + p.feeUsd,
          0
        );

        return JSON.stringify({
          month: "April 2026",
          payments: data.wiseContractorPayments,
          totalSentUsd: aprilTotal,
          totalFeesUsd: aprilFees,
          byCurrency: data.contractorSpendByCurrency,
        });
      }

      return JSON.stringify({
        note: "March contractor data available in full dataset. April data shown by default.",
        byCurrency: data.contractorSpendByCurrency,
      });
    }

    case "get_daily_cash_trend": {
      const trend = data.dailyCashBalance;
      const first = trend[0];
      const last = trend[trend.length - 1];

      return JSON.stringify({
        startDate: first?.date,
        startBalance: first?.balance,
        endDate: last?.date,
        endBalance: last?.balance,
        totalDataPoints: trend.length,
        trend: trend,
      });
    }

    case "get_ai_compute_spend": {
      return JSON.stringify({
        month: "April 2026",
        totalAiCompute: data.kpis.aiComputeApril,
        note: "Includes OpenAI API, Anthropic API, Pinecone, Replicate, and AWS training/GPU reservations categorized as AI Compute in Mercury.",
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
