"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  FileAudio,
  LayoutDashboard,
  Mic,
  Pause,
  Play,
  Settings,
  Square,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { LandingPage } from "@/components/LandingPage";
import { estimateInterviewCost, formatUsd } from "@/lib/costs";
import { getTranslator, type TranslationKey } from "@/lib/i18n";
import { initialWorkspaceData } from "@/lib/initialData";
import { analyzeInterviewWithOpenAI } from "@/lib/openaiAnalysis";
import { transcribeAudioWithWhisper } from "@/lib/transcription";
import { loadWorkspaceDataFromStorage, saveWorkspaceDataToStorage } from "@/lib/storage";
import { formatDuration, formatTimestamp } from "@/lib/time";
import type {
  CalendarMeeting,
  CalendarProvider,
  GeneratedOutput,
  InterviewSession,
  RecruiterNote,
  SupportedLanguage,
  TranscriptSegment,
  WorkspaceData,
} from "@/types/interview";

type Screen = "dashboard" | "meetings" | "analysis" | "usage";

type LiveInsights = {
  covered: string[];
  gaps: string[];
  followUps: string[];
};

type WorkspaceAccount = {
  name: string;
  email: string;
  company: string;
  createdAt: string;
};

const accountStorageKey = "interview-intelligence-account";
const calendarSetupStorageKey = "interview-intelligence-calendar-setup";
const landingStorageKey = "interview-intelligence-landing-seen";
const openaiKeyStorageKey = "interview-intelligence-openai-key";

const navigation: { id: Screen; labelKey: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "meetings", labelKey: "meetings", icon: CalendarDays },
  { id: "analysis", labelKey: "analysis", icon: ClipboardList },
  { id: "usage", labelKey: "usage", icon: BarChart3 },
];

