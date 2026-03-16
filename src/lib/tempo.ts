import { getPrefs } from "./preferences";

const TEMPO_API_BASE = "https://api.tempo.io/4";

export interface TempoWorklog {
  tempoWorklogId: number;
  issue: { key: string };
  timeSpentSeconds: number;
  startDate: string;
  startTime: string;
  description: string;
}

function tempoHeaders(): Record<string, string> {
  const { tempoApiToken } = getPrefs();
  return {
    Authorization: `Bearer ${tempoApiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function tempoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${TEMPO_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...tempoHeaders(), ...(options?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Tempo API error (${res.status}): ${body}`);
  }
  return JSON.parse(body) as T;
}

interface AccountLinkResult {
  results: Array<{ account: { self: string }; default: boolean }>;
}

export interface TempoAccount {
  id: number;
  key: string;
  name: string;
}

/** Fetch Tempo accounts linked to a Jira project (numeric project ID). */
export async function getAccountsForProject(jiraProjectId: string): Promise<TempoAccount[]> {
  const data = await tempoFetch<AccountLinkResult>(
    `/account-links/project/${encodeURIComponent(jiraProjectId)}`
  );
  const accounts = await Promise.all(
    data.results.map(async (link) => {
      // link.account.self is the full URL, e.g. https://api.tempo.io/4/accounts/KEY
      const selfUrl = link.account.self;
      const account = await fetch(selfUrl, { headers: tempoHeaders() }).then((r) => r.json() as Promise<TempoAccount>);
      return account;
    })
  );
  return accounts;
}

export interface LogTimeParams {
  /** Numeric Jira issue ID (e.g. "12345") — required by Tempo API v4 */
  issueId: string;
  /** Human-readable key kept for display purposes (e.g. "PROJ-123") */
  issueKey: string;
  /** Date in YYYY-MM-DD format */
  startDate: string;
  /** Time in HH:mm:ss format */
  startTime: string;
  /** Duration in seconds */
  timeSpentSeconds: number;
  description?: string;
  /** Tempo account key to use for the _Commessa_ work attribute */
  accountKey?: string;
}

/**
 * Log time to Tempo for a Jira issue.
 * Automatically resolves required work attributes (e.g. _Commessa_).
 */
export async function logTime(params: LogTimeParams): Promise<TempoWorklog> {
  const { jiraAccountId } = getPrefs();

  return tempoFetch<TempoWorklog>("/worklogs", {
    method: "POST",
    body: JSON.stringify({
      authorAccountId: jiraAccountId,
      issueId: parseInt(params.issueId, 10),
      startDate: params.startDate,
      startTime: params.startTime,
      timeSpentSeconds: params.timeSpentSeconds,
      description: params.description || "Tracked via Giro",
      ...(params.accountKey ? { attributes: [{ key: "_Commessa_", value: params.accountKey }] } : {}),
    }),
  });
}
