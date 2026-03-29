import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Code2,
  ExternalLink,
  GitBranch,
  GitCommit,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { CategoryBadge, StatusBadge, StageBadge, DeployBadge } from "./StatusBadge";
import DeleteProjectDialog from "./DeleteProjectDialog";
import type { Project } from "../types";

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (folder_key: string, field: string, value: string | null) => Promise<void>;
  onRename: (folder_key: string, nextName: string) => Promise<void>;
  onDelete: (folder_key: string) => Promise<void>;
}

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
const HOST_OPTIONS = ["github", "gitlab", "bitbucket"];

export default function ProjectDetail({
  project: p,
  open,
  onOpenChange,
  onFieldChange,
  onRename,
  onDelete,
}: Props) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nextName, setNextName] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!p || !open) return;
    setGitStatus(null);
    setGitLoading(true);
    invoke<GitStatus>("get_git_status", { folderKey: p.folder_key })
      .then(setGitStatus)
      .catch(() => setGitStatus(null))
      .finally(() => setGitLoading(false));
  }, [p?.folder_key, open]);

  const openWith = (cmd: string, arg: string) =>
    invoke(cmd, cmd === "open_url" ? { url: arg } : { folderKey: arg });

  if (!p) return null;

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[360px] flex-col p-0 sm:max-w-[360px]">
        <SheetHeader className="px-5 pb-2 pt-5">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base">{p.folder_name}</SheetTitle>
            {gitStatus?.is_dirty && (
              <span title="Uncommitted changes">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
              </span>
            )}
          </div>
          <SheetDescription className="font-mono text-[10px]">{p.folder_key}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-5 px-5 pb-6">
            {p.description && (
              <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
            )}

            {/* Quick actions */}
            <div>
              <SectionLabel>Quick actions</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton
                  icon={<FolderOpen className="h-3.5 w-3.5" />}
                  onClick={() => openWith("open_in_finder", p.folder_key)}
                >
                  Finder
                </ActionButton>
                <ActionButton
                  icon={<Code2 className="h-3.5 w-3.5" />}
                  onClick={() => openWith("open_in_vscode", p.folder_key)}
                >
                  Cursor
                </ActionButton>
                {p.production_url && (
                  <ActionButton
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    onClick={() => openWith("open_url", p.production_url as string)}
                  >
                    Live site
                  </ActionButton>
                )}
                {p.repo?.startsWith("http") && (
                  <ActionButton
                    icon={<GitBranch className="h-3.5 w-3.5" />}
                    onClick={() => openWith("open_url", p.repo as string)}
                  >
                    Repo
                  </ActionButton>
                )}
                <ActionButton
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={openRenameDialog}
                  disabled={renaming}
                >
                  Rename
                </ActionButton>
                <ActionButton
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setActionError("");
                    setDeleteOpen(true);
                  }}
                  disabled={renaming}
                  variant="destructive"
                >
                  Delete
                </ActionButton>
              </div>
            </div>

            {actionError && (
              <>
                <Separator />
                <p className="text-xs text-destructive">{actionError}</p>
              </>
            )}

            <Separator />

            {/* Details — editable fields */}
            <div>
              <SectionLabel>Details</SectionLabel>
              <dl className="space-y-1.5">
                <EditableField
                  label="Status"
                  value={p.status}
                  options={STATUS_OPTIONS}
                  onSelect={(v) => handleField("status", v)}
                  renderBadge={(v) => <StatusBadge status={v} />}
                />
                <EditableField
                  label="Category"
                  value={p.category}
                  options={CATEGORY_OPTIONS}
                  onSelect={(v) => handleField("category", v)}
                  renderBadge={(v) => <CategoryBadge category={v} />}
                />
                <EditableField
                  label="Stage"
                  value={p.stage}
                  options={STAGE_OPTIONS}
                  onSelect={(v) => handleField("stage", v)}
                  renderBadge={(v) => <StageBadge stage={v} />}
                  clearable
                />
                <EditableField
                  label="Host"
                  value={p.host}
                  options={HOST_OPTIONS}
                  onSelect={(v) => handleField("host", v)}
                  clearable
                />
                <EditableField
                  label="Deploy"
                  value={p.deploy_platform}
                  options={DEPLOY_OPTIONS}
                  onSelect={(v) => handleField("deploy_platform", v)}
                  renderBadge={(v) => <DeployBadge platform={v} />}
                  clearable
                />
                <Field label="Owner" value={p.repo_owner} />
                {p.production_url && <Field label="URL" value={p.production_url} link />}
                {p.vercel_project_name && <Field label="Vercel" value={p.vercel_project_name} />}
                <Field label="Commits" value={p.commit_count?.toString()} />
                <Field label="Last commit" value={p.last_commit_date?.split("T")[0]} />
                {p.days_since_last_commit != null && (
                  <Field label="Days ago" value={p.days_since_last_commit.toString()} />
                )}
              </dl>
            </div>

            {p.repo && (
              <>
                <Separator />
                <div>
                  <SectionLabel>Repo</SectionLabel>
                  <p className="break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {p.repo}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Git status */}
            <div>
              <SectionLabel>
                <GitCommit className="h-3 w-3" />
                Git status
                {gitStatus?.is_dirty && (
                  <Badge
                    variant="yellow"
                    className="ml-1 text-[10px]"
                  >
                    dirty
                  </Badge>
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

            {p.deployment && (
              <>
                <Separator />
                <div>
                  <SectionLabel>Deployment</SectionLabel>
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.deployment}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>

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
    </Sheet>
  );
}

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
                <Badge variant="gray" className="text-[11px] font-medium">
                  {value}
                </Badge>
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
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                    opt === value ? "bg-muted font-medium" : ""
                  }`}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={renaming}>
            {renaming ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value: React.ReactNode;
  link?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <dt className="w-20 shrink-0 text-muted-foreground/60">{label}</dt>
      {link ? (
        <dd className="min-w-0 cursor-pointer break-all text-blue-400 hover:underline">{value}</dd>
      ) : (
        <dd className="min-w-0 break-all text-muted-foreground">{value}</dd>
      )}
    </div>
  );
}

function ActionButton({
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
