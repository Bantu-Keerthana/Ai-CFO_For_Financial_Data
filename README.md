# AI CFO

A split-screen AI CFO dashboard built with Next.js. The left panel features Maya, a voice-enabled AI CFO assistant powered by a Groq tool-calling agent. The right panel shows a live financial dashboard calculated deterministically from Mercury and Wise CSV transaction data.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│                                                                  │
│  ┌───────────────────────┐     ┌──────────────────────────────┐  │
│  │   Maya (AI CFO)       │     │    Finance Dashboard         │  │
│  │                       │     │                              │  │
│  │  - Animated avatar    │     │    - 4 KPI cards             │  │
│  │  - Play CFO Briefing  │     │    - Daily cash trend        │  │
│  │  - Ask by Voice       │     │    - Spend by category       │  │
│  │  - Typed chat         │     │    - Customer inflows        │  │
│  │  - Browser TTS        │     │    - Contractor spend table  │  │
│  └──────────┬────────────┘     └─────────────┬────────────────┘  │
│             │                                │                   │
│             ▼                                ▼                   │
│       POST /api/chat                   GET /api/metrics          │
│             │                                │                   │
│             ▼                                ▼                   │
│    ┌─────────────────┐            ┌────────────────────┐         │
│    │   Groq API      │            │   getFinanceData() │         │
│    │   (tool-use)    │            │   (deterministic)  │         │
│    │                 │            └────────────────────┘         │
│    │  Calls tools:   │                     ▲                    │
│    │  get_cash_pos   │                     │                    │
│    │  get_burn       │──── tool calls ─────┘                    │
│    │  get_runway     │  (same deterministic                     │
│    │  get_spend      │   finance functions)                     │
│    │  get_inflows    │                                          │
│    │  get_contractor │                                          │
│    │  get_ai_compute │                                          │
│    │  get_cash_trend │                                          │
│    └─────────────────┘                                          │
└──────────────────────────────────────────────────────────────────┘
```

**Key design decision:** The LLM never does math. All financial calculations happen deterministically in `lib/finance.ts`. The agent uses tool-calling to query pre-computed results, then composes natural language answers. The dashboard and the assistant always show the same numbers.

## Features

- **Real agent design** — Groq API with OpenAI-compatible tool-use, 8 finance tools, up to 5 tool-calling rounds per question
- **Deterministic finance engine** — all numbers computed in TypeScript from CSV data, never by the LLM
- **Animated CFO avatar** — SVG-based with speaking, thinking, and idle states
- **Play CFO Briefing** — one-click button to hear the full opening briefing
- **Ask by Voice** — speech recognition that auto-sends the question to the agent
- **Browser TTS** — Maya speaks all responses aloud (toggleable)
- **Live dashboard** — KPI cards, daily cash trend, spend-by-category pie chart, customer inflows bar chart, international contractor spend table
- **Connected status indicator** — shows live connection to finance data
- **Vitest evaluation** — automated tests for key financial metrics

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- Groq API (Llama 3.3 70B, OpenAI-compatible tool-use)
- Recharts, PapaParse, Lucide React
- Browser SpeechSynthesis + SpeechRecognition APIs
- Vitest

## Quick Start

```bash
npm install
```

Create `.env.local`:

```
OPENING_CASH_USD=3578000
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Get a free Groq API key at [console.groq.com](https://console.groq.com).

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm run test
```

Current evaluation covers:

- April customer cash collected ($176,500)
- April AI compute spend ($33,530)
- April net burn within expected range ($130K–$145K)
- Wise contractor payment total ($28,305)
- Spend category groupings (Payroll, AI Compute, Software, Other)

## Agent Tools

The agent has access to 8 finance tools. The LLM decides which to call based on the user's question.

| Tool | Description |
|------|-------------|
| `get_cash_position` | Total cash position with calculation breakdown |
| `get_burn_metrics` | Net burn, outflows, inflows for March, April, or both |
| `get_runway` | Runway in months with formula |
| `get_spend_by_category` | April spend grouped by category |
| `get_customer_inflows` | Customer revenue breakdown by name |
| `get_contractor_spend` | Wise international contractor payments with details |
| `get_daily_cash_trend` | Daily cash balance over March–April |
| `get_ai_compute_spend` | AI/ML infrastructure cost breakdown |

## Project Structure

```
app/
  api/
    chat/
      route.ts           # Groq agent with tool-calling loop
    metrics/
      route.ts           # Returns deterministic finance metrics
  page.tsx               # Split-screen dashboard + assistant UI
  layout.tsx             # Root layout
  globals.css            # Global styles + waveform animation

lib/
  finance.ts             # CSV parsing + deterministic finance calculations
  agent-tools.ts         # Tool definitions + execution layer

data/
  mercury_transactions_mar_apr_2026.csv
  wise_transactions_mar_apr_2026.csv

__tests__/
  finance.test.ts        # Vitest evaluation for finance calculations

WRITEUP.md               # Architecture, tradeoffs, and next steps
```

## Data Files

The CSV files contain two months of dummy transaction data:

- `mercury_transactions_mar_apr_2026.csv` — 66 transactions (payroll, software, AI compute, revenue, etc.)
- `wise_transactions_mar_apr_2026.csv` — 23 transactions (international contractor payments, top-ups, conversions)

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel dashboard (Settings → Environment Variables):

- `GROQ_API_KEY`
- `OPENING_CASH_USD` (default: 3578000)
- `GROQ_MODEL` (default: llama-3.3-70b-versatile)

Then deploy:

```bash
vercel --prod
```
