import { getPrefs } from "./preferences";
import { getCached, setCached, CACHE_KEYS } from "./cache";

interface JiraResponse<T> {
  values?: T[];
  issues?: T[];
  [key: string]: unknown;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate: string;
  endDate: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string; iconUrl: string };
    project: { id: string; key: string; name: string };
    story_points?: number;
    [key: string]: unknown;
  };
}

export interface CreateIssueParams {
  projectKey: string;
  summary: string;
  issueType: string;
  epicKey?: string;
  storyPoints?: number;
  sprintId?: number;
}

const JIRA_API_BOARD_SPRINT  = (boardId: string | number) => `/rest/agile/1.0/board/${boardId}/sprint?state=active`;
const JIRA_API_SPRINT_ISSUES = (sprintId: number, jql: string) => `/rest/agile/1.0/sprint/${sprintId}/issue?jql=${jql}&maxResults=50`;
const JIRA_API_SPRINT_ISSUE  = (sprintId: number) => `/rest/agile/1.0/sprint/${sprintId}/issue`;
const JIRA_BROWSE_ISSUE      = (issueKey: string) => `/browse/${issueKey}`;
const JIRA_API_CREATE_ISSUE  = "/rest/api/3/issue";

function jiraHeaders(): Record<string, string> {
  const { jiraEmail, jiraApiToken } = getPrefs();
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function jiraBaseUrl(): string {
  const { jiraDomain } = getPrefs();
  const domain = jiraDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}`;
}

async function jiraFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${jiraBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...jiraHeaders(), ...(options?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Jira API error (${res.status}): ${body}`);
    throw new Error(`Jira API error (${res.status}): ${body}`);
  }
  return (body ? JSON.parse(body) : null) as T;
}

/**
 * Return the browser URL for a Jira issue.
 */
export function getIssueUrl(issueKey: string): string {
  return `${jiraBaseUrl()}${JIRA_BROWSE_ISSUE(issueKey)}`;
}

/**
 * Get the active sprint for the configured board (cached with TTL).
 */
export async function getActiveSprint(): Promise<JiraSprint | null> {
  const cached = getCached<JiraSprint | null>(CACHE_KEYS.activeSprint);
  if (cached !== undefined) return cached;

  const { jiraBoardId } = getPrefs();
  const data = await jiraFetch<JiraResponse<JiraSprint>>(JIRA_API_BOARD_SPRINT(jiraBoardId));
  const sprints = data.values || [];
  const result = sprints.length > 0 ? sprints[0] : null;
  setCached(CACHE_KEYS.activeSprint, result);
  return result;
}

/**
 * Get all issues in the active sprint assigned to the current user (cached with TTL).
 */
export async function getMySprintIssues(sprintId: number): Promise<JiraIssue[]> {
  const cacheKey = CACHE_KEYS.sprintIssues(sprintId);
  const cached = getCached<JiraIssue[]>(cacheKey);
  if (cached !== undefined) return cached;

  const { jiraAccountId } = getPrefs();
  const jql = encodeURIComponent(`sprint = ${sprintId} AND assignee = "${jiraAccountId}" ORDER BY status ASC, updated DESC`);
  const data = await jiraFetch<JiraResponse<JiraIssue>>(JIRA_API_SPRINT_ISSUES(sprintId, jql));
  const result = data.issues || [];
  setCached(cacheKey, result);
  return result;
}

/**
 * Invalidate all Jira caches and force fresh data on next fetch.
 */
export { invalidateJiraCache } from "./cache";

/**
 * Create a new Jira issue and optionally add it to a sprint.
 */
export async function createIssue(params: CreateIssueParams): Promise<JiraIssue> {
  const fields: Record<string, unknown> = {
    project: { key: params.projectKey },
    summary: params.summary,
    issuetype: { name: params.issueType },
    assignee: { accountId: getPrefs().jiraAccountId },
  };

  if (params.epicKey) {
    // Jira Cloud uses "parent" for linking to epics in next-gen, or customfield for classic
    fields.parent = { key: params.epicKey };
  }

  if (params.storyPoints !== undefined) {
    fields["customfield_10037"] = params.storyPoints;
  }

  if (params.sprintId !== undefined) {
    fields["customfield_10020"] = params.sprintId;
  }

  const created = await jiraFetch<JiraIssue>(JIRA_API_CREATE_ISSUE, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  // Also move via agile API for board visibility
  if (params.sprintId) {
    await jiraFetch(JIRA_API_SPRINT_ISSUE(params.sprintId), {
      method: "POST",
      body: JSON.stringify({ issues: [created.key] }),
    });
  }

  return created;
}
