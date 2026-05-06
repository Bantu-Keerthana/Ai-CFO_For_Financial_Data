# Zuro AI CFO — Writeup

## Architecture

The app is a Next.js split-screen dashboard with three core layers:

### 1. Deterministic Finance Engine (`lib/finance.ts`)

All financial calculations — cash position, burn rate, runway, spend categories, customer collections, contractor payments — are computed deterministically in TypeScript from the Mercury and Wise CSV files. The LLM never calculates money. This module is the single source of truth for every number shown in the dashboard and spoken by the assistant.

Key calculation decisions:

- **Opening cash is configurable** via `OPENING_CASH_USD` because the CSVs contain transaction activity but no explicit starting balance.
- **Internal transfers are excluded** from operating outflows. Mercury rows with category "Internal Transfer" (Wise funding wires, Brex top-ups) are filtered out before burn calculations.
- **Wise contractor sends are included** in total outflows. Only rows with `Type: "Send"` are counted; Topup and Conversion rows are excluded.
- **Spend categories are mapped** to executive-level groupings: Payroll, AI Compute, Software, Benefits, Recruiting, and Other (which includes Legal and Rent & Utilities).

### 2. Tool-Calling Agent (`lib/agent-tools.ts` + `app/api/chat/route.ts`)

The AI assistant uses the Groq API with OpenAI-compatible tool-use. Eight finance tools are defined in OpenAI function-calling format, each backed by the same `getFinanceData()` function. When the user asks a question:

1. The question is sent to Groq (Llama 3.3 70B) with all 8 tool definitions
2. The model decides which tools are needed and calls them
3. Our code executes each tool against the deterministic finance engine
4. Tool results are returned to the model
5. The model composes a natural language answer using only the tool outputs
6. If the model needs more data, it can call additional tools (up to 5 rounds)

This is the agent design the brief asks for — not a single LLM call with CSVs stuffed into the prompt, and not keyword matching. The model reasons about which data to fetch, and the finance engine provides verified numbers.

### 3. Frontend (`app/page.tsx`)

A single-page split-screen layout:

**Left panel (Maya, AI CFO):**
- Header with "Live CFO Assistant" branding and voice toggle
- Animated SVG avatar with speaking, thinking, and idle states
- "Connected to finance data" status badge
- "Play CFO Briefing" button to hear/replay the opening briefing
- "Ask by Voice" button for hands-free voice questions (speech recognition + auto-send)
- Chat thread with "Ask the CFO" label
- Text input with inline mic button for dictation

**Right panel (Finance Dashboard):**
- 4 KPI cards: Total Cash Position, Net Burn (Last 30d), Runway, Customer Cash Collected
- Daily Cash Balance line chart (March–April)
- April Spend by Category donut chart with legend
- Top Customer Inflows bar chart
- International Contractor Spend table with totals

Both panels read from the same deterministic finance layer, so numbers are always consistent between the dashboard and the assistant.

## Agent Design

The agent is the core differentiator in this submission. Here is how it works in detail:

**Tool definitions** (`lib/agent-tools.ts`): Each tool has a name, description, and JSON Schema parameters in OpenAI function-calling format. The descriptions are written to help the model understand when to use each tool — for example, `get_burn_metrics` mentions "month-over-month comparisons" so the model knows to use it for comparison questions.

**Agentic loop** (`app/api/chat/route.ts`): The chat endpoint runs a loop of up to 5 rounds. Each round sends the current conversation to Groq, checks if the response includes tool calls, executes them, appends results, and continues. The loop exits when the model returns a final text response with no tool calls.

**System prompt**: Maya is instructed to always use tools before answering financial questions, never guess numbers, format currency without decimals, and keep answers concise. For the opening briefing, she covers cash position, net burn, runway, largest spend category, and one attention item.

**Example flow** — user asks "Compare March and April burn":

```
Round 1: Groq calls get_burn_metrics(month: "both")
         → Returns: { april: { netBurn: 137851 }, march: { netBurn: 130285 }, comparison: { burnChangeUsd: 7566, direction: "increased" } }
Round 2: Groq composes final answer using the tool data
         → "April net burn was $137,851, up from $130,285 in March — an increase of about $7,566..."
```

**Example flow** — user asks "What's our runway and what's driving our biggest expenses?":

```
Round 1: Groq calls get_runway() AND get_spend_by_category()
         → Returns runway data + category breakdown
Round 2: Groq composes answer combining both tool results
         → "We have about 23 months of runway. The largest expense category is Payroll at $194,400..."
```

