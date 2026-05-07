import type { InterviewInsight } from "@/types/interview";

const categoryTone: Record<InterviewInsight["category"], string> = {
  experience: "border-taploCoral/30 bg-taploCoralSoft text-taploCoral",
  technical: "border-sky-700/25 bg-sky-50 text-sky-800",
  communication: "border-plum/25 bg-plum/5 text-plum",
  concern: "border-taploCoral/30 bg-taploCoralSoft text-taploCoralDark",
  missing: "border-slate-400/30 bg-slate-50 text-slate-700",
  "follow-up": "border-indigo-500/25 bg-indigo-50 text-indigo-700",
};

export function InsightCard({ insight }: { insight: InterviewInsight }) {
  return (
    <article className="rounded-xl border border-taploBorder bg-white p-3 shadow-soft">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink">{insight.title}</h4>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-normal ${categoryTone[insight.category]}`}
        >
          {insight.category}
        </span>
      </div>
      <p className="text-sm leading-6 text-[#666]">{insight.observation}</p>
      <div className="mt-3 rounded-xl border border-taploBorder bg-white px-3 py-2 text-xs text-[#666]">
        Confidence: <span className="font-semibold text-ink">{insight.confidence}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {insight.evidence.map((evidence) => (
          <div
            key={`${insight.id}-${evidence.timestampLabel}-${evidence.note}`}
            className="rounded-xl bg-taploWarm px-3 py-2 text-xs leading-5 text-[#666]"
          >
            <span className="font-semibold text-ink">{evidence.timestampLabel}</span>
            <span className="mx-2 text-[#BBB]">|</span>
            {evidence.note}
          </div>
        ))}
      </div>
    </article>
  );
}
