"use client";

import { useEffect, useState } from "react";

const USER = "default-home";

const REC = {
  diy: { label: "Safe to DIY", cls: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  "diy-then-pro": { label: "Try DIY, then a pro", cls: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
  pro: { label: "Call a professional", cls: "bg-rose-400/10 text-rose-300 border-rose-400/30" },
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#0B1016] px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-amber-400/60 transition-colors";

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#11161D] shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">{children}</h2>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.25)]">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0A0E13]" fill="currentColor">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white leading-none">
          Fix<span className="text-amber-400">It</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">The home repair agent that remembers your house.</p>
      </div>
    </div>
  );
}

function TokenGauge({ stats }) {
  const pct = Math.min(100, Math.round((stats.tokensUsed / stats.tokenBudget) * 100));
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
        <span>Context budget</span>
        <span className="text-amber-300 font-medium">{stats.tokensUsed} / {stats.tokenBudget} tokens</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MemoryTelemetry({ stats }) {
  if (!stats) return null;
  const items = [
    { label: "Memories scanned", value: stats.candidates },
    { label: "Recalled", value: stats.recalled },
    { label: "Compressed out", value: stats.compressed },
    { label: "Patterns learned", value: stats.patterns },
    { label: "Archived", value: stats.archived },
  ];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>Memory engine</SectionTitle>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 uppercase tracking-wide">
          {stats.mode} recall
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg bg-[#0B1016] border border-white/[0.06] px-2 py-2.5 text-center">
            <p className="font-display text-lg font-bold text-white leading-none">{it.value}</p>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{it.label}</p>
          </div>
        ))}
      </div>
      <TokenGauge stats={stats} />
    </Card>
  );
}

