# Interview Intelligence Workspace Integration Notes

## Transcription

The transcript model is already timestamp-based through `TranscriptSegment`.
To add real transcription later:

1. Upload or stream the recorded browser audio from `InterviewSession.recordingUrl`.
2. Send the audio blob to a transcription service from an API route.
3. Replace the placeholder segment created in `starterTranscript` with speaker-aware `TranscriptSegment` records.
4. Preserve `startSeconds` and `endSeconds` so insights can link to evidence timestamps.

## LLM analysis

The placeholder analysis lives in `src/lib/placeholderAnalysis.ts`.
Replace `createPlaceholderAnalysis` with a server-side API call that:

1. Takes `Role`, `Candidate`, `InterviewSession`, recruiter notes, and `TranscriptSegment[]`.
2. Returns a `GeneratedOutput` object with categorized `InterviewInsight[]`.
3. Requires evidence references for each generated insight.
4. Keeps output framed as observations only.

Do not add hiring scores, rankings, hire or reject recommendations, personality analysis, emotion analysis, or automated decision-making.

## Storage

This MVP uses client-side React state. A lightweight database can be introduced behind the same entities:

- `Role`
- `Candidate`
- `InterviewSession`
- `TranscriptSegment`
- `InterviewInsight`
- `GeneratedOutput`

The current shapes are defined in `src/types/interview.ts`.
