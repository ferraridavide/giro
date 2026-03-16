import {
  Action,
  ActionPanel,
  Color,
  Icon,
  launchCommand,
  LaunchType,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState, useCallback } from "react";
import {
  getActiveSprint,
  getMySprintIssues,
  getIssueUrl,
  invalidateJiraCache,
  JiraIssue,
  JiraSprint,
} from "./lib/jira";
import { logTime, getAccountsForProject, TempoAccount } from "./lib/tempo";
import { getActiveTimer, startTimer, stopTimer, TimerState, formatElapsed } from "./lib/timer";
import { roundTimeSlot } from "./lib/time-utils";
import { CreateStoryForm } from "./views/create-story";

export default function TrackCommand() {
  const [sprint, setSprint] = useState<JiraSprint | null>(null);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [activeTimer, setActiveTimer] = useState<TimerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { push } = useNavigation();

  const loadData = useCallback(async (bustCache = false) => {
    try {
      setIsLoading(true);
      if (bustCache) {
        invalidateJiraCache();
      }
      const activeSprint = await getActiveSprint();
      setSprint(activeSprint);

      if (activeSprint) {
        const sprintIssues = await getMySprintIssues(activeSprint.id);
        setIssues(sprintIssues);
      }

      const timer = await getActiveTimer();
      setActiveTimer(timer);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load data",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReload = useCallback(async () => {
    showToast({ style: Toast.Style.Animated, title: "Refreshing…" });
    await loadData(true);
    showToast({ style: Toast.Style.Success, title: "Data refreshed" });
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tick every second to update elapsed time display
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const doStartTimer = useCallback(async (issue: JiraIssue, accountKey?: string) => {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Starting timer…" });
    const prev = await startTimer(issue.id, issue.key, issue.fields.summary, issue.fields.project?.id, accountKey);
    if (prev) {
      toast.message = "Logging previous timer…";
      await logPreviousTimer(prev, toast);
    }
    setActiveTimer({
      issueId: issue.id,
      issueKey: issue.key,
      issueSummary: issue.fields.summary,
      startedAt: Date.now(),
      jiraProjectId: issue.fields.project?.id,
      accountKey,
    });
    toast.style = Toast.Style.Success;
    toast.title = `Timer started on ${issue.key}`;
    toast.message = issue.fields.summary;
    launchCommand({ name: "menu-bar", type: LaunchType.Background }).catch(() => void 0);
  }, []);

  const handleStartTimer = useCallback(
    async (issue: JiraIssue) => {
      const projectId = issue.fields.project?.id;
      if (!projectId) {
        await doStartTimer(issue);
        return;
      }
      try {
        const accounts = await getAccountsForProject(projectId);
        if (accounts.length === 0) {
          await doStartTimer(issue);
        } else if (accounts.length === 1) {
          await doStartTimer(issue, accounts[0].key);
        } else {
          push(
            <AccountPickerList
              accounts={accounts}
              title={`Account for ${issue.key}`}
              onPick={(key) => doStartTimer(issue, key)}
            />,
          );
        }
      } catch {
        await doStartTimer(issue);
      }
    },
    [doStartTimer, push],
  );

  const doStopTimer = useCallback(async (accountKey?: string) => {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Stopping timer…",
      message: "Logging time to Tempo",
    });

    const stopped = await stopTimer();
    if (!stopped) {
      toast.style = Toast.Style.Failure;
      toast.title = "No active timer found";
      toast.message = undefined;
      return;
    }

    const logged = await logPreviousTimer({ ...stopped, accountKey: accountKey ?? stopped.accountKey }, toast);
    setActiveTimer(null);
    launchCommand({ name: "menu-bar", type: LaunchType.Background }).catch(() => void 0);

    if (!logged) {
      return;
    }
  }, []);

  const handleStopTimer = useCallback(async () => {
    const current = activeTimer;
    if (!current) return;
    if (current.jiraProjectId) {
      try {
        const accounts = await getAccountsForProject(current.jiraProjectId);
        if (accounts.length > 1 && !current.accountKey) {
          push(
            <AccountPickerList
              accounts={accounts}
              title={`Account for ${current.issueKey}`}
              onPick={(key) => doStopTimer(key)}
            />,
          );
          return;
        }
      } catch {
        /* fall through */
      }
    }
    await doStopTimer();
  }, [activeTimer, doStopTimer, push]);

  const handleDiscardTimer = useCallback(async () => {
    const stopped = await stopTimer();
    if (stopped) {
      setActiveTimer(null);
      showToast({
        style: Toast.Style.Success,
        title: "Timer discarded",
        message: `No time logged for ${stopped.issueKey}`,
      });
      launchCommand({ name: "menu-bar", type: LaunchType.Background }).catch(() => void 0);
    }
  }, []);

  const handleCreateStory = useCallback(() => {
    if (!sprint) {
      showToast({ style: Toast.Style.Failure, title: "No active sprint found" });
      return;
    }
    push(
      <CreateStoryForm
        sprintId={sprint.id}
        onCreated={() => {
          loadData();
        }}
      />,
    );
  }, [sprint, push, loadData]);

  return (
    <List isLoading={isLoading} navigationTitle="Giro — Track Time" searchBarPlaceholder="Search stories…">
      <List.Section title={sprint ? `Sprint: ${sprint.name}` : "Current Sprint"}>
        <List.Item
          key="create-story"
          icon={{ source: Icon.Plus, tintColor: Color.Blue }}
          title="Create New Story from Template"
          actions={
            <ActionPanel>
              <Action title="Create Story" icon={Icon.Plus} onAction={handleCreateStory} />
              <Action
                title="Reload Data"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={handleReload}
              />
            </ActionPanel>
          }
        />

        {[...issues]
          .sort((a, b) => {
            if (activeTimer?.issueKey === a.key) return -1;
            if (activeTimer?.issueKey === b.key) return 1;
            return 0;
          })
          .map((issue) => {
            const isTracking = activeTimer?.issueKey === issue.key;
            return (
              <List.Item
                key={issue.key}
                icon={
                  isTracking
                    ? { source: Icon.Clock, tintColor: Color.Green }
                    : { source: Icon.Dot, tintColor: statusColor(issue.fields.status.name) }
                }
                title={`${issue.fields.summary}`}
                subtitle={issue.fields.status.name}
                accessories={[
                  ...(isTracking ? [{ text: `${formatElapsed(now - activeTimer!.startedAt)}`, icon: Icon.Clock }] : []),
                  { tag: issue.fields.issuetype.name },
                ]}
                actions={
                  <ActionPanel>
                    {isTracking ? (
                      <>
                        <Action title="Stop Timer & Log Time" icon={Icon.Stop} onAction={handleStopTimer} />
                        <Action
                          title="Stop Timer (Discard)"
                          icon={Icon.Trash}
                          style={Action.Style.Destructive}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                          onAction={handleDiscardTimer}
                        />
                      </>
                    ) : (
                      <Action title="Start Timer" icon={Icon.Play} onAction={() => handleStartTimer(issue)} />
                    )}
                    <Action.OpenInBrowser
                      title="Open in Browser"
                      url={getIssueUrl(issue.key)}
                      shortcut={{ modifiers: ["cmd"], key: "o" }}
                    />
                    <Action
                      title="Create New Story"
                      icon={Icon.Plus}
                      shortcut={{ modifiers: ["cmd"], key: "n" }}
                      onAction={handleCreateStory}
                    />
                    <Action
                      title="Reload Data"
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={handleReload}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
      </List.Section>
    </List>
  );
}

/**
 * Log a previously running timer to Tempo with rounded time slots.
 */
async function logPreviousTimer(timer: TimerState, toast?: Toast): Promise<boolean> {
  try {
    const endMs = Date.now();
    const { startDate, startTime, durationSeconds } = roundTimeSlot(timer.startedAt, endMs);

    await logTime({
      issueId: timer.issueId,
      issueKey: timer.issueKey,
      startDate,
      startTime,
      timeSpentSeconds: durationSeconds,
      description: `Tracked via Giro: ${timer.issueSummary}`,
      accountKey: timer.accountKey,
    });

    const hours = Math.round(durationSeconds / 3600);
    if (toast) {
      toast.style = Toast.Style.Success;
      toast.title = `Logged ${hours}h on ${timer.issueKey}`;
      toast.message = `${startDate} ${startTime}`;
    }

    return true;
  } catch (error) {
    if (toast) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to log time to Tempo";
      toast.message = String(error);
    }

    return false;
  }
}

function AccountPickerList({
  accounts,
  title,
  onPick,
}: {
  accounts: TempoAccount[];
  title: string;
  onPick: (accountKey: string) => void;
}) {
  const { pop } = useNavigation();
  return (
    <List navigationTitle={title} searchBarPlaceholder="Search accounts…">
      {accounts.map((acc) => (
        <List.Item
          key={acc.key}
          title={acc.name}
          subtitle={acc.key}
          actions={
            <ActionPanel>
              <Action
                title="Select Account"
                icon={Icon.CheckCircle}
                onAction={() => {
                  onPick(acc.key);
                  pop();
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function statusColor(status: string): Color {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return Color.Green;
  if (s.includes("progress") || s.includes("review")) return Color.Blue;
  if (s.includes("block")) return Color.Red;
  return Color.SecondaryText;
}
