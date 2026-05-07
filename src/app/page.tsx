"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileAudio,
  LayoutDashboard,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Square,
} from "lucide-react";
import { InsightCard } from "@/components/InsightCard";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EmptyState, Field, Section, inputClass, textAreaClass } from "@/components/ui";
import { estimateInterviewCost, formatUsd } from "@/lib/costs";
import { getTranslator, type TranslationKey } from "@/lib/i18n";
import { initialWorkspaceData } from "@/lib/initialData";
import { analyzeInterviewWithOpenAI } from "@/lib/openaiAnalysis";
import { transcribeAudioWithWhisper } from "@/lib/transcription";
import { loadWorkspaceData, saveWorkspaceData } from "@/lib/storage";
import { formatDuration, formatTimestamp } from "@/lib/time";
import type {
  CalendarMeeting,
  CalendarProvider,
  GeneratedOutput,
  InterviewInsight,
  InterviewSession,
  RecruiterNote,
  SupportedLanguage,
  TranscriptSegment,
  WorkspaceData,
} from "@/types/interview";

type Screen = "dashboard" | "meetings" | "analysis" | "usage";

type WorkspaceAccount = {
  name: string;
  email: string;
  company: string;
  createdAt: string;
};

type AuthScreen = "landing" | "onboarding";

const accountStorageKey = "interview-intelligence-account";
const calendarSetupStorageKey = "interview-intelligence-calendar-setup";

const navigation: { id: Screen; labelKey: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "meetings", labelKey: "meetings", icon: CalendarDays },
  { id: "analysis", labelKey: "analysis", icon: ClipboardList },
  { id: "usage", labelKey: "usage", icon: BarChart3 },
];

