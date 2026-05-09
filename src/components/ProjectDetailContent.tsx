import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  ExternalLink,
  GitBranch,
  GitCommit,
  CheckCircle2,
  CircleSlash,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  AlertCircle,
  Play,
  Square,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CategoryBadge, HostBadge, StatusBadge, StageBadge, DeployBadge } from "./StatusBadge";
import DeleteProjectDialog from "./DeleteProjectDialog";
import type { Project } from "../types";
import ProjectActivityHeatmap, { normalizeGitActivity, type GitActivity } from "./ProjectActivityHeatmap";
import { cn } from "@/lib/utils";

interface GitStatus {
  folder_key: string;
  output: string;
  is_dirty: boolean;
}

const STATUS_OPTIONS = ["active", "inbox", "archived"];
const CATEGORY_OPTIONS = ["project", "reference", "tooling"];
const STAGE_OPTIONS = [
  "idea", "mvp", "pmf", "growth", "scale", "platform",
  "expand", "plateau", "erode", "dead", "reborn",
];
const DEPLOY_OPTIONS = ["vercel", "hetzner", "homelab", "local"];
const HOST_OPTIONS = ["github", "gitlab", "bitbucket", "gitea"];

export interface ProjectDetailContentProps {
  project: Project;
  isOpen: boolean;
  onFieldChange: (folder_key: string, field: string, value: string | null) => Promise<void>;
  onRename: (folder_key: string, nextName: string) => Promise<void>;
  onDelete: (folder_key: string) => Promise<void>;
  /** Optional extra action slot rendered in the quick-actions row */
  extraActions?: React.ReactNode;
  /** Two-column layout mode for full-page view */
  layout?: "sheet" | "page";
}

