import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  jiraDomain: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraAccountId: string;
  jiraBoardId: string;
  tempoApiToken: string;
}

export function getPrefs(): Preferences {
  return getPreferenceValues<Preferences>();
}