export default function Home() {
  const [account, setAccount] = useState<WorkspaceAccount | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("landing");
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");
  const [uiLanguage, setUiLanguage] = useState<SupportedLanguage>("en");
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>(initialWorkspaceData);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(
    initialWorkspaceData.sessions[0]?.id ?? "",
  );
  const [selectedMeetingId, setSelectedMeetingId] = useState(
    initialWorkspaceData.calendarMeetings[0]?.id ?? "",
  );
  const [outputLanguage, setOutputLanguage] = useState<SupportedLanguage>("en");
  const [meetingForm, setMeetingForm] = useState({
    provider: "manual" as CalendarProvider,
    title: "",
    candidateName: "",
    startsAt: "",
    endsAt: "",
    meetingUrl: "",
  });
  const [interviewNotes, setInterviewNotes] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [calendarSyncStatus, setCalendarSyncStatus] = useState("");
  const [calendarSetupMessage, setCalendarSetupMessage] = useState("");
  const [calendarSetupChoice, setCalendarSetupChoice] = useState<CalendarProvider | null>(null);
  const [calendarSyncMode, setCalendarSyncMode] = useState<"interviews" | "all">("interviews");
  const [isCapturePanelOpen, setIsCapturePanelOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const intervalRef = useRef<number | null>(null);
  const t = getTranslator(uiLanguage);

  const { calendarConnections, calendarMeetings, sessions, transcriptSegments, generatedOutputs, recruiterNotes } =
    workspaceData;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const selectedMeeting =
    calendarMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? calendarMeetings[0];
  const selectedOutput = generatedOutputs.find((output) => output.sessionId === selectedSession?.id);
  const selectedTranscript = transcriptSegments.filter(
    (segment) => segment.sessionId === selectedSession?.id,
  );

  const usage = useMemo(() => {
    const totals = sessions.reduce(
      (acc, session) => ({
        durationSeconds: acc.durationSeconds + session.durationSeconds,
        transcription: acc.transcription + session.transcriptionCostUsd,
        ai: acc.ai + session.aiAnalysisCostUsd,
      }),
      { durationSeconds: 0, transcription: 0, ai: 0 },
    );
    return { ...totals, total: totals.transcription + totals.ai };
  }, [sessions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const data = loadWorkspaceData();
      setWorkspaceData(data);
      setSelectedSessionId(data.sessions[0]?.id ?? "");
      setSelectedMeetingId(data.calendarMeetings[0]?.id ?? "");
      setOutputLanguage(data.calendarMeetings[0]?.outputLanguage ?? "en");
      const savedAccount = window.localStorage.getItem(accountStorageKey);
      if (savedAccount) {
        try {
          setAccount(JSON.parse(savedAccount) as WorkspaceAccount);
        } catch {
          window.localStorage.removeItem(accountStorageKey);
        }
      }
      const savedSetupChoice = window.localStorage.getItem(calendarSetupStorageKey);
      if (isCalendarProvider(savedSetupChoice)) {
        setCalendarSetupChoice(savedSetupChoice);
        setActiveScreen("meetings");
      }
      setHasLoadedStorage(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (hasLoadedStorage) saveWorkspaceData(workspaceData);
  }, [hasLoadedStorage, workspaceData]);

  useEffect(() => {
    async function refreshCalendarStatus() {
      const response = await fetch("/api/calendar/status");
      if (!response.ok) return;
      const payload = (await response.json()) as {
        providers: Record<string, { configured: boolean; connected: boolean }>;
      };

      updateWorkspaceData((current) => ({
        ...current,
        calendarConnections: current.calendarConnections.map((connection) => {
          if (connection.provider === "manual") return connection;
          const providerStatus = payload.providers[connection.provider];
          return {
            ...connection,
            configured: providerStatus?.configured ?? false,
            status: providerStatus?.connected ? "connected" : "available",
            connectedAt: providerStatus?.connected
              ? connection.connectedAt ?? new Date().toISOString()
              : undefined,
          };
        }),
      }));
    }

    if (hasLoadedStorage) void refreshCalendarStatus();
  }, [hasLoadedStorage]);

  function updateWorkspaceData(updater: (current: WorkspaceData) => WorkspaceData) {
    setWorkspaceData((current) => updater(current));
  }

  function createAccount() {
    if (!accountForm.name || !accountForm.email || !accountForm.company) return;

    const nextAccount: WorkspaceAccount = {
      ...accountForm,
      createdAt: new Date().toISOString(),
    };

    setAccount(nextAccount);
    window.localStorage.setItem(accountStorageKey, JSON.stringify(nextAccount));
  }

  function addMeeting() {
    const now = new Date();
    const startsAt = meetingForm.startsAt ? new Date(meetingForm.startsAt).toISOString() : now.toISOString();
    const endsAt = meetingForm.endsAt
      ? new Date(meetingForm.endsAt).toISOString()
      : new Date(new Date(startsAt).getTime() + 45 * 60 * 1000).toISOString();
    const meeting: CalendarMeeting = {
      id: `meeting-${Date.now()}`,
      provider: meetingForm.provider,
      title: meetingForm.meetingUrl ? meetingForm.meetingUrl : "Manual interview",
      startsAt,
      endsAt,
      candidateName: meetingForm.candidateName,
      attendeeEmails: [],
      meetingUrl: meetingForm.meetingUrl,
      jobDescription: "",
      cvText: "",
      recruiterNotes: "",
      outputLanguage: "en",
      status: "upcoming",
      createdAt: new Date().toISOString(),
    };

    updateWorkspaceData((current) => ({
      ...current,
      calendarMeetings: [meeting, ...current.calendarMeetings],
    }));
    setSelectedMeetingId(meeting.id);
    setMeetingForm({ provider: meetingForm.provider, title: "", candidateName: "", startsAt: "", endsAt: "", meetingUrl: "" });
    setActiveScreen("meetings");
  }

  function joinMeeting(meeting: CalendarMeeting) {
    setSelectedMeetingId(meeting.id);
    setOutputLanguage(meeting.outputLanguage);
    setRecordingError("");
    setTranscriptionStatus("");
    setIsCapturePanelOpen(true);

    if (meeting.meetingUrl) {
      window.open(meeting.meetingUrl, "_blank", "noopener,noreferrer");
    }
  }

  function connectCalendar(provider: CalendarProvider) {
    if (provider === "manual") {
      persistCalendarSetupChoice(provider);
      setMeetingForm((current) => ({ ...current, provider }));
      setCalendarSetupMessage("");
      setCalendarSyncStatus("Manual meeting entry selected. Add the interview details below.");
      setActiveScreen("meetings");
      return;
    }

    const connection = calendarConnections.find((item) => item.provider === provider);
    if (connection?.configured !== true && connection?.status !== "connected") {
      const requiredEnv =
        provider === "google"
          ? "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
          : "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET";
      const providerName = provider === "google" ? "Google Calendar" : "Microsoft Calendar";

      setCalendarSetupMessage(
        `${providerName} is not configured yet. Add ${requiredEnv} to .env.local, restart the app, then click Connect again.`,
      );
      setCalendarSyncStatus("");
      return;
    }

    persistCalendarSetupChoice(provider);
    setCalendarSetupMessage("");
    window.location.href = `/api/calendar/connect/${provider}`;
  }

  function persistCalendarSetupChoice(provider: CalendarProvider) {
    setCalendarSetupChoice(provider);
    window.localStorage.setItem(calendarSetupStorageKey, provider);
  }

  async function disconnectCalendar(provider: CalendarProvider) {
    if (provider === "manual") return;
    await fetch(`/api/calendar/disconnect/${provider}`, { method: "POST" });
    updateWorkspaceData((current) => ({
      ...current,
      calendarConnections: current.calendarConnections.map((connection) =>
        connection.provider === provider
          ? { id: connection.id, provider: connection.provider, status: "available" }
          : connection,
      ),
    }));
    setMeetingForm((current) => ({
      ...current,
      provider: current.provider === provider ? "manual" : current.provider,
    }));
  }

  function updateMeeting(meetingId: string, updates: Partial<CalendarMeeting>) {
    updateWorkspaceData((current) => ({
      ...current,
      calendarMeetings: current.calendarMeetings.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              ...updates,
              status:
                updates.jobDescription || updates.cvText || updates.recruiterNotes
                  ? "ready"
                  : meeting.status,
            }
          : meeting,
      ),
    }));
  }

  async function syncCalendarEvents(provider: CalendarProvider) {
    if (provider === "manual") return;

    setCalendarSyncStatus(`Syncing ${provider} calendar events...`);
    const response = await fetch(`/api/calendar/events/${provider}`);
    const payload = (await response.json()) as {
      events?: Array<{
        externalId: string;
        title: string;
        startsAt: string;
        endsAt: string;
        meetingUrl: string;
        description: string;
        attendeeEmails?: string[];
      }>;
      error?: string;
    };

    if (!response.ok) {
      setCalendarSyncStatus(payload.error ?? `${provider} calendar sync failed.`);
      return;
    }

    const sourceEvents =
      calendarSyncMode === "interviews"
        ? (payload.events ?? []).filter((event) => isInterviewLikeEvent(event.title, event.description))
        : payload.events ?? [];
    const importedMeetings: CalendarMeeting[] = sourceEvents.map((event) => ({
      id: `meeting-${provider}-${event.externalId}`,
      externalId: event.externalId,
      provider,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      candidateName: inferCandidateName(event.title, event.attendeeEmails ?? []),
      attendeeEmails: event.attendeeEmails ?? [],
      meetingUrl: event.meetingUrl,
      jobDescription: "",
      cvText: "",
      recruiterNotes: event.description,
      outputLanguage: "en",
      status: "upcoming",
      createdAt: new Date().toISOString(),
    }));

    updateWorkspaceData((current) => ({
      ...current,
      calendarMeetings: [
        ...importedMeetings,
        ...current.calendarMeetings.filter(
          (meeting) =>
            !importedMeetings.some(
              (imported) =>
                imported.provider === meeting.provider && imported.externalId === meeting.externalId,
            ),
        ),
      ],
    }));
    setSelectedMeetingId(importedMeetings[0]?.id ?? selectedMeetingId);
    setCalendarSyncStatus(`Imported ${importedMeetings.length} ${provider} calendar events.`);
  }

  async function startRecording() {
    const meetingContext = selectedMeeting;

    if (!consentConfirmed) return;
    if (!meetingContext) {
      setRecordingError("Add or select a meeting before recording.");
      return;
    }
    if (!meetingContext.jobDescription.trim()) {
      setRecordingError("Add the job description before recording.");
      return;
    }

    if (!("mediaDevices" in navigator) || !("MediaRecorder" in window)) {
      setRecordingError("This browser does not expose MediaRecorder audio recording.");
      return;
    }

    try {
      setRecordingError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      const startedAt = Date.now();
      setRecordingStartedAt(startedAt);
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const sessionId = `session-${Date.now()}`;
        const costs = estimateInterviewCost(durationSeconds);
        const session: InterviewSession = {
          id: sessionId,
          meetingId: meetingContext.id,
          meetingTitle: meetingContext.title,
          candidateName: meetingContext.candidateName,
          jobDescriptionSnapshot: meetingContext.jobDescription,
          cvTextSnapshot: meetingContext.cvText,
          outputLanguage: meetingContext.outputLanguage ?? outputLanguage,
          startedAt: new Date(startedAt).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds,
          transcriptionCostUsd: costs.transcriptionCostUsd,
          aiAnalysisCostUsd: costs.aiAnalysisCostUsd,
          recruiterNotes: [meetingContext?.recruiterNotes, interviewNotes].filter(Boolean).join("\n\n"),
          recordingUrl: URL.createObjectURL(blob),
          recordingMimeType: recorder.mimeType || "audio/webm",
          status: "analyzed",
        };
        let transcript: TranscriptSegment[];
        let output: GeneratedOutput;
        try {
          setTranscriptionStatus("Transcribing interview with Whisper...");
          transcript = await transcribeAudioWithWhisper({ audioBlob: blob, sessionId });
          if (!transcript.length) {
            throw new Error("Whisper returned no transcript segments.");
          } else {
            setTranscriptionStatus("Whisper transcription complete. Generating analysis...");
          }
          output = await analyzeInterviewWithOpenAI({
            session: { ...session, status: "analyzed" },
            transcriptSegments: transcript,
          });
          setTranscriptionStatus("Transcription and analysis complete.");
        } catch (error) {
          setTranscriptionStatus(
            error instanceof Error
              ? error.message
              : "Transcription or analysis failed.",
          );
          updateWorkspaceData((current) => ({
            ...current,
            sessions: [{ ...session, status: "analysis_pending" }, ...current.sessions],
          }));
          setSelectedSessionId(sessionId);
          setActiveScreen("analysis");
          setIsCapturePanelOpen(false);
          setIsPaused(false);
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const note: RecruiterNote = {
          id: `note-${Date.now()}`,
          sessionId,
          text: interviewNotes || "No manual notes captured.",
          createdAt: new Date().toISOString(),
          timestampSeconds: durationSeconds,
        };

        updateWorkspaceData((current) => ({
          ...current,
          sessions: [{ ...session, status: "analyzed" }, ...current.sessions],
          calendarMeetings: current.calendarMeetings.map((meeting) =>
            meeting.id === meetingContext.id ? { ...meeting, status: "completed" } : meeting,
          ),
          transcriptSegments: [...transcript, ...current.transcriptSegments],
          generatedOutputs: [output, ...current.generatedOutputs],
          recruiterNotes: [note, ...current.recruiterNotes],
        }));
        setSelectedSessionId(sessionId);
        setActiveScreen("analysis");
        setIsCapturePanelOpen(false);
        setInterviewNotes("");
        setConsentConfirmed(false);
        setIsPaused(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      intervalRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.round((Date.now() - startedAt) / 1000));
      }, 1000);
    } catch {
      setRecordingError("Recording could not start. Check microphone permission and try again.");
    }
  }

  function stopRecording() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecordingStartedAt(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state !== "recording") return;
    mediaRecorderRef.current.pause();
    setIsPaused(true);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state !== "paused" || !recordingStartedAt) return;
    mediaRecorderRef.current.resume();
    setIsPaused(false);
    intervalRef.current = window.setInterval(() => {
      setRecordingSeconds(Math.round((Date.now() - recordingStartedAt) / 1000));
      }, 1000);
  }

  if (!account) {
    return authScreen === "onboarding" ? (
      <OnboardingPage
        accountForm={accountForm}
        setAccountForm={setAccountForm}
        createAccount={createAccount}
        goBack={() => setAuthScreen("landing")}
      />
    ) : (
      <LandingPage startOnboarding={() => setAuthScreen("onboarding")} />
    );
  }

  return (
    <main className="min-h-screen bg-taploCanvas font-inter">
      {!calendarSetupChoice ? (
        <CalendarSetupGate
          calendarConnections={calendarConnections}
          calendarSetupMessage={calendarSetupMessage}
          connectCalendar={connectCalendar}
        />
      ) : (
      <div className="flex h-screen overflow-hidden bg-taploCanvas">
        <nav className="flex w-64 flex-shrink-0 flex-col border-r border-taploBorder bg-[#F7F4F0]">
          <div className="border-b border-taploBorder px-4 pb-3 pt-5">
            <Image
              alt="Taplo"
              className="mb-4 h-7 w-auto object-contain"
              height={72}
              src="/brand/taplo-logo-full-color.png"
              width={3000}
            />
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-taploCoral px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-taploCoralDark"
              onClick={() => setActiveScreen("meetings")}
              type="button"
            >
              <Mic size={16} aria-hidden="true" />
              New interview
            </button>
          </div>
          <div className="border-b border-taploBorder px-3 py-2">
            <div className="rounded-lg border border-taploBorder bg-white px-3 py-2 text-xs text-[#999]">
              {account.company} workspace
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.id;

            return (
              <button
                key={item.id}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? "bg-white text-[#111] shadow-sm"
                    : "text-[#777] hover:bg-white/70 hover:text-[#333]"
                }`}
                onClick={() => setActiveScreen(item.id)}
                type="button"
              >
                <Icon size={18} aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            );
          })}
          </div>
          <div className="border-t border-taploBorder px-3 py-3">
            <div className="rounded-lg bg-white px-3 py-2">
              <p className="text-xs font-semibold text-[#333]">{account.name}</p>
              <p className="mt-0.5 truncate text-xs text-[#999]">{account.email}</p>
            </div>
            <select
              className="mt-2 w-full rounded-lg border border-taploBorder bg-white px-3 py-2 text-xs text-[#666] outline-none focus:border-taploCoral"
              value={uiLanguage}
              onChange={(event) => setUiLanguage(event.target.value as SupportedLanguage)}
            >
              <option value="en">{t("english")}</option>
              <option value="sv">{t("swedish")}</option>
            </select>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-12 items-center justify-between border-b border-taploBorder bg-white px-6">
            <span className="text-sm text-[#999]">
              Welcome, {account.name || "Recruiter"}
            </span>
            <span className="text-xs font-medium text-[#999]">{t("disclaimer")}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
          {activeScreen === "dashboard" ? (
            <Dashboard
              calendarMeetings={calendarMeetings}
              sessions={sessions}
              onNavigate={setActiveScreen}
            />
          ) : null}
          {activeScreen === "meetings" ? (
            <CalendarWorkspace
              calendarConnections={calendarConnections}
              calendarMeetings={calendarMeetings}
              selectedMeetingId={selectedMeetingId}
              setSelectedMeetingId={setSelectedMeetingId}
              meetingForm={meetingForm}
              setMeetingForm={setMeetingForm}
              addMeeting={addMeeting}
              connectCalendar={connectCalendar}
              disconnectCalendar={disconnectCalendar}
              syncCalendarEvents={syncCalendarEvents}
              calendarSyncStatus={calendarSyncStatus}
              calendarSetupMessage={calendarSetupMessage}
              calendarSetupChoice={calendarSetupChoice}
              calendarSyncMode={calendarSyncMode}
              setCalendarSyncMode={setCalendarSyncMode}
              updateMeeting={updateMeeting}
              joinMeeting={joinMeeting}
              t={t}
            />
          ) : null}
          {activeScreen === "analysis" ? (
            <AnalysisScreen
              sessions={sessions.filter((session) => session.status === "analyzed")}
              selectedSessionId={selectedSession?.id ?? ""}
              setSelectedSessionId={setSelectedSessionId}
              selectedSession={selectedSession}
              output={selectedOutput}
              transcript={selectedTranscript}
              recruiterNotes={recruiterNotes.filter((note) => note.sessionId === selectedSession?.id)}
              t={t}
            />
          ) : null}
          {activeScreen === "usage" ? <UsageScreen sessions={sessions} usage={usage} t={t} /> : null}
          </div>
          {isCapturePanelOpen ? (
            <CapturePanel
              meeting={selectedMeeting}
              consentConfirmed={consentConfirmed}
              setConsentConfirmed={setConsentConfirmed}
              interviewNotes={interviewNotes}
              setInterviewNotes={setInterviewNotes}
              isRecording={isRecording}
              isPaused={isPaused}
              recordingSeconds={recordingSeconds}
              recordingStartedAt={recordingStartedAt}
              recordingError={recordingError}
              transcriptionStatus={transcriptionStatus}
              startRecording={startRecording}
              pauseRecording={pauseRecording}
              resumeRecording={resumeRecording}
              stopRecording={stopRecording}
              closePanel={() => setIsCapturePanelOpen(false)}
              t={t}
            />
          ) : null}
        </div>
      </div>
      )}
    </main>
  );
}

function LandingPage({ startOnboarding }: { startOnboarding: () => void }) {
  const workflow = [
    ["Add the interview", "Connect calendar or paste a meeting link manually. No projects, roles, or candidate records required."],
    ["Attach the job description", "Paste the JD directly onto the meeting so analysis is grounded in the actual role context."],
    ["Record and review", "Join the meeting, confirm recording consent, record from the desktop panel, then review transcript-backed analysis."],
  ];
  const insights = [
    "Job description attached",
    "Consent confirmation required before recording",
    "Whisper transcript and analysis generated after stop",
  ];
  const faqs = [
    ["What does the app actually do?", "Taplo lets recruiters create or sync interview meetings, attach a job description, record with consent, transcribe audio with Whisper, and generate structured interview analysis."],
    ["Do I need to create projects or candidates?", "No. The current workflow is meeting-first. Paste a meeting link, add the JD, join, record, and review analysis."],
    ["Is Taplo a hiring decision engine?", "No. Taplo does not score, rank, recommend, or decide. It produces evidence-based notes and follow-up material."],
    ["Can I use it without calendar OAuth?", "Yes. Manual setup is fully supported. Calendar OAuth is optional for importing upcoming meetings."],
    ["When is the account created?", "After downloading and opening the desktop app. The landing page is for downloading the app, not creating a web account."],
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#151515]">
      <div className="border-b border-black/10 bg-[#f0ebe2] px-5 py-2 text-center text-sm font-medium text-black/70">
        Desktop account setup happens after download. Open Taplo to create your workspace.
      </div>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f7f4ee]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Image
            alt="Taplo"
            className="h-8 w-auto object-contain"
            height={72}
            src="/brand/taplo-logo-full-color.png"
            width={3000}
          />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-black/58 md:flex">
            <a className="transition hover:text-black" href="#product">Product</a>
            <a className="transition hover:text-black" href="#workflow">Workflow</a>
            <a className="transition hover:text-black" href="#privacy">Privacy</a>
            <a className="transition hover:text-black" href="#faq">FAQ</a>
          </nav>
          <button
            className="rounded-full bg-[#151515] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
            onClick={startOnboarding}
            type="button"
          >
            Get the desktop app
          </button>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-106px)] max-w-7xl content-center px-5 py-16 text-center">
        <p className="text-sm font-semibold text-black/58">Desktop interview recorder and analysis workspace for recruiters</p>
        <h1 className="mx-auto mt-5 max-w-5xl text-6xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#111] md:text-8xl">
          Record interviews.
          <span className="block">Generate structured notes.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-3xl text-xl leading-8 text-black/62">
          Paste a meeting link or sync your calendar, attach the job description, record with participant consent, transcribe with Whisper, and review evidence-based recruiter analysis.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#151515] px-6 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-black"
            onClick={startOnboarding}
            type="button"
          >
            Get the desktop app <ArrowRight size={17} />
          </button>
          <p className="text-sm font-medium text-black/48">Create your account inside the desktop app.</p>
        </div>
        <div id="product" className="mx-auto mt-12 grid w-full max-w-6xl gap-4 rounded-[2rem] border border-black/10 bg-white p-4 text-left shadow-lift lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[1.35rem] border border-black/10 bg-[#f9fafb] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-taploBlue">Meeting page</p>
                <h2 className="mt-2 text-xl font-semibold">https://meet.google.com/abc-defg-hij</h2>
              </div>
              <span className="rounded-full bg-taploCoral px-3 py-1 text-xs font-semibold text-white">Ready</span>
            </div>
            <div className="mt-5 rounded-xl border border-black/10 bg-white p-4">
              <p className="text-sm font-semibold text-black">Job description</p>
              <p className="mt-3 text-sm leading-6 text-black/62">
                Senior Cloud Engineer role requiring AWS, migration planning, stakeholder communication, and production ownership.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Meeting link", "JD", "Output language"].map((label) => (
                <div key={label} className="rounded-xl border border-black/10 bg-white px-3 py-3 text-center text-sm font-semibold text-black/68">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-black/10 bg-white p-3 text-sm text-black/50">
              Click Join meeting to open the call and show the recorder panel.
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[1.35rem] border border-black/10 bg-[#f9fafb] p-4">
              <p className="text-sm font-semibold text-black">Interview setup status</p>
              <div className="mt-4 grid gap-3">
                {insights.map((item) => (
                  <p key={item} className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 text-black/62">
                    {item}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-black/10 bg-[#f9fafb] p-4">
              <p className="text-sm font-semibold text-black">Generated analysis preview</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ["Role evidence", "Transcript-backed observations."],
                  ["Missing areas", "Topics not clearly discussed."],
                  ["Follow-ups", "Suggested questions after review."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-black/10 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-taploCoral">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-black/60">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <h2 className="mx-auto max-w-4xl text-center text-5xl font-semibold tracking-[-0.035em] text-[#111] md:text-7xl">
            The workflow your app supports
          </h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {workflow.map(([title, body]) => (
              <article key={title} className="rounded-[1.5rem] border border-black/10 bg-[#f7f4ee] p-5">
                <div className="mb-6 rounded-[1.15rem] border border-black/10 bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-black">00:00</span>
                    <span className="rounded-full bg-taploBlue px-3 py-1 text-xs font-semibold text-white">MVP</span>
                  </div>
                  <div className="mt-4 h-24 rounded-xl bg-[#f1f5f9] p-3 text-sm leading-6 text-black/56">
                    {body}
                  </div>
                </div>
                <h3 className="text-2xl font-semibold tracking-[-0.02em] text-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/58">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <h2 className="mx-auto max-w-4xl text-center text-5xl font-semibold tracking-[-0.035em] md:text-7xl">
          Analysis outputs after recording
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-7 text-black/58">
          Once recording stops, the app sends audio for Whisper transcription and then generates structured recruiter analysis from transcript evidence.
        </p>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {["Transcript", "Structured insights", "Recruiter outputs"].map((title, index) => (
            <article key={title} className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-soft">
              <p className="text-sm font-semibold text-black">{title}</p>
              <div className="mt-5 grid gap-3">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className={`h-3 rounded-full ${index === 0 ? "bg-black/10" : "bg-black/15"}`} />
                ))}
                <p className="rounded-xl bg-[#f7f4ee] p-4 text-sm leading-6 text-black/58">
                  {index === 0
                    ? "00:12 Candidate described leading migration planning."
                    : index === 1
                    ? "Technical signals, role evidence, unclear areas, missing information, and follow-ups."
                    : "Candidate summary, client submission draft, follow-up email draft, and internal notes."}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="privacy" className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <h2 className="mx-auto max-w-4xl text-center text-5xl font-semibold tracking-[-0.035em] md:text-7xl">
            Consent-first desktop recording
          </h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              ["Consent gate", "The recorder requires confirmation that all participants have agreed to be recorded."],
              ["Desktop control panel", "The app opens the meeting link externally and keeps record, pause, stop, notes, and status in a small panel."],
              ["No hiring decisions", "Taplo never ranks candidates, assigns scores, or recommends hire/reject decisions."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-[1.5rem] border border-black/10 bg-[#f7f4ee] p-6">
                <ShieldCheck className="text-taploBlue" size={24} />
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-black/58">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-5xl font-semibold tracking-[-0.035em] md:text-7xl">
              Calendar-first or manual
            </h2>
            <p className="mt-5 text-lg leading-7 text-black/58">
              Start with the setup path that fits your workflow. Use manual meeting links immediately, or connect calendar OAuth when configured.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Manual meeting link", "Google Calendar", "Outlook Calendar", "Teams calendar", "Google Meet link", "Microsoft Teams link"].map((tool) => (
              <div key={tool} className="rounded-2xl border border-black/10 bg-white p-5 text-lg font-semibold shadow-soft">
                {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-20 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div className="rounded-[1.5rem] border border-black/10 bg-[#f7f4ee] p-5">
            <div className="rounded-[1.15rem] bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold">Transcript review</p>
              <div className="mt-4 grid gap-3">
                {["Recruiter", "Candidate", "Recruiter"].map((speaker, index) => (
                  <div key={`${speaker}-${index}`} className="rounded-xl bg-[#f1f5f9] p-3 text-sm leading-6 text-black/58">
                    <span className="font-semibold text-black">{speaker}</span> · {index === 1 ? "I led a migration across four services." : "Can you share the scope of that project?"}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-5xl font-semibold tracking-[-0.035em] md:text-7xl">Real transcription, real usage tracking</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["2", "Output languages", "English and Swedish analysis output support."],
                ["$0.006", "Per minute", "Estimated transcription cost."],
                ["$0.03", "Per interview", "Estimated AI analysis cost."],
              ].map(([value, label, body]) => (
                <div key={label}>
                  <p className="text-4xl font-semibold tracking-[-0.03em]">{value}</p>
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-black/55">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl px-5 py-20">
        <h2 className="text-center text-5xl font-semibold tracking-[-0.035em] md:text-7xl">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-black/10 rounded-[1.5rem] border border-black/10 bg-white">
          {faqs.map(([question, answer]) => (
            <article key={question} className="p-6">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">{question}</h3>
              <p className="mt-3 text-sm leading-6 text-black/58">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 text-center">
        <h2 className="mx-auto max-w-4xl text-5xl font-semibold leading-none tracking-[-0.04em] md:text-8xl">
          Download the desktop app and run your first interview.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-7 text-black/58">
          Create your desktop account, choose calendar or manual setup, paste a meeting link, add the JD, record with consent, and review structured analysis.
        </p>
        <button
          className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-[#151515] px-6 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-black"
          onClick={startOnboarding}
          type="button"
        >
          Get the desktop app <ArrowRight size={17} />
        </button>
      </section>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[1fr_2fr]">
          <div>
            <Image
              alt="Taplo"
              className="h-8 w-auto object-contain"
              height={72}
              src="/brand/taplo-logo-full-color.png"
              width={3000}
            />
            <p className="mt-4 max-w-sm text-sm leading-6 text-black/52">
              Recruiter interview intelligence. Understanding only, never hiring decisions.
            </p>
          </div>
          <div className="grid gap-6 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold">Product</p>
              <div className="mt-3 grid gap-2 text-black/52">
                <a href="#workflow">Workflow</a>
                <a href="#privacy">Consent</a>
                <a href="#faq">FAQ</a>
              </div>
            </div>
            <div>
              <p className="font-semibold">Support</p>
              <div className="mt-3 grid gap-2 text-black/52">
                <span>Help center</span>
                <span>Contact</span>
                <span>Status</span>
              </div>
            </div>
            <div>
              <p className="font-semibold">Legal</p>
              <div className="mt-3 grid gap-2 text-black/52">
                <span>Privacy</span>
                <span>Terms</span>
                <span>Subprocessors</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function OnboardingPage({
  accountForm,
  setAccountForm,
  createAccount,
  goBack,
}: {
  accountForm: { name: string; email: string; company: string };
  setAccountForm: (value: { name: string; email: string; company: string }) => void;
  createAccount: () => void;
  goBack: () => void;
}) {
  return (
    <main className="grid min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#151515] lg:grid-cols-[0.9fr_1.1fr]">
      <section className="mx-auto flex w-full max-w-lg flex-col justify-between">
        <button className="w-fit text-sm font-semibold text-black/55 hover:text-black" onClick={goBack} type="button">
          Back
        </button>
        <div className="py-12">
          <Image
            alt="Taplo"
            className="h-9 w-auto object-contain"
            height={72}
            src="/brand/taplo-logo-full-color.png"
            width={3000}
          />
          <h1 className="mt-8 text-5xl font-semibold leading-none tracking-[-0.035em]">Set up your desktop workspace.</h1>
          <p className="mt-5 text-base leading-7 text-black/58">
            This step happens after opening the desktop app. The MVP creates a local account on this machine; cloud authentication can be added when the backend is deployed.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-xl content-center">
        <div className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-lift md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taploCoral">Onboarding</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">Create local account</h2>
          </div>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-black/72">
              Full name
              <input
                className="rounded-md border border-black/10 bg-[#f9fafb] px-3 py-3 text-black outline-none placeholder:text-black/35 focus:border-taploBlue"
                value={accountForm.name}
                onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
                placeholder="Gerald Boakye"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-black/72">
              Work email
              <input
                className="rounded-md border border-black/10 bg-[#f9fafb] px-3 py-3 text-black outline-none placeholder:text-black/35 focus:border-taploBlue"
                value={accountForm.email}
                onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                placeholder="gerald@company.com"
                type="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-black/72">
              Company
              <input
                className="rounded-md border border-black/10 bg-[#f9fafb] px-3 py-3 text-black outline-none placeholder:text-black/35 focus:border-taploBlue"
                value={accountForm.company}
                onChange={(event) => setAccountForm({ ...accountForm, company: event.target.value })}
                placeholder="Taplo"
              />
            </label>
            <button
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#151515] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:bg-black/10 disabled:text-black/35"
              disabled={!accountForm.name || !accountForm.email || !accountForm.company}
              onClick={createAccount}
              type="button"
            >
              Create desktop account <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  calendarMeetings,
  sessions,
  onNavigate,
}: {
  calendarMeetings: CalendarMeeting[];
  sessions: InterviewSession[];
  onNavigate: (screen: Screen) => void;
}) {
  const stats = [
    { label: "Upcoming", value: calendarMeetings.filter((meeting) => meeting.status !== "completed").length },
    { label: "Ready", value: calendarMeetings.filter((meeting) => meeting.jobDescription && meeting.status !== "completed").length },
    { label: "Interviews", value: sessions.length },
    { label: "Analyses", value: sessions.filter((session) => session.status === "analyzed").length },
  ];

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-2xl border border-taploBorder bg-white shadow-soft">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div>
            <div className="inline-flex rounded-full bg-taploCoralSoft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-taploCoral">
              Evidence-first hiring conversations
            </div>
            <h2 className="mt-4 max-w-2xl font-fraunces text-4xl font-normal leading-tight text-[#111]">
              Capture interviews from a meeting link to transcript-backed analysis.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#666]">
              Paste a meeting link, add the job description, join the call, and record from a small recruiter control panel.
            </p>
          </div>
          <div className="grid content-end gap-3">
            <button
              className="rounded-xl bg-taploCoral px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-taploCoralDark"
              onClick={() => onNavigate("meetings")}
              type="button"
            >
              Add meeting link
            </button>
            <button
              className="rounded-xl border border-taploBorder bg-taploWarm px-4 py-3 text-left text-sm font-semibold text-[#555] transition hover:bg-white"
              onClick={() => onNavigate("analysis")}
              type="button"
            >
              Review analysis
            </button>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-taploBorder bg-white p-5 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#999]">{stat.label}</p>
            <p className="mt-3 font-fraunces text-3xl font-light text-ink">{stat.value}</p>
          </div>
        ))}
      </div>
      <Section title="Today and upcoming">
        <div className="grid gap-3">
          {calendarMeetings.slice(0, 4).map((meeting) => (
            <article key={meeting.id} className="rounded-xl border border-taploBorder bg-taploWarm/70 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{meeting.title}</h3>
                  <p className="mt-1 text-sm text-[#666]">
                    {meeting.jobDescription ? "Job description attached" : "Job description missing"} · {new Date(meeting.startsAt).toLocaleString()}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-taploCoralSoft px-2 py-1 text-xs font-semibold text-taploCoral">
                  {meeting.status}
                </span>
              </div>
            </article>
          ))}
          {!calendarMeetings.length ? (
            <EmptyState>Add your first calendar interview to prepare context and start recording.</EmptyState>
          ) : null}
        </div>
      </Section>
      <Section title="Workflow">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Paste link", "Add the meeting URL manually or sync a calendar event.", "meetings"],
            ["2", "Add JD", "Attach the job description directly to the meeting.", "meetings"],
            ["3", "Join and record", "Open the meeting and use the compact recorder panel.", "meetings"],
          ].map(([step, title, body, target]) => (
            <button
              key={step}
              className="rounded-xl border border-taploBorder bg-taploWarm/70 p-4 text-left transition hover:border-taploCoral/40 hover:bg-white hover:shadow-soft"
              onClick={() => onNavigate(target as Screen)}
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-taploCoral text-sm font-semibold text-white">
                {step}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#666]">{body}</p>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function CalendarSetupGate({
  calendarConnections,
  calendarSetupMessage,
  connectCalendar,
}: {
  calendarConnections: WorkspaceData["calendarConnections"];
  calendarSetupMessage: string;
  connectCalendar: (provider: CalendarProvider) => void;
}) {
  const configuredProvider = calendarConnections.find(
    (connection) => connection.provider !== "manual" && connection.configured === true,
  );

  return (
    <section className="grid min-h-screen place-items-center bg-taploCanvas px-5 py-8">
      <div className="w-full max-w-4xl rounded-3xl border border-taploBorder bg-white p-5 shadow-lift md:p-8">
        <Image
          alt="Taplo"
          className="mb-10 h-9 w-auto object-contain"
          height={72}
          src="/brand/taplo-logo-full-color.png"
          width={3000}
        />
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-taploCoral">
            Workspace setup
          </p>
          <h2 className="mt-3 font-fraunces text-4xl font-normal text-ink md:text-5xl">
            Start with your calendar, or add interviews manually.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#666]">
            Choose how this workspace should capture interviews. The rest of the app opens after this step.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            className="rounded-2xl border border-taploBorder bg-taploWarm p-5 text-left transition hover:border-taploCoral/40 hover:bg-white hover:shadow-soft"
            onClick={() => connectCalendar(configuredProvider?.provider ?? "google")}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-taploCoral shadow-sm">
              <CalendarDays size={20} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-ink">Connect calendar</h3>
            <p className="mt-2 text-sm leading-6 text-[#666]">
              Use Google, Outlook, or Teams events as the source for upcoming interviews.
            </p>
          </button>

          <button
            className="rounded-2xl border border-taploCoral bg-taploCoral p-5 text-left text-white shadow-soft transition hover:bg-taploCoralDark"
            onClick={() => connectCalendar("manual")}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 text-white">
              <ClipboardList size={20} aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold">Add manually</h3>
            <p className="mt-2 text-sm leading-6 text-white/80">
              Create interview sessions yourself by adding the meeting, job description, CV, and notes.
            </p>
          </button>
        </div>

        {calendarSetupMessage ? (
          <p className="mt-5 rounded-md border border-taploCoral/30 bg-taploCoral/10 px-4 py-3 text-sm leading-6 text-slate-800">
            {calendarSetupMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CalendarWorkspace({
  calendarConnections,
  calendarMeetings,
  selectedMeetingId,
  setSelectedMeetingId,
  meetingForm,
  setMeetingForm,
  addMeeting,
  connectCalendar,
  disconnectCalendar,
  syncCalendarEvents,
  calendarSyncStatus,
  calendarSetupMessage,
  calendarSetupChoice,
  calendarSyncMode,
  setCalendarSyncMode,
  updateMeeting,
  joinMeeting,
  t,
}: {
  calendarConnections: WorkspaceData["calendarConnections"];
  calendarMeetings: CalendarMeeting[];
  selectedMeetingId: string;
  setSelectedMeetingId: (id: string) => void;
  meetingForm: { provider: CalendarProvider; title: string; candidateName: string; startsAt: string; endsAt: string; meetingUrl: string };
  setMeetingForm: (value: { provider: CalendarProvider; title: string; candidateName: string; startsAt: string; endsAt: string; meetingUrl: string }) => void;
  addMeeting: () => void;
  connectCalendar: (provider: CalendarProvider) => void;
  disconnectCalendar: (provider: CalendarProvider) => void | Promise<void>;
  syncCalendarEvents: (provider: CalendarProvider) => void | Promise<void>;
  calendarSyncStatus: string;
  calendarSetupMessage: string;
  calendarSetupChoice: CalendarProvider | null;
  calendarSyncMode: "interviews" | "all";
  setCalendarSyncMode: (mode: "interviews" | "all") => void;
  updateMeeting: (meetingId: string, updates: Partial<CalendarMeeting>) => void;
  joinMeeting: (meeting: CalendarMeeting) => void;
  t: (key: TranslationKey) => string;
}) {
  const selected = calendarMeetings.find((meeting) => meeting.id === selectedMeetingId) ?? calendarMeetings[0];
  const reminders = selected ? contextualReminders(selected) : [];

  return (
    <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
      <div className="grid gap-5">
        {calendarSetupChoice !== "manual" ? (
        <Section title="Calendar sources" description="Connect a source for this workspace. Calendar sync uses real OAuth credentials when configured.">
          <div className="grid gap-3">
            <div className="flex rounded-xl border border-taploBorder bg-white p-1">
              {(["interviews", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`flex-1 rounded px-3 py-2 text-xs font-semibold capitalize transition ${
                    calendarSyncMode === mode
                      ? "bg-taploCoral text-white"
                      : "text-[#666] hover:bg-taploWarm"
                  }`}
                  onClick={() => setCalendarSyncMode(mode)}
                  type="button"
                >
                  {mode === "interviews" ? "Interview-like only" : "All events"}
                </button>
              ))}
            </div>
            {calendarConnections.map((connection) => (
              <div key={connection.id} className="rounded-xl border border-taploBorder bg-taploWarm/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-ink">{connection.provider}</p>
                    <p className="mt-1 text-xs text-[#666]">
                      {connection.provider !== "manual" && connection.configured === false
                        ? "OAuth setup required"
                        : connection.status === "connected"
                        ? connection.connectedAt
                          ? `Connected ${new Date(connection.connectedAt).toLocaleDateString()}`
                          : "Connected"
                        : "Not connected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#666]">
                      {connection.status}
                    </span>
                    {connection.status === "connected" ? (
                      <>
                        {connection.provider !== "manual" ? (
                          <button
                            className="rounded-lg bg-taploCoral px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-taploCoralDark"
                            onClick={() => syncCalendarEvents(connection.provider)}
                            type="button"
                          >
                            Sync
                          </button>
                        ) : null}
                        <button
                          className="rounded-lg border border-taploBorder bg-white px-3 py-1.5 text-xs font-semibold text-[#666] disabled:cursor-not-allowed disabled:text-[#CCC]"
                          disabled={connection.provider === "manual"}
                          onClick={() => disconnectCalendar(connection.provider)}
                          type="button"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        className="rounded-lg bg-taploCoral px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-taploCoralDark"
                        onClick={() => connectCalendar(connection.provider)}
                        type="button"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {calendarSetupMessage ? (
              <p className="rounded-xl border border-taploCoral/30 bg-taploCoralSoft px-3 py-2 text-sm leading-6 text-[#333]">
                {calendarSetupMessage}
              </p>
            ) : null}
            {calendarSyncStatus ? (
              <p className="rounded-xl border border-taploBorder bg-white px-3 py-2 text-sm text-[#666]">
                {calendarSyncStatus}
              </p>
            ) : null}
          </div>
        </Section>
        ) : null}
        <Section title="Add interview meeting" description="Create a meeting from your calendar or add it manually.">
          <div className="grid gap-4">
            <Field label="Meeting link">
              <input className={inputClass} value={meetingForm.meetingUrl} onChange={(event) => setMeetingForm({ ...meetingForm, meetingUrl: event.target.value })} placeholder="Teams, Meet, Zoom, or phone link" />
            </Field>
            <button className="rounded-xl bg-taploCoral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-taploCoralDark disabled:bg-[#CCC]" disabled={!meetingForm.meetingUrl} onClick={addMeeting} type="button">
              Add meeting
            </button>
          </div>
        </Section>
      </div>
      <div className="grid gap-5">
        <Section title="Upcoming interviews">
          <div className="grid gap-3">
            {calendarMeetings.map((meeting) => (
              <button key={meeting.id} className={`rounded-xl border p-4 text-left transition ${selectedMeetingId === meeting.id ? "border-taploCoral bg-white shadow-soft" : "border-taploBorder bg-taploWarm/70 hover:border-taploCoral/50 hover:bg-white"}`} onClick={() => setSelectedMeetingId(meeting.id)} type="button">
                <h3 className="text-base font-semibold text-ink">{meeting.title}</h3>
                <p className="mt-1 text-sm text-[#666]">{meeting.jobDescription ? "Job description attached" : "Job description missing"} · {new Date(meeting.startsAt).toLocaleString()}</p>
                {meeting.attendeeEmails.length ? (
                  <p className="mt-2 text-xs text-[#999]">{meeting.attendeeEmails.slice(0, 3).join(", ")}</p>
                ) : null}
              </button>
            ))}
            {!calendarMeetings.length ? <EmptyState>No calendar meetings yet.</EmptyState> : null}
          </div>
        </Section>
        <Section title="Meeting prep" description="Attach context once, then start the interview session directly.">
          {selected ? (
            <div className="grid gap-4">
              <Field label="Job description">
                <textarea className={`${textAreaClass} min-h-36`} value={selected.jobDescription} onChange={(event) => updateMeeting(selected.id, { jobDescription: event.target.value })} />
              </Field>
              <Field label="Optional CV / resume context">
                <textarea className={`${textAreaClass} min-h-36`} value={selected.cvText} onChange={(event) => updateMeeting(selected.id, { cvText: event.target.value })} />
              </Field>
              <Field label={t("outputLanguage")}>
                <select className={inputClass} value={selected.outputLanguage} onChange={(event) => updateMeeting(selected.id, { outputLanguage: event.target.value as SupportedLanguage })}>
                  <option value="en">{t("english")}</option>
                  <option value="sv">{t("swedish")}</option>
                </select>
              </Field>
              <Field label="Recruiter notes">
                <textarea className={textAreaClass} value={selected.recruiterNotes} onChange={(event) => updateMeeting(selected.id, { recruiterNotes: event.target.value })} />
              </Field>
              <div className="rounded-xl border border-taploCoral/20 bg-taploCoralSoft p-4">
                <h3 className="text-sm font-semibold text-ink">Contextual reminders</h3>
                <div className="mt-3 grid gap-2">
                  {reminders.map((reminder) => (
                    <p key={reminder} className="rounded-xl bg-white px-3 py-2 text-sm text-[#666]">{reminder}</p>
                  ))}
                </div>
              </div>
              <button className="rounded-xl bg-taploCoral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-taploCoralDark disabled:bg-[#CCC]" disabled={!selected.meetingUrl || !selected.jobDescription} onClick={() => joinMeeting(selected)} type="button">
                Join meeting
              </button>
            </div>
          ) : (
            <EmptyState>Select or add a meeting to prepare interview context.</EmptyState>
          )}
        </Section>
      </div>
    </div>
  );
}

function CapturePanel({
  meeting,
  consentConfirmed,
  setConsentConfirmed,
  interviewNotes,
  setInterviewNotes,
  isRecording,
  isPaused,
  recordingSeconds,
  recordingStartedAt,
  recordingError,
  transcriptionStatus,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  closePanel,
  t,
}: {
  meeting?: CalendarMeeting;
  consentConfirmed: boolean;
  setConsentConfirmed: (value: boolean) => void;
  interviewNotes: string;
  setInterviewNotes: (value: string) => void;
  isRecording: boolean;
  isPaused: boolean;
  recordingSeconds: number;
  recordingStartedAt: number | null;
  recordingError: string;
  transcriptionStatus: string;
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  closePanel: () => void;
  t: (key: TranslationKey) => string;
}) {
  const reminders = meeting ? contextualReminders(meeting) : [];

  return (
    <aside className="fixed bottom-5 right-5 z-30 w-[min(420px,calc(100vw-40px))] rounded-2xl border border-taploBorder bg-white p-4 text-[#111] shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-taploCoral">
            Live capture
          </p>
          <h3 className="mt-1 text-base font-semibold">{meeting?.title ?? "Meeting capture"}</h3>
          <p className="mt-1 text-sm text-[#999]">
            {recordingStartedAt ? `Started ${new Date(recordingStartedAt).toLocaleTimeString()}` : "Ready when the interview begins"}
          </p>
        </div>
        <button
          className="rounded-lg border border-taploBorder bg-taploWarm px-2 py-1 text-xs font-semibold text-[#666] transition hover:bg-white"
          onClick={closePanel}
          type="button"
        >
          Close
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-taploWarm px-3 py-2 text-sm font-semibold">
        {isRecording ? (isPaused ? "Recording paused" : "Recording") : "Not recording"} · {formatTimestamp(recordingSeconds)}
      </div>

      <label className="mt-3 flex items-start gap-3 rounded-xl border border-taploBorder bg-taploWarm/70 p-3 text-sm leading-6 text-[#666]">
        <input className="mt-1 h-4 w-4 accent-taploCoral" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} type="checkbox" />
        <span>{t("consent")}</span>
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg bg-taploCoral px-3 py-2 text-sm font-semibold text-white transition hover:bg-taploCoralDark disabled:bg-[#EEEAE3] disabled:text-[#999]" disabled={!consentConfirmed || isRecording || !meeting?.jobDescription} onClick={startRecording} type="button"><Mic size={16} />{t("start")}</button>
        <button className="inline-flex items-center gap-2 rounded-lg border border-taploBorder bg-white px-3 py-2 text-sm font-semibold text-[#555] transition hover:bg-taploWarm disabled:text-[#BBB]" disabled={!isRecording} onClick={isPaused ? resumeRecording : pauseRecording} type="button">{isPaused ? <Play size={16} /> : <Pause size={16} />}{isPaused ? t("resume") : t("pause")}</button>
        <button className="inline-flex items-center gap-2 rounded-lg border border-taploBorder bg-white px-3 py-2 text-sm font-semibold text-[#555] transition hover:bg-taploWarm disabled:text-[#BBB]" disabled={!isRecording} onClick={stopRecording} type="button"><Square size={16} />{t("stop")}</button>
      </div>

      <textarea
        className="mt-3 min-h-28 w-full rounded-xl border border-taploBorder bg-taploWarm/40 px-3 py-2 text-sm leading-6 text-[#111] outline-none placeholder:text-[#BBB] focus:border-taploCoral"
        value={interviewNotes}
        onChange={(event) => setInterviewNotes(event.target.value)}
        placeholder="Live notes, quotes, gaps, and follow-ups..."
      />

      {reminders.length ? (
        <div className="mt-3 grid gap-2">
          {reminders.slice(0, 3).map((reminder) => (
            <p key={reminder} className="rounded-xl bg-taploWarm px-3 py-2 text-xs leading-5 text-[#666]">
              {reminder}
            </p>
          ))}
        </div>
      ) : null}
      {recordingError ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{recordingError}</p> : null}
      {transcriptionStatus ? <p className="mt-3 text-sm leading-6 text-[#666]">{transcriptionStatus}</p> : null}
    </aside>
  );
}

function AnalysisScreen({
  sessions,
  selectedSessionId,
  setSelectedSessionId,
  selectedSession,
  output,
  transcript,
  recruiterNotes,
  t,
}: {
  sessions: InterviewSession[];
  selectedSessionId: string;
  setSelectedSessionId: (id: string) => void;
  selectedSession?: InterviewSession;
  output?: GeneratedOutput;
  transcript: TranscriptSegment[];
  recruiterNotes: RecruiterNote[];
  t: (key: TranslationKey) => string;
}) {
  if (!selectedSession || !output) {
    return <Section title={t("analysis")}><EmptyState>Complete an interview recording to generate analysis.</EmptyState></Section>;
  }

  return (
    <div className="grid gap-5">
      <Section title="Review context">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
          <select className={inputClass} value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
            {sessions.map((session) => {
              return <option key={session.id} value={session.id}>{session.meetingTitle ?? "Meeting capture"}</option>;
            })}
          </select>
          <div className="rounded-xl bg-taploWarm px-3 py-2 text-sm text-[#666]">{t("duration")}: {formatDuration(selectedSession.durationSeconds)}</div>
          {selectedSession.recordingUrl ? <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-taploBorder bg-white px-3 py-2 text-sm font-semibold text-ink" href={selectedSession.recordingUrl} target="_blank"><FileAudio size={17} />Audio</a> : <div className="rounded-xl bg-taploWarm px-3 py-2 text-sm text-[#666]">Audio unavailable</div>}
        </div>
        <p className="mt-3 text-sm leading-6 text-[#666]">
          {selectedSession.meetingTitle ?? "Meeting capture"}. {output.disclaimer}
        </p>
      </Section>
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.15fr_0.9fr]">
        <Section title="Transcript">
          {transcript.length ? (
            <TranscriptPanel segments={transcript} />
          ) : (
            <EmptyState>No transcript is available yet. Check the recorder status for transcription errors.</EmptyState>
          )}
        </Section>
        <Section title="Structured insights">
          <div className="grid gap-4">
            <InsightGroup title="Role-relevant evidence" insights={output.projectRelevantExperienceSignals} />
            <InsightGroup title="Technical signals" insights={output.technicalDomainSignals} />
            <InsightGroup title="Communication observations" insights={output.communicationObservations} />
            <InsightGroup title="Unclear areas" insights={output.concernsOrUnclearAreas} />
            <InsightGroup title="Missing information" insights={output.missingInformation} />
            <InsightGroup title="Follow-up questions" insights={output.suggestedFollowUpQuestions} />
          </div>
        </Section>
        <Section title="Recruiter outputs">
          <div className="grid gap-4">
            <OutputBlock title="Interview summary" text={output.candidateSummary} />
            <OutputBlock title="Client submission draft" text={output.clientSubmissionDraft} />
            <OutputBlock title="Follow-up email draft" text={output.candidateFollowUpEmailDraft} />
            <OutputBlock title="Internal recruiter notes" text={output.internalRecruiterNotes} />
            <OutputBlock title="Manual notes captured" text={recruiterNotes.map((note) => note.text).join("\n\n") || "No manual notes captured."} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function UsageScreen({
  sessions,
  usage,
  t,
}: {
  sessions: InterviewSession[];
  usage: { durationSeconds: number; transcription: number; ai: number; total: number };
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label={t("duration")} value={formatDuration(usage.durationSeconds)} />
        <Metric label={t("transcriptionCost")} value={formatUsd(usage.transcription)} />
        <Metric label={t("aiCost")} value={formatUsd(usage.ai)} />
        <Metric label={t("totalCost")} value={formatUsd(usage.total)} />
      </div>
      <Section title="Interview usage detail">
        <div className="grid gap-3">
          {sessions.map((session) => (
            <div key={session.id} className="grid gap-3 rounded-xl border border-taploBorder bg-taploWarm p-4 md:grid-cols-4">
              <p className="text-sm text-[#666]">{new Date(session.startedAt).toLocaleString()}</p>
              <p className="text-sm font-semibold text-ink">{formatDuration(session.durationSeconds)}</p>
              <p className="text-sm text-[#666]">{formatUsd(session.transcriptionCostUsd)}</p>
              <p className="text-sm text-[#666]">{formatUsd(session.aiAnalysisCostUsd)}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-taploBorder bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#999]">{label}</p>
      <p className="mt-2 font-fraunces text-2xl font-light text-ink">{value}</p>
    </div>
  );
}

function contextualReminders(meeting: CalendarMeeting) {
  const reminders: string[] = [];
  const roleText = meeting.jobDescription.toLowerCase();
  const noteText = meeting.recruiterNotes.toLowerCase();

  if (!meeting.jobDescription) reminders.push("Attach the job description before recording.");
  if (!meeting.cvText) reminders.push("Upload or paste optional CV/context before the interview.");
  if (!noteText.includes("salary")) reminders.push("Salary expectations have not yet been clarified.");
  if (/cloud|infrastructure|aws|azure|gcp/.test(roleText) && !noteText.includes("cloud")) {
    reminders.push("Cloud infrastructure depth has not been discussed yet.");
  }
  if (/lead|leadership|manager|management/.test(roleText) && !noteText.includes("lead")) {
    reminders.push("Leadership experience is a core requirement for this conversation.");
  }

  return reminders.length ? reminders : ["Context looks ready. Keep notes evidence-based during the interview."];
}

function inferCandidateName(title: string, attendeeEmails: string[]) {
  const normalized = title.replace(/interview|screen|call|with/gi, " ").replace(/\s+/g, " ").trim();
  if (normalized) return normalized;
  const firstExternalEmail = attendeeEmails[0];
  if (!firstExternalEmail) return "";
  return firstExternalEmail
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isInterviewLikeEvent(title: string, description: string) {
  return /interview|screen|candidate|recruit|hiring|talent|cv|resume/i.test(
    `${title} ${description}`,
  );
}

function isCalendarProvider(value: string | null): value is CalendarProvider {
  return value === "manual" || value === "google" || value === "outlook" || value === "teams";
}

function InsightGroup({
  title,
  insights,
}: {
  title: string;
  insights: InterviewInsight[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid gap-2">
        {insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
      </div>
    </div>
  );
}

function OutputBlock({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-xl border border-taploBorder bg-taploWarm/70 p-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#666]">{text}</p>
    </article>
  );
}
