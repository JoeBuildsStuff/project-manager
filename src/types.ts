export interface Project {
  folder_key: string;
  folder_name: string;
  description: string | null;
  status: string | null;
  category: string | null;
  repo: string | null;
  host: string | null;
  repo_owner: string | null;
  commit_count: number | null;
  last_commit_date: string | null;
  lines_added: number | null;
  lines_removed: number | null;
  days_since_last_commit: number | null;
  deployment: string | null;
  production_url: string | null;
  deploy_platform: string | null;
  vercel_team_slug: string | null;
  vercel_project_name: string | null;
  stage: string | null;
  actions_status: string | null;
  actions_run_url: string | null;
}

export type StatusFilter = "all" | "active" | "inbox" | "archived";
export type CategoryFilter = "all" | "project" | "reference" | "tooling";
export type DeployFilter = string;
export type HostFilter = string;
export type StageFilter = string;

export interface Task {
  id: number;
  folder_key: string;
  /** Project display name when returned from list/detail queries */
  folder_name?: string | null;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assignee_kind: "llm_agent" | null;
  assignee_id: number | null;
  assignee_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export interface LlmAgent {
  id: number;
  name: string;
  provider: string | null;
  model: string | null;
  reasoning: string | null;
  permission_mode: string | null;
  system_prompt: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TaskAssignmentOptions {
  llm_agents: LlmAgent[];
}

export interface TaskCount {
  folder_key: string;
  open_count: number;
  total_count: number;
}

export type TaskStatusFilter = "all" | "open" | "in-progress" | "done" | "closed";
export type TaskKindFilter = "all" | "task" | "issue" | "request" | "next-step";
export type TaskPriorityFilter = "all" | "urgent" | "high" | "medium" | "low";

export interface SavedView {
  id: string;
  name: string;
  context: string;   // "projects" | "tasks"
  sorting: string;   // JSON-serialized SortingState
  filters: string;   // JSON-serialized ColumnFiltersState
  visibility: string; // JSON-serialized VisibilityState
}

export interface NotesDocumentSummary {
  id: string;
  title: string;
  icon_name: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotesDocument extends NotesDocumentSummary {
  content: string;
}

export interface DeleteGuardrails {
  folder_key: string;
  folder_name: string;
  status: string | null;
  category: string | null;
  exists_on_disk: boolean;
  has_git_repo: boolean;
  has_remote_repo: boolean;
  remote_url: string | null;
  git_dirty: boolean;
  git_status_output: string | null;
  production_url: string | null;
  deploy_platform: string | null;
  nested_tracked_rows: number;
  commit_count: number | null;
  last_commit_date: string | null;
}
