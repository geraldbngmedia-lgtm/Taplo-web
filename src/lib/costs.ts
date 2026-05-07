export const TRANSCRIPTION_COST_PER_MINUTE_USD = 0.006;
export const AI_ANALYSIS_COST_PER_INTERVIEW_USD = 0.03;

export function estimateTranscriptionCost(durationSeconds: number) {
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return Number((minutes * TRANSCRIPTION_COST_PER_MINUTE_USD).toFixed(4));
}

export function estimateInterviewCost(durationSeconds: number) {
  const transcriptionCostUsd = estimateTranscriptionCost(durationSeconds);

  return {
    transcriptionCostUsd,
    aiAnalysisCostUsd: AI_ANALYSIS_COST_PER_INTERVIEW_USD,
  };
}

export function formatUsd(value: number) {
  return `$${value.toFixed(4)}`;
}
