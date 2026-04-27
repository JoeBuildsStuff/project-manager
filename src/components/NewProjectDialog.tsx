import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Cloud,
  Download,
  Github,
  GitBranch,
  KeyRound,
  Loader2,
  PlusCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

type SourceMode = "scratch" | "clone";
type RemoteChoice =
  | "none"
  | "github_public"
  | "github_private"
  | "gitea_private"
  | "gitea_public";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (folderKey: string) => void | Promise<void>;
  onOpenSettings: () => void;
  projects: Project[];
  workspacePath: string | null;
  initialName?: string;
}

interface CreateResult {
  folder_key: string;
  steps: string[];
}

const CATEGORIES = [
  { value: "project", label: "Project" },
  { value: "reference", label: "Reference" },
  { value: "tooling", label: "Tooling" },
];

const STATUSES = ["inbox", "active", "archived"];

const REMOTES: Array<{ value: RemoteChoice; label: string; description: string; host?: "github" | "gitea" }> = [
  { value: "gitea_private", label: "Gitea private", description: "Create a private repo on gitea.joe-taylor.me.", host: "gitea" },
  { value: "gitea_public", label: "Gitea public", description: "Create a public repo on gitea.joe-taylor.me.", host: "gitea" },
  { value: "github_public", label: "GitHub public", description: "Create a public repo on GitHub.", host: "github" },
  { value: "github_private", label: "GitHub private", description: "Create a private repo on GitHub.", host: "github" },
  { value: "none", label: "Local only", description: "Initialize git without creating a remote." },
];

const SLUG_RE = /[^a-z0-9-]/g;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-").replace(SLUG_RE, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function deriveRepoName(url: string) {
  const trimmed = url.trim().replace(/\/$/, "");
  const parts = trimmed.split(/[/:]/).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1] : "";
  return last.replace(/\.git$/i, "");
}

function StepDot({ done, active }: { done: boolean; active: boolean }) {
  if (done) return <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
  if (active) return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
}