export function ProjectDetailContent({
  project: p,
  isOpen,
  onFieldChange,
  onRename,
  onDelete,
  extraActions,
  layout = "sheet",
}: ProjectDetailContentProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitActivity, setGitActivity] = useState<GitActivity | null>(null);
  const [gitActivityLoading, setGitActivityLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextName, setNextName] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setGitStatus(null);
    setGitLoading(true);
    invoke<GitStatus>("get_git_status", { folderKey: p.folder_key })
      .then(setGitStatus)
      .catch(() => setGitStatus(null))
      .finally(() => setGitLoading(false));
  }, [p.folder_key, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setGitActivity(null);
    setGitActivityLoading(true);
    invoke<GitActivity>("get_git_activity", { folderKey: p.folder_key })
      .then((result) => setGitActivity(normalizeGitActivity(result)))
      .catch(() => setGitActivity(null))
      .finally(() => setGitActivityLoading(false));
  }, [p.folder_key, isOpen]);

  const openWith = (cmd: string, arg: string) =>
    invoke(cmd, cmd === "open_url" ? { url: arg } : { folderKey: arg });

  const openRenameDialog = () => {
    setActionError("");
    setNextName(p.folder_name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === p.folder_name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    setActionError("");
    try {
      await onRename(p.folder_key, trimmed);
      setRenameOpen(false);
    } catch (error) {
      setActionError(String(error));
    } finally {
      setRenaming(false);
    }
  };

  const handleField = (field: string, value: string | null) =>
    onFieldChange(p.folder_key, field, value);

  const handleProductionUrl = async (value: string | null) => {
    await handleField("production_url", value);
    if (p.host === "github" && p.repo_owner) {
      try {
        await invoke("update_github_repo_url", { ownerRepo: p.repo_owner, homepage: value });
      } catch (e) {
        setActionError(String(e));
      }
    }
  };

  const quickActions = (
    <div className="flex flex-wrap gap-1.5">
      <OpenEditorButtonGroup
        onOpenCursor={() => openWith("open_in_cursor", p.folder_key)}
        onOpenFinder={() => openWith("open_in_finder", p.folder_key)}
        onOpenWarp={() => openWith("open_in_warp", p.folder_key)}
        onOpenTerminal={() => openWith("open_in_terminal", p.folder_key)}
        onLaunchClaude={() => invoke("launch_claude_desktop")}
        onLaunchCodex={() => invoke("launch_codex_desktop")}
      />
      <DevServerButton
        project={p}
        onFieldSave={(field, value) => onFieldChange(p.folder_key, field, value)}
        onError={(msg) => setActionError(msg)}
      />
      {p.production_url && (
        <ActionButton icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openWith("open_url", p.production_url as string)}>
          Live site
        </ActionButton>
      )}
      {p.repo?.startsWith("http") && (
        <ActionButton icon={<GitBranch className="h-3.5 w-3.5" />} onClick={() => openWith("open_url", p.repo as string)}>
          Repo
        </ActionButton>
      )}
      <ActionButton icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { setActionError(""); setDeleteOpen(true); }} disabled={renaming} variant="destructive">
        Delete
      </ActionButton>
      {extraActions}
    </div>
  );

  const detailFields = (
    <dl className="space-y-1.5">
      <EditableField label="Status" value={p.status} options={STATUS_OPTIONS} onSelect={(v) => handleField("status", v)} renderBadge={(v) => <StatusBadge status={v} />} />
      <EditableField label="Category" value={p.category} options={CATEGORY_OPTIONS} onSelect={(v) => handleField("category", v)} renderBadge={(v) => <CategoryBadge category={v} />} />
      <EditableField label="Stage" value={p.stage} options={STAGE_OPTIONS} onSelect={(v) => handleField("stage", v)} renderBadge={(v) => <StageBadge stage={v} />} clearable />
      <EditableField label="Host" value={p.host} options={HOST_OPTIONS} onSelect={(v) => handleField("host", v)} renderBadge={(v) => <HostBadge host={v} />} clearable />
      <EditableField label="Deploy" value={p.deploy_platform} options={DEPLOY_OPTIONS} onSelect={(v) => handleField("deploy_platform", v)} renderBadge={(v) => <DeployBadge platform={v} />} clearable />
      <EditableTextField label="Prod URL" value={p.production_url} placeholder="https://example.com" onSave={handleProductionUrl} />
      <Field label="Owner" value={p.repo_owner} />
      <RepoField project={p} />
      <GitStatusField
        gitLoading={gitLoading}
        gitStatus={gitStatus}
        onOpenRepo={p.repo?.startsWith("http") ? () => openWith("open_url", p.repo as string) : undefined}
      />
      {p.vercel_project_name && <Field label="Vercel" value={p.vercel_project_name} />}
      <Field label="Commits" value={p.commit_count?.toString()} />
      <Field label="Last commit" value={p.last_commit_date?.split("T")[0]} />
      {p.days_since_last_commit != null && <Field label="Days ago" value={p.days_since_last_commit.toString()} />}
      {p.deployment && <Field label="Notes" value={p.deployment} />}
    </dl>
  );

  const dialogs = (
    <>
      <RenameFolderDialog
        folderKey={p.folder_key}
        folderName={p.folder_name}
        nextName={nextName}
        renaming={renaming}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onNextNameChange={setNextName}
        onConfirm={handleRename}
      />
      <DeleteProjectDialog
        project={p}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
      />
    </>
  );

  if (layout === "page") {
    return (
      <>
        <FolderNameHeader folderName={p.folder_name} folderKey={p.folder_key} onRename={openRenameDialog} />

        {p.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground mb-6">{p.description}</p>
        )}

        <div>
          <SectionLabel>Quick actions</SectionLabel>
          {quickActions}
        </div>

        {actionError && <p className="text-xs text-destructive mt-3">{actionError}</p>}

        <div className="mt-4">
          <SectionLabel>Details</SectionLabel>
          {detailFields}
        </div>

        <div className="mt-6">
          <SectionLabel>Activity</SectionLabel>
          <ProjectActivityHeatmap activity={gitActivity} loading={gitActivityLoading} />
        </div>

        {dialogs}
      </>
    );
  }

  // Sheet layout (original single-column)
  return (
    <div className="space-y-5 px-5 pb-6">
      <div>
        <FolderNameHeader folderName={p.folder_name} folderKey={p.folder_key} onRename={openRenameDialog} compact />
        {p.description && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
        )}
      </div>

      <div>
        <SectionLabel>Quick actions</SectionLabel>
        {quickActions}
      </div>

      {actionError && <p className="text-xs text-destructive">{actionError}</p>}

      <div>
        <SectionLabel>Details</SectionLabel>
        {detailFields}
      </div>

      <div>
        <SectionLabel>Activity</SectionLabel>
        <ProjectActivityHeatmap activity={gitActivity} loading={gitActivityLoading} />
      </div>

      {dialogs}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable picklist field
