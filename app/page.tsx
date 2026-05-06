"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Send,
  Wallet,
  TrendingDown,
  Clock,
  Users,
  Mic,
  Volume2,
  VolumeX,
  Loader2,
  Play,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type MetricsData = {
  asOfDate: string;
  kpis: {
    totalCashPosition: number;
    netBurnLast30Days: number;
    marchNetBurn: number;
    totalRealOutflowsLast30Days: number;
    totalInflowsLast30Days: number;
    customerCashCollected: number;
    runwayMonths: number;
    aiComputeApril: number;
  };
  spendByCategory: { category: string; amount: number }[];
  customerInflows: { counterparty: string; amount: number }[];
  contractorSpendByCurrency: { currency: string; sentUsd: number; feesUsd: number }[];
  wiseContractorPayments: {
    date: string;
    recipient: string;
    country: string;
    sourceAmountUsd: number;
    targetAmount: number;
    targetCurrency: string;
    feeUsd: number;
    reference: string;
  }[];
  dailyCashBalance: { date: string; balance: number }[];
};

type ChatMessage = { role: "assistant" | "user"; text: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

const CHART_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const tooltipStyle = { backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", fontSize: "13px" };

// ─── Avatar Component ───────────────────────────────────────────────────────

function AvatarVisual({ isSpeaking, isThinking }: { isSpeaking: boolean; isThinking: boolean }) {
  return (
    <div className="relative w-36 h-36 mx-auto select-none">
      {/* Outer glow ring */}
      <div className={`absolute inset-[-8px] rounded-full transition-all duration-700 ${
        isSpeaking ? "bg-emerald-500/15 scale-105 animate-pulse" :
        isThinking ? "bg-cyan-500/10 scale-103 animate-pulse" :
        "bg-emerald-500/5 scale-100"
      }`} />
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg">
        <defs>
          <radialGradient id="avatarGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#065f46" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="85" fill="url(#avatarGrad)" />
        <circle cx="100" cy="100" r="85" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.3" />
        {/* CFO text */}
        <text x="100" y="96" textAnchor="middle" fill="#0f172a" fontSize="36" fontWeight="700" fontFamily="system-ui" opacity="0.8">CFO</text>
        {/* Mouth indicator when speaking */}
        {isSpeaking ? (
          <g>
            <rect x="80" y="120" width="40" height="4" rx="2" fill="#0f172a" opacity="0.4">
              <animate attributeName="height" values="3;8;3;6;3" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="y" values="121;118;121;119;121" dur="0.5s" repeatCount="indefinite" />
            </rect>
          </g>
        ) : (
          <rect x="88" y="120" width="24" height="3" rx="1.5" fill="#0f172a" opacity="0.25" />
        )}
        {/* Thinking indicator */}
        {isThinking && (
          <>
            <circle cx="88" cy="120" r="3" fill="#0f172a" opacity="0.4">
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="120" r="3" fill="#0f172a" opacity="0.4">
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1s" repeatCount="indefinite" begin="0.25s" />
            </circle>
            <circle cx="112" cy="120" r="3" fill="#0f172a" opacity="0.4">
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1s" repeatCount="indefinite" begin="0.5s" />
            </circle>
          </>
        )}
      </svg>
      {/* Waveform */}
      {isSpeaking && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-[3px] h-5">
          {[0,1,2,3,4,5,6].map((i) => (
            <div key={i} className="w-[3px] rounded-full bg-emerald-400/80"
              style={{ animation: "waveform 0.8s ease-in-out infinite", animationDelay: `${i*0.09}s`, height: "6px" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/60 p-5 backdrop-blur-sm hover:border-slate-700/80 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400 font-medium">{title}</p>
        <div className="text-emerald-400/70">{icon}</div>
      </div>
      <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>
    </div>
  );
}

// ─── Chart Card ─────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/60 p-5 backdrop-blur-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasBriefed, setHasBriefed] = useState(false);
  const [lastBriefing, setLastBriefing] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 60);
  }, [messages]);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.0;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel(); setIsSpeaking(false);
    }
  }, []);

  const sendToAgent = useCallback(async (history: ChatMessage[], isBriefing = false) => {
    setIsThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.text })), isBriefing }),
      });
      const result = await res.json();
      return result.message || result.fallback || "I wasn't able to process that.";
    } catch { return "I'm having trouble connecting. Please check your configuration."; }
    finally { setIsThinking(false); }
  }, []);

  // Init: load metrics + opening briefing
  useEffect(() => {
    async function init() {
      const metricsRes = await fetch("/api/metrics");
      const metricsJson = await metricsRes.json();
      setData(metricsJson);
      if (!hasBriefed) {
        setHasBriefed(true);
        setIsThinking(true);
        try {
          const res = await fetch("/api/chat", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [], isBriefing: true }),
          });
          const result = await res.json();
          const briefing = result.message || "Good morning. Your financial data is loaded.";
          setIsThinking(false);
          setMessages([{ role: "assistant", text: briefing }]);
          setLastBriefing(briefing);
          if (voiceEnabled) setTimeout(() => speakText(briefing), 500);
        } catch {
          setIsThinking(false);
          setMessages([{ role: "assistant", text: "Good morning. Financial data is loaded. Ask me anything about Zuro's finances." }]);
        }
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play/replay the CFO briefing
  function playCfoBriefing() {
    if (lastBriefing) {
      speakText(lastBriefing);
    } else {
      // Re-trigger briefing from agent
      (async () => {
        const reply = await sendToAgent([], true);
        setLastBriefing(reply);
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        speakText(reply);
      })();
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    const userMsg: ChatMessage = { role: "user", text: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    const reply = await sendToAgent(updated);
    const assistantMsg: ChatMessage = { role: "assistant", text: reply };
    setMessages((prev) => [...prev, assistantMsg]);
    if (voiceEnabled) setTimeout(() => speakText(reply), 300);
  }

  function startVoiceInput() {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not available in this browser."); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  // Send voice question directly (ask + auto-send)
  function askByVoice() {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not available in this browser."); return; }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript;
      setIsListening(false);
      if (!transcript.trim()) return;
      const userMsg: ChatMessage = { role: "user", text: transcript };
      const updated = [...messages, userMsg];
      setMessages(updated);
      const reply = await sendToAgent(updated);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      if (voiceEnabled) setTimeout(() => speakText(reply), 300);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading financial data…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] h-screen">

        {/* ─── LEFT: CFO ASSISTANT ─────────────────────────────────── */}
        <section className="flex flex-col h-screen border-r border-slate-800/50 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">

          {/* Header */}
          <div className="p-5 pb-4 border-b border-slate-800/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-400 text-xs font-semibold tracking-wide uppercase">Live CFO Assistant</p>
                <h1 className="text-xl font-bold tracking-tight mt-0.5">Zuro AI CFO</h1>
                <p className="text-xs text-slate-500 mt-1">Conversational finance briefing powered by deterministic CSV calculations.</p>
              </div>
              <button
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeaking(); }}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
                title={voiceEnabled ? "Mute voice" : "Enable voice"}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
          </div>

          {/* Avatar section */}
          <div className="pt-6 pb-2 px-5 flex-shrink-0">
            <AvatarVisual isSpeaking={isSpeaking} isThinking={isThinking} />
            <h2 className="text-center text-sm font-semibold mt-4">Maya, AI CFO</h2>
            <p className="text-center text-[11px] text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Voice-enabled CFO assistant. Browser text-to-speech provides the opening briefing, with typed and voice question support.
            </p>

            {/* Status badge */}
            <div className="flex justify-center mt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected to finance data
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={playCfoBriefing}
                disabled={isThinking}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 disabled:text-slate-500 font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                <Play size={15} />
                Play CFO Briefing
              </button>
              <button
                onClick={askByVoice}
                disabled={isThinking || isListening}
                className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-xl transition-colors ${
                  isListening
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                <Mic size={15} />
                {isListening ? "Listening…" : "Ask by Voice"}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="px-5 pt-4 pb-1">
            <div className="border-t border-slate-800/50" />
            <p className="text-[11px] text-slate-600 mt-2 font-medium uppercase tracking-wider">Ask the CFO</p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3 scroll-smooth">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-600/20 text-emerald-100 rounded-br-sm"
                    : "bg-slate-800/60 text-slate-200 rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-slate-800/60 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-800/40">
            <div className="flex gap-2">
              <button
                onClick={startVoiceInput}
                className={`rounded-xl px-3 flex items-center justify-center transition-colors ${
                  isListening ? "bg-red-500/20 text-red-400" : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Mic size={16} />
              </button>
              <input
                type="text"
                placeholder={isListening ? "Listening…" : "Ask about finances…"}
                className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                disabled={isThinking}
              />
              <button
                onClick={sendMessage}
                disabled={isThinking || !input.trim()}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 px-4 flex items-center justify-center transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* ─── RIGHT: DASHBOARD ────────────────────────────────────── */}
        <section className="h-screen overflow-y-auto p-6 bg-slate-950">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Finance Dashboard</h2>
              <p className="text-sm text-slate-500 mt-0.5">As of {data.asOfDate}</p>
            </div>
            <div className="text-xs bg-slate-900/80 border border-slate-800/50 px-3 py-1.5 rounded-lg text-slate-400">
              Source: Mercury + Wise CSVs
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            <KpiCard title="Total Cash Position" value={formatMoney(data.kpis.totalCashPosition)} subtitle="Opening cash + CSV activity" icon={<Wallet size={18} />} />
            <KpiCard title="Net Burn (Last 30d)" value={formatMoney(data.kpis.netBurnLast30Days)} subtitle="April 1 – April 30" icon={<TrendingDown size={18} />} />
            <KpiCard title="Runway" value={`${formatNumber(data.kpis.runwayMonths)} months`} subtitle="Cash ÷ monthly burn" icon={<Clock size={18} />} />
            <KpiCard title="Customer Cash Collected" value={formatMoney(data.kpis.customerCashCollected)} subtitle="April sales revenue" icon={<Users size={18} />} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
            <ChartCard title="Daily Cash Balance" subtitle="March – April 2026">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.dailyCashBalance}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v / 1_000_000)}M`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={(value) => [formatMoney(Number(value)), "Balance"]} contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8", fontSize: 11 }} itemStyle={{ color: "#fff" }} />
                  <Line type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#34d399" }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="April Spend by Category" subtitle="Excluding internal transfers">
              <div className="grid grid-cols-[40%_60%] items-center gap-2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.spendByCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
                      {data.spendByCategory.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2.5">
                  {data.spendByCategory.map((item, i) => {
                    const total = data.spendByCategory.reduce((s, c) => s + c.amount, 0);
                    const pct = Math.round((item.amount / total) * 100);
                    return (
                      <div key={item.category} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-slate-300">{item.category}</span>
                        </div>
                        <span className="text-slate-500 tabular-nums whitespace-nowrap">{formatMoney(item.amount)} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-6">
            <ChartCard title="Top Customer Inflows" subtitle="Sales revenue by customer">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.customerInflows.slice(0, 8)}>
                  <XAxis dataKey="counterparty" tick={false} axisLine={{ stroke: "#1e293b" }} />
                  <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}K`} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip formatter={(value) => [formatMoney(Number(value)), "Revenue"]} contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8", fontSize: 11 }} itemStyle={{ color: "#fff" }} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
                {data.customerInflows.slice(0, 8).map((c, i) => (
                  <span key={i} className="text-[10px] text-slate-500 whitespace-nowrap">{c.counterparty}</span>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="International Contractor Spend" subtitle="Wise · last 30 days">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead className="text-slate-500 border-b border-slate-800/60">
                    <tr>
                      <th className="text-left py-2.5 pl-1 font-medium">Recipient</th>
                      <th className="text-left py-2.5 font-medium">Country</th>
                      <th className="text-left py-2.5 font-medium">Ccy</th>
                      <th className="text-right py-2.5 font-medium">Sent</th>
                      <th className="text-right py-2.5 pr-1 font-medium">USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.wiseContractorPayments].sort((a, b) => b.sourceAmountUsd - a.sourceAmountUsd).map((p, i) => (
                      <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <td className="py-2.5 pl-1 text-slate-300">{p.recipient}</td>
                        <td className="py-2.5 text-slate-400">{p.country}</td>
                        <td className="py-2.5 text-slate-400">{p.targetCurrency}</td>
                        <td className="py-2.5 text-right text-slate-400 tabular-nums">{p.targetAmount.toLocaleString()}</td>
                        <td className="py-2.5 text-right pr-1 text-slate-200 tabular-nums">{formatMoney(p.sourceAmountUsd)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold border-t border-slate-700/60">
                      <td className="py-3 pl-1">Total (USD)</td>
                      <td /><td /><td />
                      <td className="py-3 text-right pr-1 text-emerald-400 tabular-nums">
                        {formatMoney(data.wiseContractorPayments.reduce((s, p) => s + p.sourceAmountUsd, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </section>
      </div>
    </main>
  );
}
