import { NextResponse } from "next/server";

type WhisperSegment = {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
};

type WhisperVerboseJson = {
  text?: string;
  segments?: WhisperSegment[];
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAI API key. Enter your key in the sidebar settings." },
      { status: 503 },
    );
  }

  const input = await request.formData();
  const file = input.get("file");
  const sessionId = String(input.get("sessionId") ?? `session-${Date.now()}`);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  const transcriptionRequest = new FormData();
  transcriptionRequest.append("file", file, file.name || "interview.webm");
  transcriptionRequest.append("model", "whisper-1");
  transcriptionRequest.append("response_format", "verbose_json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: transcriptionRequest,
  });

  const payload = (await response.json().catch(() => ({}))) as WhisperVerboseJson & {
    error?: { message?: string };
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "Whisper transcription failed." },
      { status: response.status },
    );
  }

  const segments =
    payload.segments?.map((segment, index) => ({
      id: `${sessionId}-segment-${segment.id ?? index + 1}`,
      sessionId,
      speaker: "Unknown",
      startSeconds: Math.max(0, Math.round(segment.start ?? 0)),
      endSeconds: Math.max(0, Math.round(segment.end ?? segment.start ?? 0)),
      text: segment.text?.trim() || "",
      source: "transcription",
    })) ?? [];

  if (!segments.length && payload.text) {
    segments.push({
      id: `${sessionId}-segment-1`,
      sessionId,
      speaker: "Unknown",
      startSeconds: 0,
      endSeconds: 0,
      text: payload.text.trim(),
      source: "transcription",
    });
  }

  return NextResponse.json({ segments });
}