export default function Home() {
  const [hasSeenLanding, setHasSeenLanding] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [account, setAccount] = useState<WorkspaceAccount | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");
  const [uiLanguage] = useState<SupportedLanguage>("en");
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
  const [meetingAlert, setMeetingAlert] = useState<CalendarMeeting | null>(null);
  const [liveInsights, setLiveInsights] = useState<LiveInsights | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const desktopStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const liveInsightsTimerRef = useRef<number | null>(null);
  const liveTranscriptAccRef = useRef("");
  const dismissedAlertIds = useRef(new Set<string>());
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
      void loadWorkspaceDataFromStorage().then((data) => {
        setWorkspaceData(data);
        setSelectedSessionId(data.sessions[0]?.id ?? "");
        setSelectedMeetingId(data.calendarMeetings[0]?.id ?? "");
        setOutputLanguage(data.calendarMeetings[0]?.outputLanguage ?? "en");
        setHasLoadedStorage(true);
      });
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
      setHasSeenLanding(!!window.taplo || !!window.localStorage.getItem(landingStorageKey));
      setOpenaiApiKey(window.localStorage.getItem(openaiKeyStorageKey) ?? "");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (hasLoadedStorage) void saveWorkspaceDataToStorage(workspaceData);
  }, [hasLoadedStorage, workspaceData]);

  useEffect(() => {
    function checkUpcoming() {
      const now = Date.now();
      const alert = calendarMeetings.find((m) => {
        const diff = new Date(m.startsAt).getTime() - now;
        return diff >= -5 * 60 * 1000 && diff <= 10 * 60 * 1000 && !dismissedAlertIds.current.has(m.id);
      });
      setMeetingAlert(alert ?? null);
    }
    checkUpcoming();
    const id = window.setInterval(checkUpcoming, 30000);
    return () => window.clearInterval(id);
  }, [calendarMeetings]);

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
    if (openaiApiKey.trim()) {
      window.localStorage.setItem(openaiKeyStorageKey, openaiApiKey.trim());
    }
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
      title: meetingForm.title || meetingForm.candidateName || "Manual interview",
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

  function handleGetStarted() {
    setHasSeenLanding(true);
    window.localStorage.setItem(landingStorageKey, "1");
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
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recordStream: MediaStream = micStream;
      let desktopStream: MediaStream | null = null;
      let audioCtx: AudioContext | null = null;

      try {
        if (window.taplo?.getDesktopSources) {
          const sources = await window.taplo.getDesktopSources();
          const screenSource = sources[0];
          if (screenSource) {
            desktopStream = await navigator.mediaDevices.getUserMedia({
              audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: screenSource.id } } as MediaTrackConstraints,
              video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: screenSource.id } } as MediaTrackConstraints,
            });
            desktopStream.getVideoTracks().forEach((t) => t.stop());
            audioCtx = new AudioContext();
            const dest = audioCtx.createMediaStreamDestination();
            audioCtx.createMediaStreamSource(micStream).connect(dest);
            audioCtx.createMediaStreamSource(desktopStream).connect(dest);
            recordStream = dest.stream;
          }
        }
      } catch {
        // System audio unavailable — mic only
      }

      const recorder = new MediaRecorder(recordStream);
      chunksRef.current = [];
      streamRef.current = micStream;
      desktopStreamRef.current = desktopStream;
      audioContextRef.current = audioCtx;
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
          transcript = await transcribeAudioWithWhisper({ audioBlob: blob, sessionId, apiKey: openaiApiKey || undefined });
          if (!transcript.length) {
            throw new Error("Whisper returned no transcript segments.");
          } else {
            setTranscriptionStatus("Whisper transcription complete. Generating analysis...");
          }
          output = await analyzeInterviewWithOpenAI({
            session: { ...session, status: "analyzed" },
            transcriptSegments: transcript,
            apiKey: openaiApiKey || undefined,
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
          micStream.getTracks().forEach((track) => track.stop());
          desktopStream?.getTracks().forEach((t) => t.stop());
          audioCtx?.close().catch(() => {});
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
        micStream.getTracks().forEach((track) => track.stop());
        desktopStream?.getTracks().forEach((t) => t.stop());
        audioCtx?.close().catch(() => {});
      };

      recorder.start();
      setIsRecording(true);
      liveTranscriptAccRef.current = "";
      setLiveInsights(null);
      liveTranscriptAccRef.current = "";
      intervalRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.round((Date.now() - startedAt) / 1000));
      }, 1000);

      // Live transcript via browser SpeechRecognition
      const SpeechRecognitionAPI = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition
      );
      if (SpeechRecognitionAPI) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SpeechRecognitionAPI() as any;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = (meetingContext.outputLanguage ?? outputLanguage) === "sv" ? "sv-SE" : "en-US";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let text = "";
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript + " ";
          }
          liveTranscriptAccRef.current = text;
        };
        recognition.onerror = () => {};
        recognition.start();
        speechRecognitionRef.current = recognition;
      }

      // Poll live insights every 25 seconds
      liveInsightsTimerRef.current = window.setInterval(async () => {
        if (liveTranscriptAccRef.current.trim().length < 120 || !meetingContext.jobDescription) return;
        try {
          const res = await fetch("/api/live-insights", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-openai-key": openaiApiKey },
            body: JSON.stringify({
              transcript: liveTranscriptAccRef.current,
              jobDescription: meetingContext.jobDescription,
            }),
          });
          if (res.ok) setLiveInsights(await res.json() as LiveInsights);
        } catch {}
      }, 25000);
    } catch {
      setRecordingError("Recording could not start. Check microphone permission and try again.");
    }
  }

  function stopRecording() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (liveInsightsTimerRef.current) window.clearInterval(liveInsightsTimerRef.current);
    liveInsightsTimerRef.current = null;
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    setIsRecording(false);
    liveTranscriptAccRef.current = "";
    setLiveInsights(null);
    liveTranscriptAccRef.current = "";
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecordingStartedAt(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    desktopStreamRef.current?.getTracks().forEach((t) => t.stop());
    desktopStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
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

  if (!hasLoadedStorage) {
    return <div className="min-h-screen bg-taploCanvas" />;
  }

  if (!hasSeenLanding && !account) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  if (!account) {
    return (
      <OnboardingPage
        accountForm={accountForm}
        setAccountForm={setAccountForm}
        createAccount={createAccount}
        openaiApiKey={openaiApiKey}
        setOpenaiApiKey={setOpenaiApiKey}
      />
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
        <nav className="flex w-[210px] flex-shrink-0 flex-col border-r border-taploBorder bg-taploSidebar">
          {/* Logo */}
          <div className="px-5 pb-5 pt-5">
            <Image
              src="/brand/taplo-logo-full-color.png"
              alt="Taplo"
              width={3000}
              height={822}
              className="h-7 w-auto object-contain"
              priority
            />
            <div className="mt-1 text-[10px] text-[#aaa]">Interview intelligence</div>
          </div>

          {/* Nav */}
          <div className="flex-1 px-3">
            <ul className="space-y-0.5">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = activeScreen === item.id;
                const badge = item.id === "meetings" ? calendarMeetings.filter(m => m.status !== "completed").length : 0;
                return (
                  <li key={item.id}>
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        active ? "bg-taploCoral/10 font-medium text-ink" : "font-normal text-[#888] hover:bg-taploWarm/70 hover:text-ink"
                      }`}
                      onClick={() => setActiveScreen(item.id)}
                      type="button"
                    >
                      <Icon size={15} className={active ? "text-taploCoral" : "text-[#bbb]"} aria-hidden="true" />
                      {t(item.labelKey)}
                      {badge > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-taploCoral text-[10px] font-semibold text-white">
                          {badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Bottom */}
          <div className="px-3 pb-4">
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#888] hover:bg-taploWarm/70 hover:text-ink"
              type="button"
            >
              <Settings size={15} className="text-[#bbb]" />
              Settings
            </button>
            <div className="mt-1 flex items-center gap-3 rounded-xl bg-taploWarm px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-taploCoral/20 text-xs font-semibold text-taploCoral">
                {account.name ? account.name.slice(0, 2).toUpperCase() : "?"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{account.name}</div>
                <div className="truncate text-[11px] text-[#999]">{account.company}</div>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
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
          {/* FAB — shown when capture panel is closed */}
          {!isCapturePanelOpen && (
            <button
              className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-taploCoral text-white shadow-float hover:bg-taploCoralDark"
              onClick={() => setActiveScreen("meetings")}
              type="button"
              aria-label="New interview"
            >
              <Mic size={20} />
            </button>
          )}
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
              liveInsights={liveInsights}
              startRecording={startRecording}
              pauseRecording={pauseRecording}
              resumeRecording={resumeRecording}
              stopRecording={stopRecording}
              closePanel={() => setIsCapturePanelOpen(false)}
              t={t}
            />
          ) : null}
          {meetingAlert ? (
            <MeetingAlertBanner
              meeting={meetingAlert}
              onJoinInApp={() => {
                dismissedAlertIds.current.add(meetingAlert.id);
                setMeetingAlert(null);
                joinMeeting(meetingAlert);
              }}
              onDismiss={() => {
                dismissedAlertIds.current.add(meetingAlert.id);
                setMeetingAlert(null);
              }}
            />
          ) : null}
        </div>
      </div>
      )}
    </main>
  );
}

function OnboardingPage({
  accountForm,
  setAccountForm,
  createAccount,
  openaiApiKey,
  setOpenaiApiKey,
}: {
  accountForm: { name: string; email: string; company: string };
  setAccountForm: (value: { name: string; email: string; company: string }) => void;
  createAccount: () => void;
  openaiApiKey: string;
  setOpenaiApiKey: (value: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  return (
    <main className="grid min-h-screen grid-cols-1 bg-taploCanvas text-ink lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-taploWarm via-taploCanvas to-[#ede8dc] p-10 lg:p-14">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-taploCoral/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-taploCoral/10 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-taploCoral text-white shadow-soft">
            <Mic size={16} aria-hidden="true" />
          </div>
          <span className="font-fraunces text-2xl">Taplo</span>
        </div>
        <div className="relative max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-taploCoral">For recruiters</div>
          <h1 className="mt-4 font-fraunces text-5xl leading-[1.05] tracking-tight lg:text-6xl">
            Hear every signal.{" "}
            <em className="font-fraunces italic text-taploCoral">Miss nothing.</em>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#666]">
            Taplo records your interviews, transcribes them, and delivers a structured candidate
            dossier — submission draft, follow-up email, and gaps to revisit — minutes after you hang up.
          </p>
          <div className="mt-10 grid gap-3 text-sm text-[#444]">
            {["Live coverage tracking against the JD", "Whisper + GPT-4.1-mini, your own key", "Everything stays on your machine"].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-taploCoral/10 text-taploCoral text-xs">✓</div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-[#999]">Trusted by independent recruiters and boutique search firms.</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md rounded-3xl border border-taploBorder bg-white p-8 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#999]">Set up your workspace</div>
          <h2 className="mt-1 font-fraunces text-3xl">Let&apos;s get you started</h2>
          <p className="mt-1 text-sm text-[#666]">Takes about 30 seconds.</p>
          <div className="mt-7 space-y-4">
            {[
              { label: "Your name", key: "name" as const, placeholder: "Gerald Boakye", type: "text" },
              { label: "Work email", key: "email" as const, placeholder: "gerald@company.com", type: "email" },
              { label: "Company", key: "company" as const, placeholder: "Palmstone Advisory", type: "text" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#999]">{label}</label>
                <input
                  type={type}
                  className="mt-1.5 w-full rounded-xl border border-taploBorder bg-taploCanvas px-3.5 py-2.5 text-sm outline-none focus:border-taploCoral"
                  value={accountForm[key]}
                  onChange={(e) => setAccountForm({ ...accountForm, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#999]">OpenAI API key</label>
              <div className="relative mt-1.5">
                <input
                  type={showKey ? "text" : "password"}
                  className="w-full rounded-xl border border-taploBorder bg-taploCanvas px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-taploCoral"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-proj-…"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#aaa] hover:bg-taploWarm"
                >
                  {showKey ? <ArrowRight size={14} /> : <ArrowRight size={14} className="opacity-40" />}
                </button>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#999]">
                ✓ Stored locally. Never sent to Taplo servers.{" "}
                <a className="text-taploCoral hover:underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Get key →</a>
              </p>
            </div>
          </div>
          <button
            className="mt-7 w-full rounded-xl bg-taploCoral py-3 text-sm font-semibold text-white transition hover:bg-taploCoralDark disabled:opacity-40"
            disabled={!accountForm.name || !accountForm.email || !accountForm.company || !openaiApiKey.trim()}
            onClick={createAccount}
            type="button"
          >
            Continue to workspace
          </button>
        </div>
      </div>
    </main>
  );
}

function DashStat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Mic;
}) {
  return (
    <div className="rounded-2xl border border-taploBorder bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[#999]">{label}</span>
        <Icon className="h-4 w-4 text-taploCoral" />
      </div>
      <div className="mt-3 font-fraunces text-3xl font-normal text-ink">{value}</div>
      <div className="mt-1 text-xs text-[#999]">{hint}</div>
    </div>
  );
}

function SessionStatusChip({ status }: { status: InterviewSession["status"] }) {
  const map: Record<InterviewSession["status"], { label: string; cls: string }> = {
    analyzed: { label: "Analyzed", cls: "bg-success/15 text-success" },
    analysis_pending: { label: "Pending", cls: "bg-warning/20 text-[#b45309]" },
    completed: { label: "Completed", cls: "bg-taploBlue/15 text-taploBlue" },
    recording: { label: "Recording", cls: "bg-taploCoral/15 text-taploCoral" },
    draft: { label: "Draft", cls: "bg-taploWarm text-[#999]" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
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
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateLabel = `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`;

  const account = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(accountStorageKey) ?? "{}") as { name?: string }; } catch { return {}; }
  }, []);

  const upcomingMeetings = calendarMeetings.filter((m) => m.status !== "completed");
  const nextMeeting = upcomingMeetings[0];
  const analyzedSessions = sessions.filter((s) => s.status === "analyzed");
  const totalHours = sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 3600;
  const avgMin = sessions.length > 0 ? Math.round((totalHours * 60) / sessions.length) : 0;
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthSessions = sessions.filter((s) => {
    const d = new Date(s.startedAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#999]">{dateLabel}</div>
          <h1 className="mt-1 font-fraunces text-4xl font-normal text-ink">
            {greeting}{account.name ? `, ${account.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-[#666]">
            {upcomingMeetings.length > 0
              ? `${upcomingMeetings.length} upcoming interview${upcomingMeetings.length !== 1 ? "s" : ""}${analyzedSessions.length > 0 ? ` · ${analyzedSessions.length} session${analyzedSessions.length !== 1 ? "s" : ""} ready for review` : ""}.`
              : "No upcoming interviews. Add a meeting to get started."}
          </p>
        </div>
        <button
          className="rounded-full bg-taploCoral px-5 py-2.5 text-sm font-medium text-white hover:bg-taploCoralDark"
          onClick={() => onNavigate("meetings")}
          type="button"
        >
          Open meetings
        </button>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashStat label="Recordings this month" value={String(monthSessions.length)} hint="sessions captured" icon={Mic} />
        <DashStat label="Hours captured" value={totalHours.toFixed(1)} hint={`avg ${avgMin} min / session`} icon={Clock} />
        <DashStat label="Sessions analyzed" value={String(analyzedSessions.length)} hint={`${sessions.length} total session${sessions.length !== 1 ? "s" : ""}`} icon={TrendingUp} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-taploBorder bg-white p-6 shadow-soft">
          {nextMeeting ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#999]">Up next</div>
                  <h2 className="mt-1 font-fraunces text-2xl text-ink">
                    {nextMeeting.candidateName || nextMeeting.title}
                  </h2>
                  <div className="text-sm text-[#666]">{nextMeeting.title}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="rounded-full bg-taploCoral/10 px-3 py-1 text-xs font-medium text-taploCoral">
                    {new Date(nextMeeting.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl bg-taploCoral px-4 py-3 text-sm font-medium text-white hover:bg-taploCoralDark"
                  onClick={() => onNavigate("meetings")}
                  type="button"
                >
                  Join in-app
                </button>
                {nextMeeting.meetingUrl ? (
                  <a
                    href={nextMeeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-xl border border-taploBorder bg-white px-4 py-3 text-sm text-ink hover:bg-taploWarm"
                  >
                    Open in {detectMeetingClient(nextMeeting.meetingUrl)}
                  </a>
                ) : (
                  <button
                    className="rounded-xl border border-taploBorder bg-white px-4 py-3 text-sm text-[#999] hover:bg-taploWarm"
                    onClick={() => onNavigate("meetings")}
                    type="button"
                  >
                    Add meeting link
                  </button>
                )}
              </div>

              <div className="mt-6 rounded-xl bg-taploWarm/60 p-4 text-xs text-[#666]">
                <div className="font-semibold text-ink">Prep checklist</div>
                <ul className="mt-2 space-y-1.5">
                  {[
                    { label: "Job description attached", done: !!nextMeeting.jobDescription },
                    { label: "CV attached", done: !!nextMeeting.cvText },
                    { label: "Recruiter notes added", done: !!nextMeeting.recruiterNotes },
                  ].map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      <span className={item.done ? "text-success" : "text-[#bbb]"}>
                        {item.done ? "✓" : "○"}
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="text-xs uppercase tracking-wider text-[#999]">Up next</div>
              <p className="mt-4 text-sm text-[#666]">No upcoming interviews scheduled.</p>
              <button
                className="mt-4 rounded-full bg-taploCoral px-4 py-2 text-sm font-medium text-white hover:bg-taploCoralDark"
                onClick={() => onNavigate("meetings")}
                type="button"
              >
                Add meeting
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-taploBorder bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-fraunces text-lg text-ink">Recent sessions</h2>
            <button
              className="inline-flex items-center gap-0.5 text-xs text-taploCoral hover:underline"
              onClick={() => onNavigate("analysis")}
              type="button"
            >
              All <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          {sessions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-taploWarm/60"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {s.candidateName || "Unnamed candidate"}
                    </div>
                    <div className="truncate text-xs text-[#666]">
                      {s.meetingTitle || formatDuration(s.durationSeconds)}
                    </div>
                  </div>
                  <SessionStatusChip status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 text-center text-sm text-[#999]">
              Sessions appear here after you record an interview.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-taploBorder bg-white/50 p-5">
        <div className="flex items-center gap-3 text-sm text-[#666]">
          <Users className="h-4 w-4 text-taploCoral" />
          {calendarMeetings.length} meeting{calendarMeetings.length !== 1 ? "s" : ""} in your workspace
          {sessions.length > 0 ? ` · ${sessions.length} recorded session${sessions.length !== 1 ? "s" : ""}` : ""}.
        </div>
      </section>
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
  const [showAddForm, setShowAddForm] = useState(false);
  const selected = calendarMeetings.find((m) => m.id === selectedMeetingId) ?? calendarMeetings[0];
  const reminders = selected ? contextualReminders(selected) : [];
  const connectedProvider = calendarConnections.find((c) => c.status === "connected" && c.provider !== "manual");

  return (
    <div className="mx-auto grid h-full max-w-7xl grid-cols-1 gap-6 overflow-hidden px-8 py-10 lg:grid-cols-[380px_1fr]">
      {/* Left: meeting list */}
      <section className="flex flex-col overflow-hidden">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-fraunces text-3xl text-ink">Meetings</h1>
            {connectedProvider ? (
              <p className="mt-1 text-sm text-[#999]">
                Synced from {connectedProvider.provider}
                {calendarSyncStatus ? ` · ${calendarSyncStatus}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#999]">Manual workspace</p>
            )}
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="shrink-0 rounded-full bg-taploCoral px-4 py-2 text-sm font-medium text-white hover:bg-taploCoralDark"
            type="button"
          >
            {showAddForm ? "Cancel" : "+ Add"}
          </button>
        </header>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-4 space-y-2 rounded-2xl border border-taploBorder bg-white p-4 shadow-soft">
            <input
              className="w-full rounded-xl border border-taploBorder bg-taploCanvas px-3 py-2 text-sm outline-none placeholder:text-[#bbb] focus:border-taploCoral"
              value={meetingForm.candidateName}
              onChange={(e) => setMeetingForm({ ...meetingForm, candidateName: e.target.value, title: e.target.value })}
              placeholder="Candidate name or meeting title"
            />
            <input
              className="w-full rounded-xl border border-taploBorder bg-taploCanvas px-3 py-2 text-sm outline-none placeholder:text-[#bbb] focus:border-taploCoral"
              value={meetingForm.meetingUrl}
              onChange={(e) => setMeetingForm({ ...meetingForm, meetingUrl: e.target.value })}
              placeholder="Paste meeting link (Zoom, Meet, Teams…)"
            />
            <button
              className="w-full rounded-xl bg-taploCoral py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-taploCoralDark"
              disabled={!meetingForm.meetingUrl}
              onClick={() => { addMeeting(); setShowAddForm(false); }}
              type="button"
            >
              Add meeting
            </button>
          </div>
        )}

        {/* Calendar source controls */}
        {calendarSetupChoice !== "manual" && (
          <div className="mb-4 space-y-2">
            <div className="flex rounded-xl border border-taploBorder bg-white p-1">
              {(["interviews", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${calendarSyncMode === mode ? "bg-taploCoral text-white" : "text-[#666] hover:bg-taploWarm"}`}
                  onClick={() => setCalendarSyncMode(mode)}
                  type="button"
                >
                  {mode === "interviews" ? "Interviews only" : "All events"}
                </button>
              ))}
            </div>
            {calendarConnections.filter((c) => c.provider !== "manual").map((conn) => (
              <div key={conn.id} className="flex items-center justify-between rounded-xl border border-taploBorder bg-taploWarm/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-ink">{conn.provider}</p>
                  <p className="text-xs text-[#999]">
                    {conn.status === "connected" ? conn.connectedAt ? `Connected ${new Date(conn.connectedAt).toLocaleDateString()}` : "Connected" : "Not connected"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {conn.status === "connected" ? (
                    <>
                      <button onClick={() => syncCalendarEvents(conn.provider)} className="rounded-lg bg-taploCoral px-3 py-1.5 text-xs font-medium text-white hover:bg-taploCoralDark" type="button">Sync</button>
                      <button onClick={() => disconnectCalendar(conn.provider)} className="rounded-lg border border-taploBorder bg-white px-3 py-1.5 text-xs text-[#666] hover:bg-taploWarm" type="button">Disconnect</button>
                    </>
                  ) : (
                    <button onClick={() => connectCalendar(conn.provider)} className="rounded-lg bg-taploCoral px-3 py-1.5 text-xs font-medium text-white hover:bg-taploCoralDark" type="button">Connect</button>
                  )}
                </div>
              </div>
            ))}
            {(calendarSetupMessage || calendarSyncStatus) && (
              <p className="rounded-xl border border-taploCoral/30 bg-taploCoralSoft px-3 py-2 text-xs text-[#555]">
                {calendarSetupMessage || calendarSyncStatus}
              </p>
            )}
          </div>
        )}

        {/* Meeting list */}
        <ul className="space-y-2 overflow-y-auto pr-1">
          {calendarMeetings.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-taploBorder p-6 text-center text-sm text-[#999]">
              No meetings yet. Add one above or connect your calendar.
            </li>
          ) : (
            calendarMeetings.map((m) => {
              const active = m.id === (selected?.id ?? "");
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedMeetingId(m.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${active ? "border-taploCoral/40 bg-white shadow-soft" : "border-taploBorder bg-white/60 hover:bg-white"}`}
                    type="button"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[#999]">
                      <span>
                        {new Date(m.startsAt).toLocaleDateString([], { weekday: "short" }).toUpperCase()} · {new Date(m.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="rounded-sm bg-taploWarm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">{m.provider}</span>
                    </div>
                    <div className="mt-1.5 truncate text-base font-semibold text-ink">{m.candidateName || m.title}</div>
                    {m.candidateName && m.title !== m.candidateName && (
                      <div className="truncate text-xs text-[#888]">{m.title}</div>
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Right: prep panel */}
      {selected ? (
        <section className="flex flex-col overflow-hidden rounded-3xl border border-taploBorder bg-white shadow-soft">
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-taploCoral/10 px-3 py-1 text-xs text-taploCoral">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(selected.startsAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                <h2 className="mt-3 break-all font-fraunces text-2xl leading-tight text-ink line-clamp-2">{selected.candidateName || selected.title}</h2>
                {selected.candidateName && (
                  <p className="truncate text-sm text-[#666]">{selected.title}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {selected.meetingUrl && (
                  <a
                    href={selected.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-taploBorder bg-white px-4 py-2 text-sm hover:bg-taploWarm"
                  >
                    <Video className="h-3.5 w-3.5" /> Open native
                  </a>
                )}
                <button
                  className="rounded-full bg-taploCoral px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:bg-taploCoralDark"
                  disabled={!selected.meetingUrl || !selected.jobDescription}
                  onClick={() => joinMeeting(selected)}
                  type="button"
                >
                  Join in-app
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <PrepSection label="Job description">
                <textarea
                  rows={5}
                  value={selected.jobDescription}
                  onChange={(e) => updateMeeting(selected.id, { jobDescription: e.target.value })}
                  placeholder="Paste the job description here…"
                  className="w-full resize-none rounded-xl border border-taploBorder bg-taploCanvas px-3 py-2.5 text-sm outline-none placeholder:text-[#bbb] focus:border-taploCoral"
                />
              </PrepSection>

              <PrepSection label="Candidate CV">
                <textarea
                  rows={4}
                  value={selected.cvText}
                  onChange={(e) => updateMeeting(selected.id, { cvText: e.target.value })}
                  placeholder="Paste the candidate's CV or resume…"
                  className="w-full resize-none rounded-xl border border-taploBorder bg-taploCanvas px-3 py-2.5 text-sm outline-none placeholder:text-[#bbb] focus:border-taploCoral"
                />
              </PrepSection>

              <PrepSection label="Recruiter notes">
                <textarea
                  rows={3}
                  value={selected.recruiterNotes}
                  onChange={(e) => updateMeeting(selected.id, { recruiterNotes: e.target.value })}
                  placeholder="Referral source, comp expectations, open questions…"
                  className="w-full resize-none rounded-xl border border-taploBorder bg-taploCanvas px-3 py-2.5 text-sm outline-none placeholder:text-[#bbb] focus:border-taploCoral"
                />
              </PrepSection>

              <PrepSection label="Interview language">
                <div className="flex gap-2">
                  {(["en", "sv"] as const).map((lang) => (
                    <button
                      key={lang}
                      className={`rounded-full border px-3 py-1.5 text-xs ${selected.outputLanguage === lang ? "border-taploCoral bg-taploCoral/10 text-taploCoral" : "border-taploBorder bg-white text-[#666] hover:bg-taploWarm"}`}
                      onClick={() => updateMeeting(selected.id, { outputLanguage: lang })}
                      type="button"
                    >
                      {lang === "en" ? "English" : "Swedish"}
                    </button>
                  ))}
                </div>
              </PrepSection>

              {reminders.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-taploCoral/10 to-transparent p-5">
                  <div className="font-fraunces text-lg text-ink">AI-prepared talking points</div>
                  <ul className="mt-3 space-y-2 text-sm text-[#555]">
                    {reminders.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          {(!selected.meetingUrl || !selected.jobDescription) && (
            <div className="border-t border-taploBorder bg-taploWarm/60 px-8 py-3 text-xs text-[#999]">
              {!selected.meetingUrl ? "⚠ Add a meeting link above to enable joining." : "⚠ Add a job description above to enable joining."}
            </div>
          )}
        </section>
      ) : (
        <section className="flex items-center justify-center rounded-3xl border border-dashed border-taploBorder p-10 text-sm text-[#999]">
          Select or add a meeting to prepare context.
        </section>
      )}
    </div>
  );
}

function PrepSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#999]">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
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
  liveInsights,
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
  liveInsights: LiveInsights | null;
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  closePanel: () => void;
  t: (key: TranslationKey) => string;
}) {
  const [minimized, setMinimized] = useState(false);
  const reminders = meeting ? contextualReminders(meeting) : [];
  const candidateLabel = meeting?.candidateName || meeting?.title || "Interview";

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-taploCoral text-white shadow-float hover:bg-taploCoralDark"
        aria-label="Open capture panel"
        type="button"
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          {isRecording && !isPaused && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-60" />
          )}
          <span className="relative inline-flex h-full w-full rounded-full bg-white" />
        </span>
      </button>
    );
  }

  return (
    <aside className="fixed bottom-6 right-6 z-40 w-[360px] overflow-hidden rounded-2xl border border-taploBorder bg-white shadow-float">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-taploBorder bg-gradient-to-br from-taploCoral/8 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2.5 w-2.5 ${isRecording && !isPaused ? "" : "opacity-40"}`} aria-hidden>
            {isRecording && !isPaused && (
              <span className="absolute inset-0 animate-ping rounded-full bg-taploCoral opacity-60" />
            )}
            <span className="relative inline-flex h-full w-full rounded-full bg-taploCoral" />
          </span>
          <div className="text-sm font-medium text-ink">
            {isRecording ? (isPaused ? "Paused" : "Recording") : `Capture · ${candidateLabel}`}
            {isRecording ? ` · ${formatTimestamp(recordingSeconds)}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMinimized(true)}
            className="rounded-md p-1.5 text-[#999] hover:bg-taploWarm"
            type="button"
            aria-label="Collapse panel"
            title="Collapse"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={closePanel}
            className="rounded-md p-1.5 text-[#999] hover:bg-taploWarm"
            type="button"
            aria-label="Close panel"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Consent */}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-taploWarm/60 px-3 py-2.5 text-xs text-[#666]">
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(e) => setConsentConfirmed(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-taploCoral"
          />
          <span>{t("consent")}</span>
        </label>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              disabled={!consentConfirmed || !meeting?.jobDescription}
              onClick={startRecording}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-taploCoral px-3 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-taploCoralDark"
              type="button"
            >
              <Mic className="h-3.5 w-3.5" /> {t("start")}
            </button>
          ) : (
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-taploCoral px-3 py-2.5 text-sm font-medium text-white hover:bg-taploCoralDark"
              type="button"
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {isPaused ? t("resume") : t("pause")}
            </button>
          )}
          <button
            disabled={!isRecording}
            onClick={stopRecording}
            className="rounded-xl border border-taploBorder bg-white px-3 py-2.5 text-sm text-[#555] disabled:opacity-40 hover:bg-taploWarm"
            type="button"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Notes */}
        <textarea
          rows={2}
          placeholder="Live notes…"
          value={interviewNotes}
          onChange={(e) => setInterviewNotes(e.target.value)}
          className="w-full resize-none rounded-lg border border-taploBorder bg-taploCanvas px-3 py-2 text-xs text-ink outline-none placeholder:text-[#bbb] focus:border-taploCoral"
        />

        {/* Contextual reminders */}
        {reminders.length > 0 && !isRecording && (
          <div className="space-y-1.5">
            {reminders.slice(0, 2).map((r) => (
              <p key={r} className="rounded-lg bg-taploWarm px-3 py-2 text-xs leading-5 text-[#666]">{r}</p>
            ))}
          </div>
        )}

        {/* Live insights */}
        {isRecording && liveInsights && (
          <div className="space-y-1.5 rounded-lg border border-taploBorder bg-taploWarm/40 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#999]">
              Live insights
            </div>
            <div className="space-y-1.5 text-xs">
              {liveInsights.covered.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-success">✓</span>
                  <span className="text-ink">{item}</span>
                </div>
              ))}
              {liveInsights.gaps.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-warning">⚠</span>
                  <span className="text-ink">{item}</span>
                </div>
              ))}
              {liveInsights.followUps.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-taploCoral">
                  <span className="mt-0.5">→</span>
                  <span className="text-[#555]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status / errors */}
        {recordingError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{recordingError}</p>
        )}
        {transcriptionStatus && !recordingError && (
          <p className="text-xs leading-5 text-[#999]">{transcriptionStatus}</p>
        )}
        {recordingStartedAt && !isRecording && !transcriptionStatus && (
          <p className="text-xs text-[#999]">
            Started {new Date(recordingStartedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </aside>
  );
}

function detectMeetingClient(url: string): string {
  if (url.includes("zoom.us")) return "Zoom";
  if (url.includes("teams.microsoft.com")) return "Teams";
  if (url.includes("meet.google.com")) return "Meet";
  if (url.includes("whereby.com")) return "Whereby";
  return "Meeting link";
}

function MeetingAlertBanner({
  meeting,
  onJoinInApp,
  onDismiss,
}: {
  meeting: CalendarMeeting;
  onJoinInApp: () => void;
  onDismiss: () => void;
}) {
  const startsAt = new Date(meeting.startsAt);
  const diff = Math.round((startsAt.getTime() - Date.now()) / 60000);
  const timeLabel = diff <= 0 ? "Starting now" : `Starting in ${diff} min`;
  const clientName = detectMeetingClient(meeting.meetingUrl);

  return (
    <div className="fixed right-5 top-5 z-50 w-80 rounded-2xl border border-taploBorder bg-white p-4 shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-taploCoral">{timeLabel}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[#111]">{meeting.title || meeting.candidateName}</p>
          {meeting.candidateName ? <p className="mt-0.5 truncate text-xs text-[#999]">{meeting.candidateName}</p> : null}
        </div>
        <button
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#999] hover:bg-taploWarm"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-xl bg-taploCoral px-3 py-2 text-xs font-semibold text-white transition hover:bg-taploCoralDark"
          onClick={onJoinInApp}
          type="button"
        >
          Join in-app
        </button>
        {meeting.meetingUrl ? (
          <a
            className="flex-1 rounded-xl border border-taploBorder bg-taploWarm px-3 py-2 text-center text-xs font-semibold text-[#555] transition hover:bg-white"
            href={meeting.meetingUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open in {clientName}
          </a>
        ) : null}
      </div>
    </div>
  );
}

const analysisTabs = ["Insights", "Client draft", "Follow-up email", "Notes"] as const;
type AnalysisTab = (typeof analysisTabs)[number];

function AnalysisScreen({
  sessions,
  selectedSessionId,
  setSelectedSessionId,
  selectedSession,
  output,
  transcript,
  recruiterNotes,
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
  const [activeTab, setActiveTab] = useState<AnalysisTab>("Insights");

  if (!sessions.length) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-sm text-[#999]">
        Complete an interview recording to generate analysis.
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[280px_1fr_420px] overflow-hidden">
      {/* Session list */}
      <aside className="overflow-y-auto border-r border-taploBorder bg-white/60 p-5">
        <h1 className="font-fraunces text-2xl text-ink">Sessions</h1>
        <ul className="mt-5 space-y-1.5">
          {sessions.map((s) => {
            const active = s.id === selectedSessionId;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left transition-colors ${active ? "bg-taploCoral/10" : "hover:bg-taploWarm/70"}`}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {s.candidateName || s.meetingTitle || "Unnamed candidate"}
                    </span>
                    <SessionStatusChip status={s.status} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#999]">
                    {new Date(s.startedAt).toLocaleDateString()} · {formatDuration(s.durationSeconds)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Transcript */}
      <section className="overflow-y-auto px-8 py-8">
        {selectedSession ? (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-fraunces text-3xl text-ink">
                  {selectedSession.candidateName || selectedSession.meetingTitle || "Interview"}
                </h2>
                <p className="text-sm text-[#666]">
                  {selectedSession.meetingTitle} · {new Date(selectedSession.startedAt).toLocaleDateString()} · {formatDuration(selectedSession.durationSeconds)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedSession.recordingUrl && (
                  <a
                    href={selectedSession.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-taploBorder bg-white px-3 py-1.5 text-xs hover:bg-taploWarm"
                  >
                    <FileAudio className="h-3 w-3" /> Audio
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-taploBorder bg-white p-6 shadow-soft">
              <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#999]">
                Transcript
              </div>
              {transcript.length > 0 ? (
                <div className="space-y-4">
                  {transcript.map((seg) => (
                    <div key={seg.id} className="flex gap-4 text-sm">
                      <span className="w-12 shrink-0 font-mono text-[11px] text-[#999]">
                        {Math.floor(seg.startSeconds / 60).toString().padStart(2, "0")}:{Math.floor(seg.startSeconds % 60).toString().padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        <div className={`text-[11px] font-medium uppercase tracking-wider ${seg.speaker === "Recruiter" ? "text-taploCoral" : "text-[#999]"}`}>
                          {seg.speaker}
                        </div>
                        <p className="mt-0.5 leading-relaxed text-ink">{seg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#999]">No transcript available yet.</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#999]">
            Select a session to view the transcript.
          </div>
        )}
      </section>

      {/* Insights / outputs */}
      <aside className="overflow-y-auto border-l border-taploBorder bg-white/60 p-6">
        {selectedSession && output ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {analysisTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${activeTab === tab ? "bg-taploCoral text-white" : "bg-taploWarm text-[#666] hover:text-ink"}`}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {activeTab === "Insights" && (
                <div className="space-y-5">
                  <AnalysisBlock label="Summary">
                    <p className="text-sm leading-relaxed text-ink">{output.candidateSummary}</p>
                  </AnalysisBlock>

                  <AnalysisBlock label="Signals">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { k: "Experience", v: output.projectRelevantExperienceSignals.length },
                        { k: "Technical", v: output.technicalDomainSignals.length },
                        { k: "Comm.", v: output.communicationObservations.length },
                      ].map((s) => (
                        <div key={s.k} className="rounded-xl bg-taploWarm/60 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-[#999]">{s.k}</div>
                          <div className="mt-1 font-fraunces text-xl text-ink">{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </AnalysisBlock>

                  {output.projectRelevantExperienceSignals.length > 0 && (
                    <AnalysisBlock label="✓ Covered" tint="success">
                      <ul className="space-y-1.5 text-sm">
                        {output.projectRelevantExperienceSignals.slice(0, 5).map((ins) => (
                          <li key={ins.id} className="flex gap-2">
                            <span className="text-success">✓</span>
                            <span className="text-ink">{ins.title}</span>
                          </li>
                        ))}
                      </ul>
                    </AnalysisBlock>
                  )}

                  {(output.concernsOrUnclearAreas.length > 0 || output.missingInformation.length > 0) && (
                    <AnalysisBlock label="⚠ Gaps" tint="warning">
                      <ul className="space-y-1.5 text-sm">
                        {[...output.concernsOrUnclearAreas, ...output.missingInformation].slice(0, 5).map((ins) => (
                          <li key={ins.id} className="flex gap-2">
                            <span className="text-warning">⚠</span>
                            <span className="text-ink">{ins.title}</span>
                          </li>
                        ))}
                      </ul>
                    </AnalysisBlock>
                  )}

                  {output.suggestedFollowUpQuestions.length > 0 && (
                    <AnalysisBlock label="→ Follow up">
                      <ul className="space-y-2 text-sm">
                        {output.suggestedFollowUpQuestions.slice(0, 5).map((ins) => (
                          <li key={ins.id} className="flex gap-2">
                            <span className="text-taploCoral">→</span>
                            <span className="text-[#555]">{ins.observation}</span>
                          </li>
                        ))}
                      </ul>
                    </AnalysisBlock>
                  )}
                </div>
              )}

              {activeTab === "Client draft" && (
                <DraftOutputCard title="Submission draft" body={output.clientSubmissionDraft} />
              )}

              {activeTab === "Follow-up email" && (
                <DraftOutputCard title={`To: ${selectedSession.candidateName || "candidate"}`} body={output.candidateFollowUpEmailDraft} icon="mail" />
              )}

              {activeTab === "Notes" && (
                <AnalysisBlock label="Internal recruiter notes">
                  <textarea
                    rows={14}
                    defaultValue={[output.internalRecruiterNotes, ...recruiterNotes.map((n) => n.text)].filter(Boolean).join("\n\n") || "No notes captured."}
                    className="w-full resize-none rounded-xl border border-taploBorder bg-white p-3 text-sm leading-relaxed text-ink outline-none focus:border-taploCoral"
                  />
                </AnalysisBlock>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-[#999]">
            {selectedSession ? "Analysis not yet generated for this session." : "Select a session to view insights."}
          </div>
        )}
      </aside>
    </div>
  );
}

function AnalysisBlock({
  label,
  tint,
  children,
}: {
  label: string;
  tint?: "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className={`mb-2 text-[11px] font-semibold uppercase tracking-wider ${tint === "success" ? "text-success" : tint === "warning" ? "text-warning" : "text-[#999]"}`}>
        {label}
      </div>
      <div className="rounded-xl border border-taploBorder bg-white p-4 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function DraftOutputCard({ title, body, icon }: { title: string; body: string; icon?: "mail" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div className="rounded-2xl border border-taploBorder bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          {icon === "mail" ? <FileAudio className="h-3.5 w-3.5 text-taploCoral" /> : <FileAudio className="h-3.5 w-3.5 text-taploCoral" />}
          {title}
        </div>
        <button onClick={copy} className="rounded-md p-1.5 text-[#999] hover:bg-taploWarm" type="button">
          {copied ? <span className="text-[10px] text-success">Copied</span> : <ArrowUpRight className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#555]">{body || "Not generated yet."}</pre>
    </div>
  );
}

function UsageStat({
  label,
  value,
  delta,
  down,
}: {
  label: string;
  value: string;
  delta: string;
  down?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-taploBorder bg-white p-5 shadow-soft">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[#999]">{label}</div>
      <div className="mt-2 font-fraunces text-3xl font-normal text-ink">{value}</div>
      <div className={`mt-1 inline-flex items-center gap-1 text-xs ${down ? "text-success" : "text-[#999]"}`}>
        {down ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
        {delta}
      </div>
    </div>
  );
}

function UsageScreen({
  sessions,
  usage,
}: {
  sessions: InterviewSession[];
  usage: { durationSeconds: number; transcription: number; ai: number; total: number };
  t: (key: TranslationKey) => string;
}) {
  const avgPerSession = sessions.length > 0 ? usage.total / sessions.length : 0;
  const totalMinutes = Math.round(usage.durationSeconds / 60);
  const maxCost = Math.max(...sessions.map((s) => s.transcriptionCostUsd + s.aiAnalysisCostUsd), 0.001);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <h1 className="font-fraunces text-4xl text-ink">Usage &amp; cost</h1>
        <p className="mt-1 text-sm text-[#666]">
          OpenAI spend across Whisper and GPT-4.1-mini, this billing month.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <UsageStat label="Spend (MTD)" value={formatUsd(usage.total)} delta="this month" down={usage.total < 5} />
        <UsageStat label="Avg / session" value={formatUsd(avgPerSession)} delta="per interview" />
        <UsageStat label="Minutes processed" value={String(totalMinutes)} delta="audio captured" />
        <UsageStat label="Sessions recorded" value={String(sessions.length)} delta="total" />
      </section>

      {sessions.length > 0 && (
        <section className="mt-8 rounded-2xl border border-taploBorder bg-white p-6 shadow-soft">
          <div className="flex items-end justify-between">
            <h2 className="font-fraunces text-xl text-ink">Cost per session</h2>
            <div className="flex items-center gap-4 text-[11px] text-[#999]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-taploCoral" /> Whisper
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-taploCoral/40" /> GPT
              </span>
            </div>
          </div>
          <div className="mt-6 flex h-40 items-end gap-3">
            {sessions.map((s) => {
              const wh = (s.transcriptionCostUsd / maxCost) * 100;
              const gh = (s.aiAnalysisCostUsd / maxCost) * 100;
              return (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-full w-full flex-col-reverse overflow-hidden rounded-md">
                    <div style={{ height: `${wh}%` }} className="bg-taploCoral" />
                    <div style={{ height: `${gh}%` }} className="bg-taploCoral/40" />
                  </div>
                  <span className="truncate text-[10px] text-[#999]">
                    {(s.candidateName || s.meetingTitle || "—").split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-taploBorder bg-white shadow-soft">
        {sessions.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-taploBorder bg-taploWarm/40 text-left text-[11px] uppercase tracking-wider text-[#999]">
              <tr>
                <th className="px-5 py-3 font-medium">Session</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Minutes</th>
                <th className="px-5 py-3 font-medium text-right">Whisper</th>
                <th className="px-5 py-3 font-medium text-right">GPT</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-taploBorder last:border-0 hover:bg-taploWarm/30">
                  <td className="px-5 py-3 font-medium text-ink">{s.candidateName || s.meetingTitle || "Unnamed"}</td>
                  <td className="px-5 py-3 text-[#666]">{new Date(s.startedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{Math.round(s.durationSeconds / 60)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatUsd(s.transcriptionCostUsd)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatUsd(s.aiAnalysisCostUsd)}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums">
                    {formatUsd(s.transcriptionCostUsd + s.aiAnalysisCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-[#999]">
            No sessions recorded yet. Usage will appear here after your first interview.
          </div>
        )}
      </section>
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

