import type { GeneratedOutput, InterviewSession, TranscriptSegment } from "@/types/interview";

export async function analyzeInterviewWithOpenAI({
  session,
  transcriptSegments,
  apiKey,
}: {
  session: InterviewSession;
  transcriptSegments: TranscriptSegment[];
  apiKey?: string;
}): Promise<GeneratedOutput> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (apiKey) headers["X-OpenAI-Key"] = apiKey;

  const response = await fetch("/api/analysis", {
    method: "POST",
    headers,
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
