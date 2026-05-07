export type SupportedLanguage = "en" | "sv";

export type CalendarProvider = "manual" | "google" | "outlook" | "teams";

export type CalendarConnection = {
  id: string;
  provider: CalendarProvider;
  status: "available" | "connected";
  configured?: boolean;
  connectedAt?: string;
};

export type CalendarMeeting = {
  id: string;
  externalId?: string;
  provider: CalendarProvider;
  title: string;
  startsAt: string;
  endsAt: string;
  candidateName: string;
  attendeeEmails: string[];
  meetingUrl: string;
  jobDescription: string;
  cvText: string;
  recruiterNotes: string;
  outputLanguage: SupportedLanguage;
  status: "upcoming" | "ready" | "completed";
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  clientName: string;
  jobDescription: string;
  defaultLanguage: SupportedLanguage;
  createdAt: string;
};

export type Candidate = {
  id: string;
  projectId?: string;
  name: string;
  cvText: string;
  profileLink: string;
  recruiterNotes: string;
  createdAt: string;
};

export type InterviewSession = {
  id: string;
  meetingId?: string;
  projectId?: string;
  candidateId?: string;
  meetingTitle?: string;
  candidateName?: string;
  jobDescriptionSnapshot: string;
  cvTextSnapshot: string;
  outputLanguage: SupportedLanguage;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  transcriptionCostUsd: number;
  aiAnalysisCostUsd: number;
  recruiterNotes: string;
  recordingUrl?: string;
  recordingMimeType?: string;
  status: "draft" | "recording" | "completed" | "analysis_pending" | "analyzed";
};

export type TranscriptSegment = {
  id: string;
  sessionId: string;
  speaker: "Recruiter" | "Candidate" | "Unknown";
  startSeconds: number;
  endSeconds: number;
  text: string;
  source: "transcription";
};

export type EvidenceReference = {
  transcriptSegmentId?: string;
  timestampLabel: string;
  note: string;
};

export type InsightCategory =
  | "experience"
  | "technical"
  | "communication"
  | "concern"
  | "missing"
  | "follow-up";

export type InterviewInsight = {
  id: string;
  sessionId: string;
  category: InsightCategory;
  title: string;
  observation: string;
  confidence: "low" | "medium" | "high";
  evidence: EvidenceReference[];
};

export type GeneratedOutput = {
  id: string;
  sessionId: string;
  language: SupportedLanguage;
  candidateSummary: string;
  projectRelevantExperienceSignals: InterviewInsight[];
  technicalDomainSignals: InterviewInsight[];
  communicationObservations: InterviewInsight[];
  concernsOrUnclearAreas: InterviewInsight[];
  missingInformation: InterviewInsight[];
  suggestedFollowUpQuestions: InterviewInsight[];
  clientSubmissionDraft: string;
  candidateFollowUpEmailDraft: string;
  internalRecruiterNotes: string;
  generatedAt: string;
  disclaimer: string;
};

export type RecruiterNote = {
  id: string;
  sessionId: string;
  text: string;
  createdAt: string;
  timestampSeconds?: number;
};

export type WorkspaceData = {
  calendarConnections: CalendarConnection[];
  calendarMeetings: CalendarMeeting[];
  projects: Project[];
  candidates: Candidate[];
  sessions: InterviewSession[];
  transcriptSegments: TranscriptSegment[];
  generatedOutputs: GeneratedOutput[];
  recruiterNotes: RecruiterNote[];
};
