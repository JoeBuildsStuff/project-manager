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
}

export type StatusFilter = "all" | "active" | "inbox" | "archived";
export type CategoryFilter = "all" | "project" | "reference" | "tooling";
export type DeployFilter = string;
export type HostFilter = string;

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
