import { initialWorkspaceData } from "@/lib/initialData";
import { estimateInterviewCost } from "@/lib/costs";
import type { Candidate, Project, WorkspaceData } from "@/types/interview";

const STORAGE_KEY = "interview-intelligence-workspace:v1";

export function loadWorkspaceData(): WorkspaceData {
  if (typeof window === "undefined") return initialWorkspaceData;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialWorkspaceData;

  try {
    return normalizeWorkspaceData(JSON.parse(stored));
  } catch {
    return initialWorkspaceData;
  }
}

export function saveWorkspaceData(data: WorkspaceData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeWorkspaceData(data: Partial<WorkspaceData>): WorkspaceData {
  const projects: Project[] = (data.projects?.length ? data.projects : initialWorkspaceData.projects).map(
    (project) => ({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      jobDescription:
        project.jobDescription ??
        (project as typeof project & { description?: string }).description ??
        "Add the job description for this project.",
      defaultLanguage: project.defaultLanguage ?? "en",
      createdAt: project.createdAt,
    }),
  );

  const candidates: Candidate[] = (data.candidates ?? initialWorkspaceData.candidates).map(
    (candidate) => ({
      id: candidate.id,
      projectId: candidate.projectId,
      name: candidate.name,
      cvText: candidate.cvText,
      profileLink: candidate.profileLink,
      recruiterNotes: candidate.recruiterNotes,
      createdAt: candidate.createdAt,
    }),
  );

  return {
    calendarConnections: data.calendarConnections ?? initialWorkspaceData.calendarConnections,
    calendarMeetings: (data.calendarMeetings ?? initialWorkspaceData.calendarMeetings).map((meeting) => ({
      ...meeting,
      attendeeEmails: meeting.attendeeEmails ?? [],
    })),
    projects,
    candidates,
    sessions: (data.sessions ?? initialWorkspaceData.sessions).map((session) => {
      const costs = estimateInterviewCost(session.durationSeconds ?? 0);
      return {
        id: session.id,
        meetingId: session.meetingId,
        projectId: session.projectId,
        candidateId: session.candidateId,
        meetingTitle: session.meetingTitle,
        candidateName: session.candidateName,
        jobDescriptionSnapshot:
          session.jobDescriptionSnapshot ??
          projects.find((project) => project.id === session.projectId)?.jobDescription ??
          "",
        cvTextSnapshot:
          session.cvTextSnapshot ??
          candidates.find((candidate) => candidate.id === session.candidateId)?.cvText ??
          "",
        outputLanguage: session.outputLanguage ?? "en",
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        transcriptionCostUsd: session.transcriptionCostUsd ?? costs.transcriptionCostUsd,
        aiAnalysisCostUsd: session.aiAnalysisCostUsd ?? costs.aiAnalysisCostUsd,
        recruiterNotes: session.recruiterNotes,
        recordingUrl: session.recordingUrl,
        recordingMimeType: session.recordingMimeType,
        status: session.status,
      };
    }),
    transcriptSegments: data.transcriptSegments ?? initialWorkspaceData.transcriptSegments,
    generatedOutputs: (data.generatedOutputs ?? initialWorkspaceData.generatedOutputs).map((output) => ({
      ...output,
      language: output.language ?? "en",
    })),
    recruiterNotes: data.recruiterNotes ?? initialWorkspaceData.recruiterNotes,
  };
}