// ---------------------------------------------------------------------------

function EditableField({
  label,
  value,
  options,
  onSelect,
  renderBadge,
  clearable,
}: {
  label: string;
  value: string | null;
  options: string[];
  onSelect: (value: string | null) => void;
  renderBadge?: (value: string) => React.ReactNode;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (v: string | null) => {
    onSelect(v);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      <dd className="min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted">
            {value && renderBadge ? (
              renderBadge(value)
            ) : value ? (
              <Badge variant="gray" className="text-[11px] font-medium">{value}</Badge>
            ) : (
              <span className="text-muted-foreground/40 italic">none</span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <div className="flex flex-col">
              {clearable && value && (
                <button
                  className="rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => handleSelect(null)}
                >
                  Clear
                </button>
              )}
              {options.map((opt) => (
                <button
                  key={opt}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${opt === value ? "bg-muted font-medium" : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {renderBadge ? renderBadge(opt) : opt}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline editable text field
// ---------------------------------------------------------------------------

function EditableTextField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    onSave(trimmed === "" ? null : trimmed);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
        <dd className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            onBlur={commit}
            placeholder={placeholder}
            className="h-6 flex-1 px-1.5 text-xs"
            autoFocus
          />
        </dd>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      <dd className="min-w-0">
        <button
          onClick={startEdit}
          className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-muted"
        >
          {value ? (
            <span className="max-w-[160px] truncate text-blue-400">{value}</span>
          ) : (
            <span className="text-muted-foreground/40 italic">none</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/40" />
        </button>
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rename dialog
// ---------------------------------------------------------------------------

function RenameFolderDialog({
  folderKey,
  folderName,
  nextName,
  renaming,
  open,
  onOpenChange,
  onNextNameChange,
  onConfirm,
}: {
  folderKey: string;
  folderName: string;
  nextName: string;
  renaming: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNextNameChange: (value: string) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
          <DialogDescription className="text-xs">
            Rename the folder on disk and update its database key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={nextName}
            onChange={(e) => onNextNameChange(e.target.value)}
            placeholder="new-folder-name"
            autoFocus
          />
          <p className="font-mono text-[10px] text-muted-foreground">
            {folderKey} → {nextName.trim() || folderName}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={renaming}>
            {renaming ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Utility components
// ---------------------------------------------------------------------------

function FolderNameHeader({
  folderName,
  folderKey,
  onRename,
  compact,
}: {
  folderName: string;
  folderKey: string;
  onRename: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onDoubleClick={onRename}
      onKeyDown={(event) => {
        if (event.key === "Enter") onRename();
      }}
      className="block max-w-full rounded-sm text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Rename ${folderName}`}
    >
      <h2 className={cn("truncate font-semibold text-foreground", compact ? "text-sm" : "text-xl")}>
        {folderName}
      </h2>
      {!compact && folderKey !== folderName && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{folderKey}</p>
      )}
    </button>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      <dd className="min-w-0 break-all text-muted-foreground">{value}</dd>
    </div>
  );
}

function RepoField({ project }: { project: Project }) {
  if (!project.repo && !project.repo_owner) return null;

  const repoLabel = project.repo_owner ?? formatRepoUrl(project.repo);

  return (
    <div className="flex items-center gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">Repo</dt>
      <dd className="min-w-0">
        <Popover>
          <PopoverTrigger className="flex max-w-[280px] items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted">
            <GitBranch className="h-3 w-3 text-muted-foreground/50" />
            <span className="truncate text-muted-foreground">{repoLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Repository</p>
                <p className="break-all text-[11px] text-muted-foreground">
                  {project.repo_owner ?? "Remote connected"}
                </p>
              </div>
              {project.repo && (
                <div className="rounded-md bg-muted px-2 py-1.5">
                  <p className="break-all font-mono text-[10px] text-muted-foreground">
                    {project.repo}
                  </p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </div>
  );
}

function GitStatusField({
  gitLoading,
  gitStatus,
  onOpenRepo,
}: {
  gitLoading: boolean;
  gitStatus: GitStatus | null;
  onOpenRepo?: () => void;
}) {
  const gitOutput = gitStatus?.output.trim() ?? "";
  const changedFiles = gitOutput ? gitOutput.split("\n").filter(Boolean).length : 0;

  let badge: React.ReactNode;
  let summary = "";

  if (gitLoading) {
    badge = (
      <Badge variant="gray" className="text-[11px] font-medium">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        loading
      </Badge>
    );
    summary = "Checking repo";
  } else if (!gitStatus) {
    badge = (
      <Badge variant="gray" className="text-[11px] font-medium">
        <CircleSlash className="h-2.5 w-2.5" />
        none
      </Badge>
    );
    summary = "Not a git repo";
  } else if (gitStatus.is_dirty) {
    badge = (
      <Badge variant="yellow" className="text-[11px] font-medium">
        <AlertCircle className="h-2.5 w-2.5" />
        dirty
      </Badge>
    );
    summary = changedFiles === 1 ? "1 changed file" : `${changedFiles} changed files`;
  } else {
    badge = (
      <Badge variant="green" className="text-[11px] font-medium">
        <CheckCircle2 className="h-2.5 w-2.5" />
        clean
      </Badge>
    );
    summary = "No local changes";
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">Git</dt>
      <dd className="min-w-0">
        <Popover>
          <PopoverTrigger className="flex max-w-[280px] items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted">
            {badge}
            <span className="truncate text-muted-foreground">{summary}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-xs font-medium text-foreground">Git status</p>
              </div>
              {gitLoading && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading repository status…
                </p>
              )}
              {!gitLoading && gitStatus && gitOutput && (
                <div className="rounded-md bg-muted px-2 py-1.5">
                  <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-yellow-400">
                    {gitOutput}
                  </pre>
                </div>
              )}
              {!gitLoading && gitStatus && !gitOutput && (
                <p className="text-[11px] text-muted-foreground">Working tree is clean.</p>
              )}
              {!gitLoading && !gitStatus && (
                <p className="text-[11px] text-muted-foreground">This project is not backed by a git repository.</p>
              )}
              {onOpenRepo && (
                <div>
                  <ActionButton icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={onOpenRepo}>
                    Open remote
                  </ActionButton>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </dd>
    </div>
  );
}

function formatRepoUrl(repo: string | null) {
  if (!repo) return null;
  return repo
    .replace(/^https?:\/\//, "")
    .replace(/^git@/, "")
    .replace("github.com:", "github.com/")
    .replace(/\.git$/, "");
}

export function ActionButton({
  onClick,
  icon,
  children,
  disabled,
  variant,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "outline" | "destructive";
}) {
  return (
    <Button
      variant={variant ?? "outline"}
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {children}
    </Button>
  );
}

function OpenEditorButtonGroup({
  onOpenCursor,
  onOpenFinder,
  onOpenWarp,
  onOpenTerminal,
  onLaunchClaude,
  onLaunchCodex,
}: {
  onOpenCursor: () => void;
  onOpenFinder: () => void;
  onOpenWarp: () => void;
  onOpenTerminal: () => void;
  onLaunchClaude: () => void;
  onLaunchCodex: () => void;
}) {
  return (
    <DropdownMenu>
      <ButtonGroup>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-l-[min(var(--radius-md),12px)]! rounded-r-none! text-xs"
          onClick={onOpenCursor}
        >
          Cursor
        </Button>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 rounded-l-none! rounded-r-[min(var(--radius-md),12px)]! px-2"
          )}
          aria-label="Choose editor"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
      </ButtonGroup>
      <DropdownMenuContent align="end" className="w-28">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onOpenFinder}>
            Finder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenWarp}>
            Warp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenTerminal}>
            Terminal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLaunchCodex}>
            Codex
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onLaunchClaude}>
            Claude
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DevServerInfo {
  pty_id: string;
  run_id: string;
  command: string;
  package_manager: string | null;
  cwd: string;
}

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"];
const PORT_REGEX = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::(\d{2,5}))?/i;

function DevServerButton({
  project: p,
  onFieldSave,
  onError,
}: {
  project: Project;
  onFieldSave: (field: string, value: string | null) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const folderKey = p.folder_key;
  const ptyId = `dev::${folderKey}`;
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(p.dev_port);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync port when project prop changes
  useEffect(() => setPort(p.dev_port), [p.dev_port]);

  // Discover existing running state on mount
  useEffect(() => {
    let cancelled = false;
    invoke<{ id: string; command: string } | null>("get_dev_server_status", { folderKey })
      .then((run) => {
        if (cancelled || !run) return;
        setRunning(true);
        setCommand(run.command);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [folderKey]);

  // Listen for output (port detection) and exit
  useEffect(() => {
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let detected = false;

    listen<{ id: string; data: string }>(`pty://output/${ptyId}`, (e) => {
      if (detected) return;
      const match = e.payload.data.match(PORT_REGEX);
      if (match && match[1]) {
        const found = parseInt(match[1], 10);
        if (Number.isFinite(found) && found > 0) {
          detected = true;
          setPort(found);
          invoke("set_dev_port", { folderKey, port: found }).catch(() => {});
        }
      }
    }).then((fn) => {
      unlistenOutput = fn;
    });

    listen(`pty://exit/${ptyId}`, () => {
      setRunning(false);
      setCommand(null);
    }).then((fn) => {
      unlistenExit = fn;
    });

    return () => {
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, [ptyId, folderKey]);

  const handleStart = async () => {
    setBusy(true);
    try {
      const result = await invoke<DevServerInfo>("start_dev_server", { folderKey });
      setCommand(result.command);
      setRunning(true);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await invoke("stop_dev_server", { folderKey });
      setRunning(false);
      setCommand(null);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const primary = running ? (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-l-[min(var(--radius-md),12px)]! rounded-r-none! text-xs"
      onClick={handleStop}
      disabled={busy}
      title={command ? `Running: ${command}` : "Dev server running"}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Square className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
      )}
      Stop dev
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-l-[min(var(--radius-md),12px)]! rounded-r-none! text-xs"
      onClick={handleStart}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      Dev
    </Button>
  );

  return (
    <>
      <ButtonGroup>
        {primary}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7 rounded-l-none! rounded-r-[min(var(--radius-md),12px)]! px-2"
            )}
            aria-label="Dev server settings"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 space-y-3">
            <DevServerSettings
              project={p}
              onClose={() => setSettingsOpen(false)}
              onFieldSave={onFieldSave}
              onError={onError}
            />
          </PopoverContent>
        </Popover>
      </ButtonGroup>
      {port != null && (
        <ActionButton
          icon={<ExternalLink className="h-3.5 w-3.5" />}
          onClick={() => invoke("open_url", { url: `http://localhost:${port}` })}
        >
          localhost:{port}
        </ActionButton>
      )}
    </>
  );
}

function DevServerSettings({
  project: p,
  onClose,
  onFieldSave,
  onError,
}: {
  project: Project;
  onClose: () => void;
  onFieldSave: (field: string, value: string | null) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [command, setCommand] = useState(p.dev_command ?? "");
  const [pm, setPm] = useState(p.package_manager ?? "");
  const [portStr, setPortStr] = useState(p.dev_port != null ? String(p.dev_port) : "");
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState<{ pm: string; command: string } | null>(null);

  useEffect(() => {
    invoke<[string, string] | null>("detect_dev_command", { folderKey: p.folder_key })
      .then((res) => {
        if (res) setDetected({ pm: res[0], command: res[1] });
      })
      .catch(() => {});
  }, [p.folder_key]);

  const save = async () => {
    setSaving(true);
    try {
      const cmdValue = command.trim() ? command.trim() : null;
      const pmValue = pm.trim() ? pm.trim() : null;
      const portTrim = portStr.trim();
      const portValue = portTrim === "" ? null : Number(portTrim);
      if (portValue != null && !Number.isFinite(portValue)) {
        throw new Error("Port must be a number");
      }
      await onFieldSave("dev_command", cmdValue);
      await onFieldSave("package_manager", pmValue);
      await invoke("set_dev_port", { folderKey: p.folder_key, port: portValue });
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-foreground">Dev server</p>
        {detected && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Detected: <span className="font-mono">{detected.command}</span>
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Command override</label>
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={detected?.command ?? "pnpm dev"}
          className="h-7 text-xs font-mono"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Package manager</label>
        <select
          value={pm}
          onChange={(e) => setPm(e.target.value)}
          className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="">Auto-detect</option>
          {PACKAGE_MANAGERS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Port (auto-detected from output)</label>
        <Input
          value={portStr}
          onChange={(e) => setPortStr(e.target.value)}
          placeholder="3000"
          className="h-7 text-xs font-mono"
          inputMode="numeric"
        />
      </div>
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
