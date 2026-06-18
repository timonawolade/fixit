"use client";

import { useEffect, useState } from "react";

const USER = "default-home";

const REC = {
  diy: { label: "Safe to DIY", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "diy-then-pro": { label: "Try DIY, then a pro", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  pro: { label: "Call a professional", cls: "bg-rose-100 text-rose-800 border-rose-200" },
};

export default function Home() {
  const [appliances, setAppliances] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [form, setForm] = useState({ name: "", brand: "", location: "", installedYear: "" });
  const [problem, setProblem] = useState("");
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState(null);
  const [memoryMode, setMemoryMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [saved, setSaved] = useState(false);

  async function loadHome() {
    const res = await fetch(`/api/home?userId=${USER}`);
    const data = await res.json();
    if (data.ok) {
      setAppliances(data.appliances);
      setRepairs(data.repairs);
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

  const rec = result && REC[result.recommendation];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">FixIt</h1>
            <p className="text-sm text-slate-500">The home repair agent that remembers your house.</p>
          </div>
          {memoryMode && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {memoryMode} memory
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Your home</h2>
            {appliances.length === 0 ? (
              <p className="text-sm text-slate-400">No appliances yet. Add one so FixIt can learn your house.</p>
            ) : (
              <ul className="space-y-2">
                {appliances.map((a) => (
                  <li key={a.id} className="text-sm text-slate-700">
                    <span className="font-medium">{a.name}</span>
                    {a.brand ? ` · ${a.brand}` : ""}
                    {a.location ? ` · ${a.location}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Add an appliance</h2>
            {["name", "brand", "location"].map((f) => (
              <input
                key={f}
                value={form[f]}
                onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                placeholder={f[0].toUpperCase() + f.slice(1)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            ))}
            <input
              value={form.installedYear}
              onChange={(e) => setForm({ ...form, installedYear: e.target.value })}
              placeholder="Year installed (optional)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <button
              onClick={addAppliance}
              className="w-full rounded-lg bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-700"
            >
              Add to my home
            </button>
          </div>

          {repairs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Repair history ({repairs.length})</h2>
              <ul className="space-y-2">
                {repairs.slice(-5).reverse().map((r) => (
                  <li key={r.id} className="text-xs text-slate-500">
                    <span className="text-slate-700">{r.problem}</span> → {r.diagnosis?.slice(0, 60)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <label className="text-sm font-semibold text-slate-700">What&apos;s broken?</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              placeholder="e.g. My washing machine isn't draining — water sits in the drum."
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <button
              onClick={startDiagnose}
              disabled={loading}
              className="mt-2 rounded-lg bg-indigo-600 text-white text-sm font-medium px-5 py-2 hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Diagnosing…" : "Diagnose"}
            </button>
          </div>

          {result && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              {result.recalledContext ? (
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-900">
                  <span className="font-semibold">🧠 FixIt remembers: </span>
                  {result.recalledContext}
                </div>
              ) : null}

              {result.needsClarification ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">A couple of questions first:</p>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                    {result.clarifyingQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  <textarea
                    value={clarifyAnswer}
                    onChange={(e) => setClarifyAnswer(e.target.value)}
                    rows={2}
                    placeholder="Your answer…"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={answerClarify}
                    disabled={loading}
                    className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-5 py-2 hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Diagnosis</h3>
                    <p className="mt-1 text-slate-800">{result.diagnosis}</p>
                  </div>

                  {rec && (
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${rec.cls}`}>
                        {rec.label}
                      </span>
                      {result.estimatedCost ? (
                        <span className="text-sm text-slate-500">{result.estimatedCost}</span>
                      ) : null}
                    </div>
                  )}
                  {result.recommendationReason ? (
                    <p className="text-sm text-slate-600">{result.recommendationReason}</p>
                  ) : null}

                  {result.steps?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">First fix</h3>
                      <ol className="space-y-3">
                        {result.steps.map((s, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-none w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{s.title}</p>
                              <p className="text-sm text-slate-600">{s.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {result.safety?.length > 0 && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
                      <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">Safety</p>
                      <ul className="list-disc pl-5 text-sm text-rose-800 space-y-1">
                        {result.safety.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.disclaimer ? (
                    <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">{result.disclaimer}</p>
                  ) : null}

                  <div className="border-t border-slate-100 pt-4">
                    {saved ? (
                      <p className="text-sm text-emerald-600 font-medium">
                        Saved to memory — FixIt will remember this next time.
                      </p>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600">Did this fix it?</span>
                        <button
                          onClick={() => saveRepair(true)}
                          className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-4 py-1.5 hover:bg-emerald-500"
                        >
                          Yes, fixed
                        </button>
                        <button
                          onClick={() => saveRepair(false)}
                          className="rounded-lg bg-slate-200 text-slate-700 text-sm font-medium px-4 py-1.5 hover:bg-slate-300"
                        >
                          No, still broken
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}