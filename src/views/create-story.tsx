import { Action, ActionPanel, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import { loadTemplates, StoryTemplate, getTemplatesDir } from "../lib/templates";
import { createIssue } from "../lib/jira";

interface CreateStoryFormProps {
  sprintId: number;
  onCreated: () => void;
}

export function CreateStoryForm({ sprintId, onCreated }: CreateStoryFormProps) {
  const [templates, setTemplates] = useState<StoryTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [storyPoints, setStoryPoints] = useState("0");
  const { pop } = useNavigation();

  useEffect(() => {
    const loaded = loadTemplates();
    setTemplates(loaded);
    if (loaded.length > 0) {
      setSelectedTemplate(loaded[0]);
      setStoryPoints(String(loaded[0].defaultStoryPoints ?? 0));
    }
  }, []);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId) ?? null;
    setSelectedTemplate(template);
    if (template) {
      setStoryPoints(String(template.defaultStoryPoints ?? 0));
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      showToast({ style: Toast.Style.Failure, title: "Please select a template" });
      return;
    }

    if (!title.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Please enter a title" });
      return;
    }

    const fullTitle = selectedTemplate.titlePrefix ? `${selectedTemplate.titlePrefix} ${title.trim()}` : title.trim();

    try {
      showToast({ style: Toast.Style.Animated, title: "Creating story…" });

      const issue = await createIssue({
        projectKey: selectedTemplate.projectKey,
        summary: fullTitle,
        issueType: selectedTemplate.issueType || "Story",
        epicKey: selectedTemplate.epicKey,
        storyPoints: parseInt(storyPoints) || undefined,
        sprintId,
      });

      showToast({
        style: Toast.Style.Success,
        title: `Created ${issue.key}`,
        message: fullTitle,
      });

      onCreated();
      pop();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to create story",
        message: String(error),
      });
      console.error("Error creating issue:", error);
    }
  };

  return (
    <Form
      navigationTitle="Create Story from Template"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Story" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      {templates.length === 0 ? (
        <Form.Description title="No Templates Found" text={`Add JSON template files to: ${getTemplatesDir()}`} />
      ) : (
        <>
          <Form.TextField
            id="title"
            title="Story Title"
            placeholder="Enter the story title"
            value={title}
            onChange={setTitle}
          />

          <Form.TextField
            id="storyPoints"
            title="Story Points"
            placeholder="0"
            value={storyPoints}
            onChange={setStoryPoints}
          />

          <Form.Dropdown
            id="template"
            title="Template"
            value={selectedTemplate?.id ?? ""}
            onChange={handleTemplateChange}
          >
            {templates.map((t) => (
              <Form.Dropdown.Item key={t.id} value={t.id} title={t.name} />
            ))}
          </Form.Dropdown>

          {selectedTemplate && (
            <>
              <Form.Description title="Epic" text={selectedTemplate.epicKey ?? "n/a"} />
              <Form.Description title="Prefix" text={selectedTemplate.titlePrefix ?? "n/a"} />
            </>
          )}
        </>
      )}
    </Form>
  );
}
