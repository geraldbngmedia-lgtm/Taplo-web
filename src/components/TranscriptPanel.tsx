import { formatTimestamp } from "@/lib/time";
import type { TranscriptSegment } from "@/types/interview";

export function TranscriptPanel({
  segments,
}: {
  segments: TranscriptSegment[];
}) {
  return (
    <div className="grid gap-3">
      {segments.map((segment) => (
        <article
          key={segment.id}
          className="rounded-xl border border-taploBorder bg-white p-3 shadow-soft"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-ink">{segment.speaker}</span>
            <span className="rounded-full bg-taploCoralSoft px-2 py-1 text-taploCoral">
              {formatTimestamp(segment.startSeconds)} -{" "}
              {formatTimestamp(segment.endSeconds)}
            </span>
          </div>
          <p className="text-sm leading-6 text-[#666]">{segment.text}</p>
        </article>
      ))}
    </div>
  );
}
