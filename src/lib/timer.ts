import { LocalStorage } from "@raycast/api";

const TIMER_KEY = "giro_active_timer";

export interface TimerState {
  /** Numeric Jira issue ID — required by Tempo API v4 */
  issueId: string;
  issueKey: string;
  issueSummary: string;
  startedAt: number; // Unix ms timestamp
  /** Numeric Jira project ID — used to look up linked Tempo accounts */
  jiraProjectId?: string;
  /** Tempo account key selected for the _Commessa_ work attribute */
  accountKey?: string;
}

/**
 * Get the currently running timer, or null if none.
 */
export async function getActiveTimer(): Promise<TimerState | null> {
  const raw = await LocalStorage.getItem<string>(TIMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

/**
 * Start a timer for the given issue. Returns the previous timer if one was running.
 */
export async function startTimer(
  issueId: string,
  issueKey: string,
  issueSummary: string,
  jiraProjectId?: string,
  accountKey?: string,
): Promise<TimerState | null> {
  const prev = await getActiveTimer();
  const timer: TimerState = {
    issueId,
    issueKey,
    issueSummary,
    startedAt: Date.now(),
    jiraProjectId,
    accountKey,
  };
  await LocalStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  return prev;
}

/**
 * Stop the current timer. Returns the timer that was stopped, or null.
 */
export async function stopTimer(): Promise<TimerState | null> {
  const timer = await getActiveTimer();
  await LocalStorage.removeItem(TIMER_KEY);
  return timer;
}

/**
 * Format elapsed time in a human-readable form.
 * - Under 60 s  → "Xs"
 * - Under 1 h   → "Xm"
 * - 1 h or more → "Xh Ym"
 * Negative values are treated as 0.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}
