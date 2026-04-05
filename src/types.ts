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
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export type ClaudeTaskRunStatus =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ClaudeRunStartedPayload {
  run_id: string;
  task_id: number;
  model: string | null;
  cwd: string;
  pid: number;
  started_at: number;
}

export interface ClaudeRunEventPayload {
  run_id: string;
  seq: number;
  ts: number;
  kind: string;
  text: string | null;
  raw_type: string | null;
  raw_subtype: string | null;
  data?: unknown;
}

export interface ClaudeRunCompletedPayload {
  run_id: string;
  task_id: number;
  exit_code: number | null;
  status: Exclude<ClaudeTaskRunStatus, "idle" | "starting" | "running">;
  finished_at: number;
  final_text: string | null;
  usage?: unknown;
  total_cost_usd?: number | null;
  model_usage?: unknown;
}

export interface ClaudeRunErrorPayload {
  run_id: string | null;
  task_id: number | null;
  stage: "preflight" | "spawn" | "stream" | "cancel" | string;
  message: string;
}

export interface ClaudeTaskRunSnapshot {
  run_id: string;
  task_id: number;
  model: string | null;
  status: Exclude<ClaudeTaskRunStatus, "idle">;
  pid: number | null;
  cwd: string;
  started_at: number;
  finished_at: number | null;
  exit_code: number | null;
}

export interface ClaudeSessionRow {
  run_id: string;
  task_id: number;
  model: string | null;
  status: string;
  started_at: number;
  finished_at: number | null;
  exit_code: number | null;
  final_text: string | null;
  usage_json: string | null;
}

export interface ClaudeEventRow {
  id: number;
  run_id: string;
  seq: number;
  ts: number;
  kind: string;
  raw_type: string | null;
  raw_subtype: string | null;
  text: string | null;
  raw_json: string | null;
}

export interface ClaudeResultRow {
  run_id: string;
  result_text: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  cost_usd: number | null;
  duration_ms: number | null;
  num_turns: number | null;
  stop_reason: string | null;
  total_cost_usd: number | null;
  model_usage_json: string | null;
  duration_api_ms: number | null;
  terminal_reason: string | null;
}

export interface ClaudeRunModelUsageRow {
  model_name: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  web_search_requests: number | null;
  cost_usd: number | null;
  context_window: number | null;
  max_output_tokens: number | null;
}

export interface TaskClaudeCostRow {
  task_id: number;
  total_cost_usd: number;
  run_count: number;
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