## Why Groq

I chose Groq for the agent layer because:

- It supports OpenAI-compatible tool-use, which is the standard format for function-calling agents
- Response latency is significantly lower than other providers, which matters for a conversational assistant
- Llama 3.3 70B handles tool-calling reliably for this use case
- Free tier is sufficient for demo and evaluation purposes

The model is configurable via `GROQ_MODEL` environment variable if the reviewer wants to test with a different model.

## Reliability and Evaluation

The Vitest suite in `__tests__/finance.test.ts` validates key metrics:

| Metric | Expected | Test |
|--------|----------|------|
| April customer cash collected | $176,500 | Exact match |
| April AI compute spend | $33,530 | Exact match |
| April net burn | $130K–$145K | Range check |
| Wise contractor total | $28,305 | Exact match |
| Spend categories | Payroll, AI Compute, Software, Other | Presence check |

Run with: `npm run test`

The agent's reliability comes from the architectural separation: the LLM handles language and reasoning, the finance engine handles numbers. Even if the LLM produces an unusual response, the underlying calculations are always correct and verifiable through the test suite.

## Tools and AI Assistance Used

- **Frameworks**: Next.js 16, TypeScript, Tailwind CSS 4, Recharts, PapaParse, Vitest
- **AI provider**: Groq API (Llama 3.3 70B Versatile) for the agent layer with tool-use
- **Browser APIs**: SpeechSynthesis (text-to-speech), SpeechRecognition (voice input)
- **Development assistance**: I also used ChatGPT as a development assistant during the task. I used it to help break down the requirements, plan the project structure, debug UI issues, and review parts of the implementation. The final implementation choices, code edits, testing, UI adjustments, and tradeoff decisions were done by me while building and validating the app locally.

## Time Spent

Approximately 6 hours total:

- Requirement review and architecture planning: ~30 minutes
- Finance engine and CSV data parsing: ~1 hour
- Agent design — tool definitions, chat API route, agentic loop: ~1 hour 30 minutes
- Dashboard UI — KPI cards, charts, tables, responsive layout: ~1 hour 15 minutes
- CFO assistant UI — avatar animation, Play Briefing, Ask by Voice, voice toggle, chat thread: ~1 hour
- Testing, README, writeup, polish: ~45 minutes

## Tradeoffs

### Browser TTS over video avatar API

I used browser-native speech synthesis rather than integrating HeyGen or Tavus. This kept the build reliable, self-contained, and deployable without managing third-party API credentials or rate limits. The animated SVG avatar provides visual feedback during speaking and thinking states. The component is structured so a streaming video avatar could replace the SVG later — it would only need to accept `isSpeaking` and `isThinking` props.

### Groq over direct OpenAI/Anthropic

Groq provides significantly lower latency for the agentic loop, which means Maya responds faster to questions. The tool-calling format is OpenAI-compatible, so switching to another provider (OpenAI, Anthropic, etc.) would only require changing the API endpoint and authentication in one file (`app/api/chat/route.ts`).

### No streaming

The chat API returns the full response at once rather than streaming tokens. This was a time-budget decision. Streaming would improve perceived latency but adds complexity to the tool-calling loop (tool calls must complete before the final response streams). With Groq's low latency, the trade-off was acceptable.

### Configurable opening cash

The CSVs contain transaction activity but no explicit opening balance. Rather than hardcode an assumption, I made it configurable via `OPENING_CASH_USD`. This keeps the calculation transparent and allows the reviewer to test with different starting balances.

## What I Would Add Next

With more time, in priority order:

1. **Streaming responses** — Stream the agent's text output for faster perceived response time, especially for longer answers
2. **Transaction-level citations** — Tag each number in the agent's response with the exact CSV row references that produced it, so the CEO can click through to source data
3. **Video avatar** — Integrate HeyGen or Tavus for a realistic speaking avatar with lip-sync
4. **Live API connections** — Replace CSV parsing with real Mercury and Wise API integrations so the dashboard updates from live account data
5. **More evaluation cases** — Test edge cases: missing categories, duplicate transactions, refunds, partial months, internal transfer detection, Wise currency conversion handling
6. **Authentication and multi-tenant** — Add user auth and separate financial data by company before using with real data
7. **Dashboard interaction** — Click a KPI card or chart element to ask Maya about that specific metric
