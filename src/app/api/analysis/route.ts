import { NextResponse } from "next/server";
import type {
  GeneratedOutput,
  InterviewInsight,
  InterviewSession,
  TranscriptSegment,
} from "@/types/interview";

type AnalysisRequest = {
  session?: InterviewSession;
  transcriptSegments?: TranscriptSegment[];
};

type EvidenceInput = {
  timestampLabel?: string;
  note?: string;
};

type InsightInput = {
  title?: string;
  observation?: string;
  confidence?: InterviewInsight["confidence"];
  evidence?: EvidenceInput[];
};

type ModelAnalysis = {
  candidateSummary?: string;
  projectRelevantExperienceSignals?: InsightInput[];
  technicalDomainSignals?: InsightInput[];
  communicationObservations?: InsightInput[];
  concernsOrUnclearAreas?: InsightInput[];
  missingInformation?: InsightInput[];
  suggestedFollowUpQuestions?: InsightInput[];
  clientSubmissionDraft?: string;
  candidateFollowUpEmailDraft?: string;
  internalRecruiterNotes?: string;
};

const analysisSchema = {
  name: "interview_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "candidateSummary",
      "projectRelevantExperienceSignals",
      "technicalDomainSignals",
      "communicationObservations",
      "concernsOrUnclearAreas",
      "missingInformation",
      "suggestedFollowUpQuestions",
      "clientSubmissionDraft",
      "candidateFollowUpEmailDraft",
      "internalRecruiterNotes",
    ],
    properties: {
      candidateSummary: { type: "string" },
      projectRelevantExperienceSignals: { type: "array", items: insightSchema() },
      technicalDomainSignals: { type: "array", items: insightSchema() },
      communicationObservations: { type: "array", items: insightSchema() },
      concernsOrUnclearAreas: { type: "array", items: insightSchema() },
      missingInformation: { type: "array", items: insightSchema() },
      suggestedFollowUpQuestions: { type: "array", items: insightSchema() },
      clientSubmissionDraft: { type: "string" },
      candidateFollowUpEmailDraft: { type: "string" },
      internalRecruiterNotes: { type: "string" },
    },
  },
  strict: true,
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "No OpenAI API key. Enter your key in the sidebar settings." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as AnalysisRequest;

  if (!body.session || !body.transcriptSegments?.length) {
    return NextResponse.json(
      { error: "Session and transcript segments are required." },
      { status: 400 },
    );
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
            "You generate recruiter interview notes for understanding only. Never rank people, recommend hire/reject/move-forward decisions, assign scores, infer personality, or analyze emotions. Use only evidence from the transcript, meeting job description, optional CV/context text, and recruiter notes. Mark unclear or missing information plainly.",
        },
        {
          role: "user",
          content: JSON.stringify({
            outputLanguage: body.session.outputLanguage,
            meeting: {
              title: body.session.meetingTitle,
            },
            roleContext: body.session.jobDescriptionSnapshot,
            candidateContext: body.session.cvTextSnapshot,
            recruiterNotes: body.session.recruiterNotes,
            transcriptSegments: body.transcriptSegments,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...analysisSchema,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (!response.ok) {
    return NextResponse.json(
      { error: payload.error?.message ?? "OpenAI analysis failed." },
      { status: response.status },
    );
  }

  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? [])[0]?.text;

  if (!text) {
    return NextResponse.json({ error: "OpenAI analysis returned no text." }, { status: 502 });
  }

  const analysis = JSON.parse(text) as ModelAnalysis;

  return NextResponse.json({
    output: normalizeAnalysis({
      analysis,
      session: body.session,
      transcriptSegments: body.transcriptSegments,
    }),
  });
}

function insightSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "observation", "confidence", "evidence"],
    properties: {
      title: { type: "string" },
      observation: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["timestampLabel", "note"],
          properties: {
            timestampLabel: { type: "string" },
            note: { type: "string" },
          },
        },
      },
    },
  };
}

function normalizeAnalysis({
  analysis,
  session,
  transcriptSegments,
}: {
  analysis: ModelAnalysis;
  session: InterviewSession;
  transcriptSegments: TranscriptSegment[];
}): GeneratedOutput {
  return {
    id: `output-${session.id}`,
    sessionId: session.id,
    language: session.outputLanguage,
    candidateSummary: analysis.candidateSummary ?? "",
    projectRelevantExperienceSignals: normalizeInsights(
      analysis.projectRelevantExperienceSignals,
      session.id,
      "experience",
      transcriptSegments,
    ),
    technicalDomainSignals: normalizeInsights(
      analysis.technicalDomainSignals,
      session.id,
      "technical",
      transcriptSegments,
    ),
    communicationObservations: normalizeInsights(
      analysis.communicationObservations,
      session.id,
      "communication",
      transcriptSegments,
    ),
    concernsOrUnclearAreas: normalizeInsights(
      analysis.concernsOrUnclearAreas,
      session.id,
      "concern",
      transcriptSegments,
    ),
    missingInformation: normalizeInsights(
      analysis.missingInformation,
      session.id,
      "missing",
      transcriptSegments,
    ),
    suggestedFollowUpQuestions: normalizeInsights(
      analysis.suggestedFollowUpQuestions,
      session.id,
      "follow-up",
      transcriptSegments,
    ),
    clientSubmissionDraft: analysis.clientSubmissionDraft ?? "",
    candidateFollowUpEmailDraft: analysis.candidateFollowUpEmailDraft ?? "",
    internalRecruiterNotes: analysis.internalRecruiterNotes ?? "",
    generatedAt: new Date().toISOString(),
    disclaimer: "This tool organizes interview information. It does not make hiring decisions.",
  };
}

function normalizeInsights(
  insights: InsightInput[] | undefined,
  sessionId: string,
  category: InterviewInsight["category"],
  transcriptSegments: TranscriptSegment[],
): InterviewInsight[] {
  return (insights ?? []).map((insight, index) => ({
    id: `${sessionId}-${category}-${index + 1}`,
    sessionId,
    category,
    title: insight.title ?? "Observation",
    observation: insight.observation ?? "",
    confidence: insight.confidence ?? "low",
    evidence: (insight.evidence ?? []).map((evidence) => ({
      timestampLabel: evidence.timestampLabel ?? "Transcript",
      note: evidence.note ?? "",
      transcriptSegmentId: findSegmentId(transcriptSegments, evidence.timestampLabel),
    })),
  }));
}

function findSegmentId(segments: TranscriptSegment[], timestampLabel?: string) {
  if (!timestampLabel) return undefined;
  return segments.find((segment) => timestampLabel.includes(String(segment.startSeconds)))?.id;
}