export default function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
  onOpenSettings,
  projects,
  workspacePath,
  initialName = "",
}: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<SourceMode>("scratch");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("project");
  const [status, setStatus] = useState("inbox");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [remote, setRemote] = useState<RemoteChoice>("gitea_private");
  const [folderTouched, setFolderTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [githubToken, setGithubToken] = useState(false);
  const [giteaToken, setGiteaToken] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const existingKeys = useMemo(() => new Set(projects.map((p) => p.folder_key)), [projects]);
  const folderKey = slugify(name);
  const selectedRemote = REMOTES.find((item) => item.value === remote) ?? REMOTES[0];
  const missingToken =
    mode === "scratch" && selectedRemote.host === "github" && !githubToken
      ? "GitHub"
      : mode === "scratch" && selectedRemote.host === "gitea" && !giteaToken
        ? "Gitea"
        : null;
  const folderCollision = Boolean(folderKey && existingKeys.has(folderKey));

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMode("scratch");
    setName(initialName);
    setCategory("project");
    setStatus("inbox");
    setDescription("");
    setRepoUrl("");
    setRemote("gitea_private");
    setFolderTouched(Boolean(initialName));
    setSaving(false);
    setError("");
    setCompletedSteps([]);
    invoke<boolean>("has_secret", { key: "github_token" }).then(setGithubToken).catch(() => setGithubToken(false));
    invoke<boolean>("has_secret", { key: "gitea_token" }).then(setGiteaToken).catch(() => setGiteaToken(false));
  }, [initialName, open]);

  useEffect(() => {
    if (mode !== "clone" || folderTouched) return;
    const repoName = deriveRepoName(repoUrl);
    if (repoName) setName(repoName);
  }, [folderTouched, mode, repoUrl]);

  const resetAndClose = (next: boolean) => {
    if (!next && !saving) {
      setStep(0);
      setError("");
      setCompletedSteps([]);
    }
    onOpenChange(next);
  };

  const reviewSteps = useMemo(() => {
    const path = workspacePath && folderKey ? `${workspacePath}/${folderKey}` : folderKey;
    if (mode === "clone") {
      return [
        `Clone ${repoUrl.trim() || "repository URL"}`,
        `Create folder ${path || "project folder"}`,
        "Sync repository metadata",
      ];
    }
    const items = [
      `Create folder ${path || "project folder"}`,
      "Add README.md and .gitignore",
      "Initialize git repository",
      "Create initial commit",
    ];
    if (remote !== "none") {
      items.push(`Create ${selectedRemote.label.toLowerCase()} repository`);
      items.push("Push initial commit");
    }
    items.push("Sync project metadata");
    return items;
  }, [folderKey, mode, remote, repoUrl, selectedRemote.label, workspacePath]);

  const validationError = (() => {
    if (mode === "clone" && step >= 1 && !repoUrl.trim()) return "Repository URL is required.";
    if (step >= 1 && !folderKey) return "Project folder name is required.";
    if (folderCollision) return "A project with this folder name already exists.";
    if (step >= 2 && missingToken) return `Add a ${missingToken} token in Settings before creating this remote.`;
    return "";
  })();

  const canGoNext = !validationError && (step !== 0 || mode);

  const handleCreate = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setCompletedSteps([]);
    try {
      const result = await invoke<CreateResult>("create_project_from_onboarding", {
        request: {
          mode,
          folderKey,
          folderName: folderKey,
          status,
          category,
          description: description.trim() || null,
          repoUrl: mode === "clone" ? repoUrl.trim() : null,
          remote: mode === "scratch" ? remote : "none",
        },
      });
      setCompletedSteps(result.steps);
      await onCreated(result.folder_key);
      resetAndClose(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New project
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a local project directory from scratch or clone an existing repository.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border pb-2 text-[11px] text-muted-foreground">
          {["Source", "Project", "Git", "Review"].map((label, index) => (
            <div
              key={label}
              className={cn(
                "flex flex-1 items-center justify-center rounded-md px-2 py-1",
                index === step && "bg-muted text-foreground",
                index < step && "text-foreground",
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="min-h-[330px] py-2">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("scratch");
                  setRemote("gitea_private");
                }}
                className={cn(
                  "rounded-md border p-4 text-left transition-colors hover:bg-accent",
                  mode === "scratch" ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <PlusCircle className="mb-3 h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-medium">Create from scratch</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Make a new folder, initialize git, and optionally create a remote repo.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("clone");
                  setRemote("none");
                  setFolderTouched(false);
                }}
                className={cn(
                  "rounded-md border p-4 text-left transition-colors hover:bg-accent",
                  mode === "clone" ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <Download className="mb-3 h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-medium">Clone existing repo</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start from a GitHub, Gitea, or other Git repository URL.
                </p>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {mode === "clone" && (
                <div className="space-y-1.5">
                  <Label htmlFor="repo-url" className="text-xs">Repository URL</Label>
                  <Input
                    id="repo-url"
                    className="h-8 text-xs"
                    placeholder="https://github.com/alchaincyf/huashu-design.git"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The folder name is derived from the URL until you edit it.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="proj-name" className="text-xs">Project folder</Label>
                <Input
                  id="proj-name"
                  className="h-8 text-xs"
                  placeholder="my-new-project"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFolderTouched(true);
                  }}
                  autoFocus={mode === "scratch"}
                />
                <p className={cn("font-mono text-[10px]", folderCollision ? "text-destructive" : "text-muted-foreground")}>
                  {folderKey ? `-> ${folderKey}` : "Folder name will be slugified."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-desc" className="text-xs">Description</Label>
                <Input
                  id="proj-desc"
                  className="h-8 text-xs"
                  placeholder="What is this project?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && mode === "clone" && (
            <div className="space-y-4">
              <Alert>
                <GitBranch className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  The app will run `git clone`, then read the remote origin for host and owner metadata.
                </AlertDescription>
              </Alert>
              <div className="rounded-md border border-border p-3 text-xs">
                <div className="font-medium text-foreground">Clone source</div>
                <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{repoUrl.trim()}</div>
              </div>
            </div>
          )}

          {step === 2 && mode === "scratch" && (
            <div className="space-y-3">
              {REMOTES.map((item) => {
                const tokenMissing = item.host === "github" ? !githubToken : item.host === "gitea" ? !giteaToken : false;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRemote(item.value)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent",
                      remote === item.value ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    {item.host === "github" ? (
                      <Github className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    ) : item.host === "gitea" ? (
                      <Cloud className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <GitBranch className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.description}</span>
                    </span>
                    {tokenMissing && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
                        <KeyRound className="h-3 w-3" />
                        Token needed
                      </span>
                    )}
                  </button>
                );
              })}
              {missingToken && (
                <Alert>
                  <KeyRound className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-3 text-xs">
                    <span>Add a {missingToken} token in Settings before creating this remote.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetAndClose(false);
                        onOpenSettings();
                      }}
                    >
                      Open Settings
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs font-medium">Review actions</div>
                <div className="mt-3 space-y-2">
                  {reviewSteps.map((item, index) => (
                    <div key={item} className="flex items-center gap-2 text-xs">
                      <StepDot done={completedSteps.length > 0 || (!saving && completedSteps.includes(item))} active={saving && index === 0} />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              {saving && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="text-xs">
                    Creating project. This can take a moment when cloning or pushing a remote repository.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {(error || validationError) && (
            <p className="mt-3 text-xs text-destructive">{error || validationError}</p>
          )}
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <DialogClose className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent" disabled={saving}>
            Cancel
          </DialogClose>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={saving || step === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {step < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setError("");
                  setStep((value) => Math.min(3, value + 1));
                }}
                disabled={!canGoNext}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={saving || Boolean(validationError)}
              >
                {saving ? "Creating..." : "Create project"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
