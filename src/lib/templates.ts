import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const TEMPLATES_DIR = join(homedir(), ".giro", "templates");

export interface StoryTemplate {
  /** File name (without extension), used as template ID */
  id: string;
  /** Display name for the template */
  name: string;
  /** Prefix added to the story title (e.g. "[FE]") */
  titlePrefix: string;
  /** The Jira project key (e.g. "PROJ") */
  projectKey: string;
  /** Issue type to create (default: "Story") */
  issueType: string;
  /** Epic key to link the story to (e.g. "PROJ-100") */
  epicKey?: string;
  /** Default story points */
  defaultStoryPoints?: number;
}

/**
 * Ensures the templates directory exists.
 */
export function ensureTemplatesDir(): void {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

/**
 * Load all story templates from ~/.giro/templates/
 */
export function loadTemplates(): StoryTemplate[] {
  ensureTemplatesDir();
  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json"));
  const templates: StoryTemplate[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(TEMPLATES_DIR, file), "utf-8");
      const data = JSON.parse(raw) as Omit<StoryTemplate, "id">;
      templates.push({
        id: file.replace(/\.json$/, ""),
        ...data,
      });
    } catch {
      // skip invalid files
    }
  }

  return templates;
}

/**
 * Get the templates directory path (for display to user).
 */
export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}
