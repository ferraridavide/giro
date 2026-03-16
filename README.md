<p align="center">
	<img src="assets/extension_icon.png" alt="Giro icon" width="96" height="96" />
</p>

<h1 align="center">Giro</h1>

<p align="center">Track time on Jira issues through Tempo, and create Jira stories from reusable templates.</p>

## What Giro Does

- Shows your issues in the active Jira sprint (for your configured board).
- Starts and stops timers from Raycast.
- Logs rounded time slots to Tempo.
- Creates Jira stories from local JSON templates.
- Shows the currently active timer in the menu bar command.

## Prerequisites

- Raycast installed.
- Jira Cloud account.
- Tempo Timesheets installed in your Jira site.
- Access to:
	- Jira board you want to track.
	- Jira project(s) where you want to create stories.

## 1. Install and Open Preferences

After installing the extension, open Raycast:

1. Search for `Giro`.
2. Open command actions and choose `Configure Extension`.
3. Fill all required preferences.

Required preferences:

- `Jira Domain`: your site, for example `your-company.atlassian.net`.
- `Jira Email`: your Atlassian account email.
- `Jira API Token`: token generated from Atlassian account security page.
- `Jira Account ID`: your Jira account ID (not your email).
- `Jira Board ID`: numeric board ID used to fetch the active sprint.
- `Tempo API Token`: token generated from Tempo settings.

## 2. Generate Jira API Token

1. Go to Atlassian API tokens page: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click `Create API token`.
3. Give it a name (for example `Giro Raycast`).
4. Copy the token and paste it into `Jira API Token` preference.

Notes:

- Giro authenticates Jira API calls with Basic Auth using `jiraEmail:jiraApiToken`.
- Keep this token private.

## 3. Find Jira Account ID

You need your Atlassian account ID for:

- Filtering assigned sprint issues.
- Setting the assignee when creating issues.
- Logging time to Tempo as the author.

Ways to find it:

1. Open Jira and click your avatar -> `Profile`.
2. In many Jira Cloud pages, your account ID appears in profile-related URLs or API responses.
3. If needed, use the Jira REST API `GET /rest/api/3/myself` and copy `accountId`.

Set this value in `Jira Account ID`.

## 4. Find Jira Board ID

Open the board in Jira and look at the URL. Common patterns include:

- `.../jira/software/c/projects/KEY/boards/123`
- `.../secure/RapidBoard.jspa?rapidView=123`

Use `123` as `Jira Board ID`.

## 5. Generate Tempo API Token

1. In Jira, open Tempo settings for your user.
2. Go to API integration / API tokens section.
3. Create a new token.
4. Copy it into `Tempo API Token` preference.

Giro uses this token as a Bearer token against Tempo API v4 (`https://api.tempo.io/4`).

## 6. Create Template Files in ~/.giro

Giro loads story templates from:

- `~/.giro/templates/*.json`

If the folder does not exist, Giro creates `~/.giro/templates` automatically when needed.

### Recommended folder structure

```text
~/.giro/
	templates/
		backend.json
		frontend.json
		bugfix.json
```

### Template JSON structure

Each JSON file represents one template.
The template ID is the filename without `.json`.

Required fields:

- `name` (string): label shown in Raycast.
- `titlePrefix` (string): prefix added to the story title.
- `projectKey` (string): Jira project key.
- `issueType` (string): Jira issue type name (for example `Story`, `Task`).

Optional fields:

- `epicKey` (string): Jira epic key to link as parent.
- `defaultStoryPoints` (number): prefilled story points.

Example:

```json
{
	"name": "Frontend Story",
	"titlePrefix": "[FE]",
	"projectKey": "APP",
	"issueType": "Story",
	"epicKey": "APP-120",
	"defaultStoryPoints": 3
}
```

Another example:

```json
{
	"name": "Backend Improvement",
	"titlePrefix": "[BE]",
	"projectKey": "PLAT",
	"issueType": "Task",
	"defaultStoryPoints": 5
}
```

## 7. Use Giro

1. Run the `Giro` command in Raycast.
2. Start timer on an issue.
3. Stop timer to log time to Tempo.
4. Use `Create New Story from Template` to create issues in the active sprint.
5. Optionally enable the menu bar command to see active timer context.

## Troubleshooting

- `Jira API error (401/403)`:
	- Verify `Jira Email`, `Jira API Token`, and `Jira Domain`.
- No sprint or issues shown:
	- Verify `Jira Board ID` and ensure there is an active sprint.
	- Ensure your `Jira Account ID` is correct.
- `Tempo API error` when stopping timer:
	- Verify `Tempo API Token` and Tempo access permissions.
- Story points not applied:
	- This project currently sends story points to Jira custom field `customfield_10037`.
	- If your Jira instance uses a different custom field ID, update the field mapping in the source.

## Security Notes

- API tokens are sensitive credentials.
- Use Raycast password preferences for token fields.
- Rotate tokens periodically based on your organization policy.