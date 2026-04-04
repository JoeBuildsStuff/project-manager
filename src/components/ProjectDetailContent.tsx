import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Code2,
  ExternalLink,
  GitBranch,
  GitCommit,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
      <ActionButton icon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => openWith("open_in_finder", p.folder_key)}>
        Finder
      </ActionButton>
      <ActionButton icon={<Code2 className="h-3.5 w-3.5" />} onClick={() => openWith("open_in_vscode", p.folder_key)}>
        Cursor
      </ActionButton>
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
      <ActionButton icon={<Pencil className="h-3.5 w-3.5" />} onClick={openRenameDialog} disabled={renaming}>
        Rename
      </ActionButton>
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
      {p.vercel_project_name && <Field label="Vercel" value={p.vercel_project_name} />}
      <Field label="Commits" value={p.commit_count?.toString()} />
      <Field label="Last commit" value={p.last_commit_date?.split("T")[0]} />
      {p.days_since_last_commit != null && <Field label="Days ago" value={p.days_since_last_commit.toString()} />}
    </dl>
  );

  const gitBlock = (
    <div>
      <SectionLabel>
        <GitCommit className="h-3 w-3" />
        Git status
        {gitStatus?.is_dirty && (
          <Badge variant="yellow" className="ml-1 text-[10px]">dirty</Badge>
        )}
      </SectionLabel>
      <div className="min-h-[32px] rounded-md bg-muted px-2 py-1.5">
        {gitLoading && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </span>
        )}
        {!gitLoading && gitStatus && (
          gitStatus.output.trim()
            ? <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-yellow-400">{gitStatus.output}</pre>
            : <span className="text-[11px] text-muted-foreground">Clean</span>
        )}
        {!gitLoading && !gitStatus && (
          <span className="text-[11px] text-muted-foreground">Not a git repo</span>
        )}
      </div>
    </div>
  );

  const repoBlock = p.repo && (
    <div>
      <SectionLabel>Repo</SectionLabel>
      <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {p.repo}
      </p>
    </div>
  );

  const deploymentBlock = p.deployment && (
    <div>
      <SectionLabel>Deployment</SectionLabel>
      <p className="text-xs leading-relaxed text-muted-foreground">{p.deployment}</p>
    </div>
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
        {p.description && (
          <p className="text-sm leading-relaxed text-muted-foreground mb-6">{p.description}</p>
        )}

        <div>
          <SectionLabel>Quick actions</SectionLabel>
          {quickActions}
        </div>

        {actionError && <p className="text-xs text-destructive mt-3">{actionError}</p>}

        <Separator className="my-6" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-6">
            <div>
              <SectionLabel>Details</SectionLabel>
              {detailFields}
            </div>
            {repoBlock && (
              <>
                <Separator />
                {repoBlock}
              </>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {gitBlock}
            {deploymentBlock && (
              <>
                <Separator />
                {deploymentBlock}
              </>
            )}
          </div>
        </div>

        {dialogs}
      </>
    );
  }

  // Sheet layout (original single-column)
  return (
    <div className="space-y-5 px-5 pb-6">
      {p.description && (
        <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
      )}

      <div>
        <SectionLabel>Quick actions</SectionLabel>
        {quickActions}
      </div>

      {actionError && <p className="text-xs text-destructive">{actionError}</p>}

      <Separator />

      <div>
        <SectionLabel>Details</SectionLabel>
        {detailFields}
      </div>

      {repoBlock && (
        <>
          <Separator />
          {repoBlock}
        </>
      )}

      <Separator />
      {gitBlock}

      {deploymentBlock && (
        <>
          <Separator />
          {deploymentBlock}
        </>
      )}

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
