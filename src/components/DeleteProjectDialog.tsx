import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitCommit,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CategoryBadge, StatusBadge } from "./StatusBadge";
import type { DeleteGuardrails, Project } from "@/types";

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (folderKey: string) => Promise<void>;
}

export default function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  const [guardrails, setGuardrails] = useState<DeleteGuardrails | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    setError("");
    setConfirmText("");
    invoke<DeleteGuardrails>("get_delete_guardrails", { folderKey: project.folder_key })
      .then(setGuardrails)
      .catch((err) => {
        setGuardrails(null);
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, [open, project?.folder_key]);

  const warnings = useMemo(() => {
    if (!guardrails) return [];
    const items: { tone: "red" | "yellow" | "blue"; text: string }[] = [];

    if (!guardrails.exists_on_disk) {
      items.push({ tone: "red", text: "The folder is missing on disk. The DB row may be stale." });
    }
    if (!guardrails.has_remote_repo) {
      items.push({
        tone: "red",
        text: "No remote repo detected. Deleting this folder may remove the only known copy of the code.",
      });
    }
    if (guardrails.git_dirty) {
      items.push({
        tone: "red",
        text: "Uncommitted changes detected in the git working tree.",
      });
    }
    if (guardrails.status === "active") {
      items.push({
        tone: "yellow",
        text: "This project is currently marked active.",
      });
    }
    if (guardrails.production_url) {
      items.push({
        tone: "yellow",
        text: "A production URL exists. Deleting the local folder will not remove the live deployment.",
      });
    }
    if (guardrails.has_remote_repo) {
      items.push({
        tone: "blue",
        text: "A remote repo exists. Deleting locally will not delete the remote repository.",
      });
    }
    if (guardrails.nested_tracked_rows > 0) {
      items.push({
        tone: "yellow",
        text: `This will also remove ${guardrails.nested_tracked_rows} nested tracked row(s) from the database.`,
      });
    }
    return items;
  }, [guardrails]);

  if (!project) return null;

  const guard = guardrails ?? {
    folder_key: project.folder_key,
    folder_name: project.folder_name,
    status: project.status,
    category: project.category,
    exists_on_disk: true,
    has_git_repo: false,
    has_remote_repo: false,
    remote_url: null,
    git_dirty: false,
    git_status_output: null,
    production_url: project.production_url,
    deploy_platform: project.deploy_platform,
    nested_tracked_rows: 0,
    commit_count: project.commit_count,
    last_commit_date: project.last_commit_date,
  };

  const canDelete = confirmText.trim() === guard.folder_key && !loading && !deleting;

  const handleConfirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm(guard.folder_key);
      onOpenChange(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 />
            Delete Folder Review
          </DialogTitle>
          <DialogDescription>
            Review the local repo, deployment, and git state before deleting{" "}
            <span className="font-mono">{guard.folder_key}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={guard.status} />
            <CategoryBadge category={guard.category} />
            {guard.has_remote_repo ? (
              <Badge variant="green">
                <GitBranch />
                Remote repo
              </Badge>
            ) : (
              <Badge variant="red">
                <ShieldAlert />
                Local only
              </Badge>
            )}
            {guard.git_dirty ? (
              <Badge variant="red">
                <AlertTriangle />
                Uncommitted changes
              </Badge>
            ) : guard.has_git_repo ? (
              <Badge variant="green">
                <CheckCircle2 />
                Working tree clean
              </Badge>
            ) : (
              <Badge variant="gray">No git repo</Badge>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" />
              Checking delete guardrails…
            </div>
          ) : (
            <>
              <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <DetailRow label="Folder key" value={guard.folder_key} mono />
                <DetailRow label="Remote" value={guard.remote_url ?? "None detected"} mono />
                <DetailRow
                  label="Last commit"
                  value={guard.last_commit_date?.split("T")[0] ?? "Unknown"}
                />
                <DetailRow
                  label="Commits"
                  value={guard.commit_count != null ? String(guard.commit_count) : "Unknown"}
                />
                <DetailRow
                  label="Deployment"
                  value={
                    guard.production_url
                      ? `${guard.deploy_platform ?? "deployed"} · ${guard.production_url}`
                      : "None recorded"
                  }
                />
              </div>

              {warnings.length > 0 && (
                <div className="flex flex-col gap-2">
                  {warnings.map((warning) => (
                    <div
                      key={warning.text}
                      className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm"
                    >
                      <Badge variant={warning.tone}>{warning.tone === "blue" ? <GitCommit /> : <AlertTriangle />}</Badge>
                      <p className="leading-relaxed text-muted-foreground">{warning.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {guard.git_status_output?.trim() && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Git status
                    </p>
                    <pre className="max-h-32 overflow-auto rounded-lg bg-muted px-3 py-2 font-mono text-[11px] text-yellow-400">
                      {guard.git_status_output}
                    </pre>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Final confirmation
                </p>
                <p className="text-sm text-muted-foreground">
                  Type <span className="font-mono">{guard.folder_key}</span> to enable deletion.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={guard.folder_key}
                  aria-invalid={confirmText.length > 0 && confirmText.trim() !== guard.folder_key}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canDelete} onClick={handleConfirm}>
            {deleting ? "Deleting…" : "Delete folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 shrink-0 text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "break-all font-mono text-xs text-foreground" : "break-all text-sm text-foreground"}>
        {value}
      </div>
    </div>
  );
}
