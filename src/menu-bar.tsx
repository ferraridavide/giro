import { Icon, MenuBarExtra } from "@raycast/api";
import { useEffect, useState } from "react";
import { getActiveTimer, TimerState, formatElapsed } from "./lib/timer";

export default function MenuBarTimer() {
  const [timer, setTimer] = useState<TimerState | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    getActiveTimer().then(setTimer);
  }, []);

  // Tick every 5 seconds so elapsed time stays reasonably current
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      // Also re-read the timer in case it was started/stopped from the main command
      getActiveTimer().then(setTimer);
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Still loading
  if (timer === undefined) {
    return <MenuBarExtra icon={Icon.Clock} isLoading={true} />;
  }

  // No active timer — render nothing so the item disappears from the menu bar
  if (timer === null) {
    return null;
  }

  const elapsed = formatElapsed(now - timer.startedAt);
  const displayTitle = timer.issueSummary.replace(/^(\[.*?\]\s*)+/, "");
  const title = displayTitle;
  const tooltip = timer.issueSummary;

  return (
    <MenuBarExtra icon={Icon.Clock} title={title} tooltip={tooltip} isLoading={false}>
      <MenuBarExtra.Section>
        <MenuBarExtra.Item title={timer.issueSummary} />
        <MenuBarExtra.Item title={`Started: ${elapsed} ago`} /> 
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
