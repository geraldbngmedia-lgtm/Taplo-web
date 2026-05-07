import type { WorkspaceData } from "@/types/interview";

export const initialWorkspaceData: WorkspaceData = {
  calendarConnections: [
    { id: "calendar-manual", provider: "manual", status: "connected", connectedAt: "2026-05-06T00:00:00.000Z" },
    { id: "calendar-google", provider: "google", status: "available", configured: false },
    { id: "calendar-outlook", provider: "outlook", status: "available", configured: false },
    { id: "calendar-teams", provider: "teams", status: "available", configured: false },
  ],
  calendarMeetings: [],
  projects: [],
  candidates: [],
  sessions: [],
  transcriptSegments: [],
  generatedOutputs: [],
  recruiterNotes: [],
};
