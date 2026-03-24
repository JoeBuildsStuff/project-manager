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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CategoryBadge, StatusBadge } from "./StatusBadge";
import DeleteProjectDialog from "./DeleteProjectDialog";
import type { Project } from "../types";

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (folder_key: string, status: string) => void;
  onRename: (folder_key: string, nextName: string) => Promise<void>;
  onDelete: (folder_key: string) => Promise<void>;
}

interface GitStatus {
  folder_key: string;
  output: string;
  is_dirty: boolean;
}

const STATUSES = ["active", "inbox", "archived"];

export default function ProjectDetail({
  project: p,
  open,
  onOpenChange,
  onStatusChange,
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

            {/* Status */}
            <div>
              <SectionLabel>Status</SectionLabel>
              <Select
                value={p.status ?? "inbox"}
                onValueChange={(val) => val && onStatusChange(p.folder_key, val)}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue>
                    <StatusBadge status={p.status} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Details */}
            <div>
              <SectionLabel>Details</SectionLabel>
              <dl className="space-y-1.5">
                <Field
                  label="Category"
                  value={<CategoryBadge category={p.category} />}
                />
                <Field
                  label="Status"
                  value={<StatusBadge status={p.status} />}
                />
                <Field label="Host"        value={p.host} />
                <Field label="Owner"       value={p.repo_owner} />
                <Field label="Deploy"      value={p.deploy_platform} />
                {p.production_url && <Field label="URL" value={p.production_url} link />}
                {p.vercel_project_name && <Field label="Vercel" value={p.vercel_project_name} />}
                <Field label="Commits"     value={p.commit_count?.toString()} />
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
