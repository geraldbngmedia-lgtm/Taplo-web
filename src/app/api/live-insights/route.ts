import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No OpenAI API key." }, { status: 503 });
  }

  const body = (await request.json()) as { transcript?: string; jobDescription?: string };
  if (!body.transcript?.trim() || !body.jobDescription?.trim()) {
    return NextResponse.json({ covered: [], gaps: [], followUps: [] });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You analyse an in-progress interview transcript against a job description. " +
            "Return three short lists: covered (JD requirements clearly evidenced so far), " +
            "gaps (requirements not yet addressed), followUps (concise questions the recruiter should ask next). " +
            "Keep each item under 10 words. Return only what is clearly evidenced — do not speculate.",
        },
        {
          role: "user",
          content: JSON.stringify({
            jobDescription: body.jobDescription,
            transcript: body.transcript,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "live_insights",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["covered", "gaps", "followUps"],
            properties: {
              covered: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              followUps: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "Live insights failed." },
      { status: response.status },
    );
  }

  const text =
    payload.output_text ?? payload.output?.flatMap((item) => item.content ?? [])[0]?.text;

  if (!text) return NextResponse.json({ covered: [], gaps: [], followUps: [] });

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ covered: [], gaps: [], followUps: [] });
  }
}