export default function Home() {
  const [appliances, setAppliances] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [archived, setArchived] = useState([]);
  const [form, setForm] = useState({ name: "", brand: "", location: "", installedYear: "" });
  const [problem, setProblem] = useState("");
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [memoryMode, setMemoryMode] = useState(null);
  const [memoryStats, setMemoryStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [saved, setSaved] = useState(false);

  async function loadHome() {
    const res = await fetch(`/api/home?userId=${USER}`);
    const data = await res.json();
    if (data.ok) {
      setAppliances(data.appliances || []);
      setRepairs(data.repairs || []);
      setPatterns(data.patterns || []);
      setArchived(data.archived || []);
    }
  }

  useEffect(() => {
    loadHome();
  }, []);

  async function addAppliance() {
    if (!form.name.trim()) return;
    await fetch("/api/appliances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER, appliance: form }),
    });
    setForm({ name: "", brand: "", location: "", installedYear: "" });
    loadHome();
  }

  async function deleteAppliance(applianceId) {
    await fetch("/api/appliances", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER, applianceId }),
    });
    loadHome();
  }

  async function runDiagnose(msgs) {
    setLoading(true);
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER, messages: msgs }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data.result);
        setMemoryMode(data.memoryMode);
        setMemoryStats(data.memoryStats);
        setMessages(msgs);
      }
    } finally {
      setLoading(false);
    }
  }

  function startDiagnose() {
    if (!problem.trim()) return;
    runDiagnose([{ role: "user", content: problem }]);
  }

  function answerClarify() {
    if (!clarifyAnswer.trim()) return;
    const qs = (result.clarifyingQuestions || []).join(" ");
    const next = [
      ...messages,
      { role: "assistant", content: `I need a bit more detail: ${qs}` },
      { role: "user", content: clarifyAnswer },
    ];
    setClarifyAnswer("");
    runDiagnose(next);
  }

  async function saveRepair(worked) {
    const originalProblem = messages.find((m) => m.role === "user")?.content || problem;
    await fetch("/api/repairs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER,
        repair: {
          problem: originalProblem,
          diagnosis: result.diagnosis,
          fixTried: result.steps?.[0]?.title || "Followed FixIt's guidance",
          worked,
        },
      }),
    });
    setSaved(true);
    loadHome();
  }

  async function clearHistory() {
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER }),
    });
    setResult(null);
    setMessages([]);
    setMemoryMode(null);
    setMemoryStats(null);
    setSaved(false);
    setProblem("");
    loadHome();
  }

  const rec = result && REC[result.recommendation];

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        backgroundColor: "#0A0E13",
        backgroundImage:
          "linear-gradient(rgba(251,191,36,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.025) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
      }}
    >
      <style jsx global>{`
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <header className="border-b border-white/[0.06] bg-[#0D1218]/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Logo />
          {memoryMode && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {memoryMode} memory active
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <Card className="p-5">
            <SectionTitle>Your home</SectionTitle>
            {appliances.length === 0 ? (
              <p className="text-sm text-slate-500">No appliances yet. Add one so FixIt can learn your house.</p>
            ) : (
              <ul className="space-y-2">
                {appliances.map((a) => (
                  <li
                    key={a.id}
                    className="group flex items-center justify-between rounded-lg bg-[#0B1016] border border-white/[0.06] px-3 py-2.5"
                  >
                    <div className="text-sm">
                      <span className="font-medium text-slate-100">{a.name}</span>
                      <span className="text-slate-500">
                        {a.brand ? ` · ${a.brand}` : ""}
                        {a.location ? ` · ${a.location}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteAppliance(a.id)}
                      title="Remove appliance"
                      className="flex-none w-6 h-6 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors text-sm leading-none opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 space-y-2">
            <SectionTitle>Add an appliance</SectionTitle>
            {["name", "brand", "location"].map((f) => (
              <input
                key={f}
                value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                placeholder={f[0].toUpperCase() + f.slice(1)}
                className={inputCls}
              />
            ))}
            <input
              value={form.installedYear}
              onChange={(e) => setForm({ ...form, installedYear: e.target.value })}
              placeholder="Year installed (optional)"
              className={inputCls}
            />
            <button
              onClick={addAppliance}
              className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[#0A0E13] text-sm font-semibold py-2.5 hover:brightness-110 transition-all"
            >
              Add to my home
            </button>
          </Card>

          {(patterns.length > 0 || archived.length > 0) && (
            <Card className="p-5">
              <SectionTitle>What FixIt has learned</SectionTitle>
              {patterns.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {patterns.map((p) => (
                    <li key={p.id} className="rounded-lg bg-amber-400/[0.06] border border-amber-400/20 px-3 py-2.5">
                      <p className="text-xs text-amber-200 leading-relaxed">⚡ {p.insight}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Pattern consolidated from {p.sourceCount} repairs
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {archived.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  🗄 {archived.length} outdated {archived.length === 1 ? "memory" : "memories"} archived
                  (superseded or consolidated) — keeping recall fast and relevant.
                </p>
              )}
            </Card>
          )}

          {repairs.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Repair history ({repairs.length})</SectionTitle>
                <button
                  onClick={clearHistory}
                  className="text-xs font-medium text-slate-500 hover:text-rose-400 transition-colors -mt-3"
                >
                  Clear
                </button>
              </div>
              <ul className="space-y-2.5">
                {repairs.slice(-5).reverse().map((r) => (
                  <li key={r.id} className="text-xs leading-relaxed">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                        r.worked === true ? "bg-emerald-400" : r.worked === false ? "bg-rose-400" : "bg-slate-500"
                      }`}
                    />
                    <span className="text-slate-300">{r.problem?.slice(0, 70)}</span>
                    <span className="text-slate-600"> → {r.diagnosis?.slice(0, 50)}…</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>

        <section className="space-y-5">
          <Card className="p-6">
            <label className="font-display text-lg font-semibold text-white">What&apos;s broken?</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              placeholder="e.g. My washing machine isn't draining — water sits in the drum."
              className={`${inputCls} mt-3`}
            />
            <button
              onClick={startDiagnose}
              disabled={loading}
              className="mt-3 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[#0A0E13] text-sm font-semibold px-6 py-2.5 hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center gap-2"
            >
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-[#0A0E13]/30 border-t-[#0A0E13] rounded-full animate-spin" />
              )}
              {loading ? "Diagnosing…" : "Diagnose"}
            </button>
          </Card>

          {memoryStats && result && <MemoryTelemetry stats={memoryStats} />}

          {result && (
            <Card className="p-6 space-y-5">
              {result.recalledContext ? (
                <div className="rounded-xl bg-amber-400/[0.07] border border-amber-400/25 px-4 py-3 text-sm text-amber-100">
                  <span className="font-semibold text-amber-300">🧠 FixIt remembers: </span>
                  {result.recalledContext}
                </div>
              ) : null}

              {result.needsClarification ? (
                <div className="space-y-3">
                  <p className="font-display text-base font-semibold text-white">A couple of questions first:</p>
                  <ul className="space-y-2">
                    {result.clarifyingQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                        <span className="flex-none text-amber-400 font-bold">{i + 1}.</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                  <textarea
                    value={clarifyAnswer}
                    onChange={(e) => setClarifyAnswer(e.target.value)}
                    rows={2}
                    placeholder="Your answer…"
                    className={inputCls}
                  />
                  <button
                    onClick={answerClarify}
                    disabled={loading}
                    className="rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[#0A0E13] text-sm font-semibold px-6 py-2.5 hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center gap-2"
                  >
                    {loading && (
                      <span className="w-3.5 h-3.5 border-2 border-[#0A0E13]/30 border-t-[#0A0E13] rounded-full animate-spin" />
                    )}
                    {loading ? "Thinking…" : "Continue"}
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <SectionTitle>Diagnosis</SectionTitle>
                    <p className="text-slate-100 leading-relaxed -mt-1">{result.diagnosis}</p>
                  </div>

                  {rec && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${rec.cls}`}>
                        {rec.label}
                      </span>
                      {result.estimatedCost ? (
                        <span className="text-sm text-slate-400">{result.estimatedCost}</span>
                      ) : null}
                    </div>
                  )}
                  {result.recommendationReason ? (
                    <p className="text-sm text-slate-400">{result.recommendationReason}</p>
                  ) : null}

                  {result.steps?.length > 0 && (
                    <div>
                      <SectionTitle>First fix</SectionTitle>
                      <ol className="space-y-3.5">
                        {result.steps.map((s, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-none w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[#0A0E13] text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-100">{s.title}</p>
                              <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{s.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {result.safety?.length > 0 && (
                    <div className="rounded-xl bg-rose-400/[0.07] border border-rose-400/25 px-4 py-3">
                      <p className="text-[11px] font-semibold text-rose-300 uppercase tracking-[0.14em] mb-1.5">
                        Safety
                      </p>
                      <ul className="list-disc pl-5 text-sm text-rose-200 space-y-1">
                        {result.safety.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.disclaimer ? (
                    <p className="text-xs text-slate-600 border-t border-white/[0.06] pt-3">{result.disclaimer}</p>
                  ) : null}

                  <div className="border-t border-white/[0.06] pt-4">
                    {saved ? (
                      <p className="text-sm text-emerald-400 font-medium">
                        ✓ Saved to memory — FixIt will remember this next time.
                      </p>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-slate-400">Did this fix it?</span>
                        <button
                          onClick={() => saveRepair(true)}
                          className="rounded-lg bg-emerald-500 text-[#0A0E13] text-sm font-semibold px-4 py-2 hover:brightness-110 transition-all"
                        >
                          Yes, fixed
                        </button>
                        <button
                          onClick={() => saveRepair(false)}
                          className="rounded-lg bg-white/[0.06] border border-white/10 text-slate-300 text-sm font-medium px-4 py-2 hover:bg-white/10 transition-all"
                        >
                          No, still broken
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}