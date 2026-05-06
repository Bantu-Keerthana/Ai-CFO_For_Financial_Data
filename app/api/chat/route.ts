import { NextResponse } from "next/server";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/agent-tools";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOOL_ROUNDS = 5;

const SYSTEM_PROMPT = `You are Maya, an AI CFO assistant for Zuro. You help the CEO understand the company's financial position using real transaction data from Mercury (banking) and Wise (international payments).

Your personality:
- Concise and direct, like a real CFO in a board meeting
- You lead with the numbers, then give context
- You flag risks and anomalies proactively
- You speak in plain business language, not accounting jargon
- You're warm but efficient — no filler

Rules:
- ALWAYS use the available tools to look up data before answering financial questions. Never guess or make up numbers.
- When you cite a number, it comes from a tool call. Every dollar figure in your answer must trace back to tool output.
- Format currency as "$X,XXX" with no decimal places for readability.
- Keep answers to 2-4 sentences for simple questions, up to a short paragraph for complex ones.
- If asked about something outside the financial data (e.g. hiring advice, product strategy), acknowledge it's outside your data scope and offer what financial context you can provide.
- For the opening briefing, cover: total cash position, net burn (last 30 days), runway, largest spend category, and one attention item.`;

type Message = {
  role: "user" | "assistant";
  content: string;
};

type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type GroqToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, isBriefing } = body as {
      messages: Message[];
      isBriefing?: boolean;
    };

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        {
          error: "GROQ_API_KEY not configured",
          fallback: true,
          message:
            "The AI agent requires a Groq API key. Please set GROQ_API_KEY in your .env.local file.",
        },
        { status: 200 }
      );
    }

    // Build messages array
    const groqMessages: GroqMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    for (const m of messages) {
      groqMessages.push({ role: m.role, content: m.content });
    }

    if (isBriefing) {
      groqMessages.push({
        role: "user",
        content:
          "Give me the opening CFO briefing. Cover our total cash position, net burn over the last 30 days, runway, the largest spend category last month, and flag one thing I should pay attention to as CEO. Keep it to about 30-45 seconds of speaking time.",
      });
    }

    // Agentic loop: call Groq, handle tool use, repeat
    let currentMessages = [...groqMessages];
    let finalText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: currentMessages,
            tools: TOOL_DEFINITIONS,
            tool_choice: "auto",
            max_tokens: 1024,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API error:", response.status, errText);
        return NextResponse.json(
          {
            error: `Groq API returned ${response.status}`,
            fallback: true,
            message:
              "I couldn't reach the AI service. Please check your API key and try again.",
          },
          { status: 200 }
        );
      }

      const result = await response.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return NextResponse.json(
          { fallback: true, message: "No response from Groq." },
          { status: 200 }
        );
      }

      const assistantMessage = choice.message;
      finalText = assistantMessage.content || "";

      const toolCalls: GroqToolCall[] = assistantMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        // No tool calls — we have the final answer
        break;
      }

      // Append the assistant message (with tool_calls) to the conversation
      currentMessages.push({
        role: "assistant",
        content: assistantMessage.content || null,
        tool_calls: toolCalls,
      });

      // Execute each tool call and append results
      for (const toolCall of toolCalls) {
        let parsedArgs: Record<string, string> = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          parsedArgs = {};
        }

        const toolOutput = executeTool(toolCall.function.name, parsedArgs);

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolOutput,
        });
      }
    }

    return NextResponse.json({ message: finalText });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        fallback: true,
        message:
          "Something went wrong processing your question. Please try again.",
      },
      { status: 200 }
    );
  }
}
