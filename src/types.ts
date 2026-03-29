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
}

export type StatusFilter = "all" | "active" | "inbox" | "archived";
export type CategoryFilter = "all" | "project" | "reference" | "tooling";
export type DeployFilter = string;
export type HostFilter = string;
export type StageFilter = string;

export interface Task {
  id: number;
  folder_key: string;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
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
  sorting: string;   // JSON-serialized SortingState
  filters: string;   // JSON-serialized ColumnFiltersState
  visibility: string; // JSON-serialized VisibilityState
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
