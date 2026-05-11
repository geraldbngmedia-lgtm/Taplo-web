import type { TranscriptSegment } from "@/types/interview";

export async function transcribeAudioWithWhisper({
  audioBlob,
  sessionId,
  apiKey,
}: {
  audioBlob: Blob;
  sessionId: string;
  apiKey?: string;
}): Promise<TranscriptSegment[]> {
  const formData = new FormData();
  const extension = audioBlob.type.includes("mp4")
    ? "mp4"
    : audioBlob.type.includes("mpeg")
      ? "mp3"
      : "webm";

  formData.append("file", audioBlob, `interview-${sessionId}.${extension}`);
  formData.append("sessionId", sessionId);

  const headers: HeadersInit = {};
  if (apiKey) headers["X-OpenAI-Key"] = apiKey;

  const response = await fetch("/api/transcriptions", {
    method: "POST",
    headers,
    body: formData,
  });

  const payload = (await response.json()) as {
    segments?: TranscriptSegment[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Whisper transcription failed.");
  }

  return payload.segments ?? [];
}
