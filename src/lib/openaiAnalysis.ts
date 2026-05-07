import type { GeneratedOutput, InterviewSession, TranscriptSegment } from "@/types/interview";

export async function analyzeInterviewWithOpenAI({
  session,
  transcriptSegments,
}: {
  session: InterviewSession;
  transcriptSegments: TranscriptSegment[];
}): Promise<GeneratedOutput> {
  const response = await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, transcriptSegments }),
  });

  const payload = (await response.json()) as {
    output?: GeneratedOutput;
    error?: string;
  };

  if (!response.ok || !payload.output) {
    throw new Error(payload.error ?? "OpenAI analysis failed.");
  }

  return payload.output;
}
