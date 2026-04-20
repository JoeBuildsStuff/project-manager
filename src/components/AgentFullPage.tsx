import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { LlmAgent } from "@/types";

// ─── constants ────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: "codex", label: "Codex" },
  { value: "cursor", label: "Cursor" },
  { value: "claude", label: "Claude" },
] as const;
type ProviderKey = (typeof PROVIDER_OPTIONS)[number]["value"];

const MODEL_OPTIONS: Record<ProviderKey, string[]> = {
  codex: [
    "GPT-5.4",
    "GPT-5.2-Codex",
    "GPT-5.1-Codex-Max",
    "GPT-5.4-Mini",
    "GPT-5.3-Codex",
    "GPT-5.2",
    "GPT-5.1-Codex-Mini",
  ],
  claude: [
    "default",
    "sonnet",
    "opus",
    "haiku",
    "sonnet[1m]",
    "opus[1m]",
    "opusplan",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "Opus 4.6",
    "Opus 4.7",
    "Sonnet 4.6",
    "Haiku 4.5",
  ],
  cursor: ["Auto", "Premium", "Composer 2"],
};

const REASONING_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "extra_high", label: "Extra High" },
] as const;

const CLAUDE_PERMISSION_OPTIONS = [
  { value: "default", label: "Default", description: "Prompts for permission on first use of each tool." },
  { value: "acceptEdits", label: "Accept Edits", description: "Automatically accepts file edit permissions for the session." },
  { value: "plan", label: "Plan", description: "Can analyze but not modify files or execute commands." },
  { value: "auto", label: "Auto", description: "Auto-approves tool calls with background safety checks." },
  { value: "dontAsk", label: "Don't Ask", description: "Auto-denies tools unless pre-approved." },
  { value: "bypassPermissions", label: "Bypass Permissions", description: "Skips prompts except for writes to protected directories." },
] as const;

const CLAUDE_COMING_SOON = [
  { title: "Hooks", description: "Lifecycle commands that run before or after tool use." },
  { title: "MCP Server Allowlists", description: "Restrict which external tool servers the Claude agent can use." },
  { title: "Plugin Marketplace Policy", description: "Control which plugin marketplaces and plugins are trusted." },
  { title: "Worktree Behavior", description: "Tune isolated git worktrees, sparse checkouts, and symlinked dirs." },
  { title: "Terminal/UI Preferences", description: "Set editor mode, status line behavior, and terminal-specific defaults." },
] as const;

// ─── draft type ───────────────────────────────────────────────────────────────

type AgentDraft = {
  id: number | null;
  name: string;
  provider: ProviderKey;
  model: string;
  reasoning: (typeof REASONING_OPTIONS)[number]["value"];
  permissionMode: (typeof CLAUDE_PERMISSION_OPTIONS)[number]["value"];
  systemPrompt: string;
};

function createEmptyDraft(): AgentDraft {
  return {
    id: null,
    name: "",
    provider: "codex",
    model: MODEL_OPTIONS.codex[0],
    reasoning: "medium",
    permissionMode: "default",
    systemPrompt: "",
  };
}

function toDraft(agent: LlmAgent): AgentDraft {
  const provider = PROVIDER_OPTIONS.some((o) => o.value === agent.provider)
    ? (agent.provider as ProviderKey)
    : "codex";
  const allowedModels = MODEL_OPTIONS[provider] ?? MODEL_OPTIONS.codex;
  return {
    id: agent.id,
    name: agent.name,
    provider,
    model: agent.model && allowedModels.includes(agent.model) ? agent.model : (allowedModels[0] ?? ""),
    reasoning: REASONING_OPTIONS.find((o) => o.value === agent.reasoning)?.value ?? "medium",
    permissionMode:
      CLAUDE_PERMISSION_OPTIONS.find((o) => o.value === agent.permission_mode)?.value ?? "default",
    systemPrompt: agent.system_prompt ?? "",
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

function AgentDetailRow({
  label,
  children,
  description,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-1 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 text-xs">
        <div className="w-28 shrink-0 pt-2 text-muted-foreground/60">{label}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {description ? <p className="pl-[7.75rem] text-[11px] text-muted-foreground">{description}</p> : null}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  agent: LlmAgent | null;
  onBack: () => void;
  onSaved: (agent: LlmAgent) => void;
  onDeleted: () => void;
}

export default function AgentFullPage({ agent, onBack, onSaved, onDeleted }: Props) {
  const [draft, setDraft] = useState<AgentDraft>(() =>
    agent ? toDraft(agent) : createEmptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const isExisting = draft.id != null;
  const draftRef = useRef(draft);
  const onSavedRef = useRef(onSaved);
  const textSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequenceRef = useRef(0);
  const activeSaveCountRef = useRef(0);
  const createInFlightRef = useRef(false);
  const pendingPersistRef = useRef(false);
  const didInitTextAutosaveRef = useRef(false);
  const TEXT_SAVE_DEBOUNCE_MS = 500;

  draftRef.current = draft;
  onSavedRef.current = onSaved;

  const clearTextSaveDebounce = useCallback(() => {
    if (textSaveTimerRef.current) {
      clearTimeout(textSaveTimerRef.current);
      textSaveTimerRef.current = null;
    }
  }, []);

  const persistDraft = useCallback(
    async (overrides?: Partial<AgentDraft>) => {
      const next = { ...draftRef.current, ...overrides };
      if (!next.name.trim()) return;
      if (next.id == null && createInFlightRef.current) {
        pendingPersistRef.current = true;
        return;
      }

      const requestId = ++saveSequenceRef.current;
      activeSaveCountRef.current += 1;
      setSaving(true);
      setError("");

      try {
        const isClaudeProvider = next.provider === "claude";
        const payload = {
          name: next.name.trim(),
          provider: next.provider,
          model: next.model,
          reasoning: next.reasoning,
          permissionMode: isClaudeProvider ? next.permissionMode : null,
          systemPrompt: isClaudeProvider ? next.systemPrompt : null,
        };
        if (next.id == null) {
          createInFlightRef.current = true;
        }
        const saved =
          next.id == null
            ? await invoke<LlmAgent>("create_llm_agent", payload)
            : await invoke<LlmAgent>("update_llm_agent", { id: next.id, ...payload });

        if (requestId === saveSequenceRef.current && draftRef.current.id == null) {
          setDraft((current) => ({ ...current, id: saved.id }));
        }
        onSavedRef.current(saved);
      } catch (e) {
        if (requestId === saveSequenceRef.current) {
          setError(String(e));
        }
      } finally {
        if (next.id == null) {
          createInFlightRef.current = false;
          if (pendingPersistRef.current) {
            pendingPersistRef.current = false;
            void persistDraft();
          }
        }
        activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
        if (activeSaveCountRef.current === 0) {
          setSaving(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    setDraft(agent ? toDraft(agent) : createEmptyDraft());
    setError("");
    clearTextSaveDebounce();
    didInitTextAutosaveRef.current = false;
  }, [agent?.id, clearTextSaveDebounce]);

  useEffect(() => {
    if (!didInitTextAutosaveRef.current) {
      didInitTextAutosaveRef.current = true;
      return;
    }

    clearTextSaveDebounce();
    if (!draft.name.trim()) {
      return;
    }

    textSaveTimerRef.current = setTimeout(() => {
      textSaveTimerRef.current = null;
      void persistDraft();
    }, TEXT_SAVE_DEBOUNCE_MS);

    return clearTextSaveDebounce;
  }, [draft.name, draft.systemPrompt, clearTextSaveDebounce, persistDraft]);

  useEffect(
    () => () => {
      clearTextSaveDebounce();
    },
    [clearTextSaveDebounce],
  );

  const handleDelete = async () => {
    if (draft.id == null) return;
    setDeleting(true);
    setError("");
    try {
      await invoke("delete_llm_agent", { id: draft.id });
      setDeleteOpen(false);
      onDeleted();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-1">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Agents
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="truncate text-base font-semibold">
          {isExisting ? draft.name || "Untitled agent" : "New agent"}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {isExisting ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mx-2 mb-2 mt-1 min-h-0 flex-1 overflow-y-auto rounded-lg border bg-background">
        <div className="space-y-5 p-4">
              {saving ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </p>
              ) : null}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Agent name"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
                <Textarea
                  value={draft.systemPrompt}
                  onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
                  placeholder="Set the Claude system prompt for this agent."
                  className="mt-1 min-h-32 resize-none text-xs"
                  disabled={draft.provider !== "claude"}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Stored as a Claude `--system-prompt` value. Disabled for non-Claude providers.
                </p>
              </div>
              <div>
                <SectionLabel>Details</SectionLabel>
                <div className="space-y-3">
                  <AgentDetailRow label="Provider">
                    <Select
                      value={draft.provider}
                      onValueChange={(value) => {
                        if (!value || !(value in MODEL_OPTIONS)) return;
                        const provider = value as ProviderKey;
                        clearTextSaveDebounce();
                        const nextDraft: AgentDraft = {
                          ...draft,
                          provider,
                          model: MODEL_OPTIONS[provider][0] ?? "",
                          permissionMode: provider === "claude" ? draft.permissionMode : "default",
                          systemPrompt: provider === "claude" ? draft.systemPrompt : "",
                        };
                        setDraft(nextDraft);
                        void persistDraft(nextDraft);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AgentDetailRow>
                  <AgentDetailRow
                    label="Model"
                    description={draft.provider === "claude" ? "Claude aliases resolve to the latest supported model version." : undefined}
                  >
                    <Select
                      value={draft.model}
                      onValueChange={(value) => {
                        if (!value) return;
                        clearTextSaveDebounce();
                        setDraft({ ...draft, model: value });
                        void persistDraft({ model: value });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS[draft.provider].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AgentDetailRow>
                  <AgentDetailRow label="Reasoning Level">
                    <Select
                      value={draft.reasoning}
                      onValueChange={(value) => {
                        if (!value) return;
                        const nextReasoning = value as AgentDraft["reasoning"];
                        clearTextSaveDebounce();
                        setDraft({ ...draft, reasoning: nextReasoning });
                        void persistDraft({ reasoning: nextReasoning });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REASONING_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AgentDetailRow>
                  <AgentDetailRow
                    label="Permissions"
                    description={
                      draft.provider === "claude"
                        ? CLAUDE_PERMISSION_OPTIONS.find((o) => o.value === draft.permissionMode)?.description
                        : "Claude permission modes are only available when the provider is Claude."
                    }
                  >
                    <Select
                      value={draft.permissionMode}
                      onValueChange={(value) => {
                        if (!value) return;
                        const nextPermissionMode = value as AgentDraft["permissionMode"];
                        clearTextSaveDebounce();
                        setDraft({ ...draft, permissionMode: nextPermissionMode });
                        void persistDraft({ permissionMode: nextPermissionMode });
                      }}
                      disabled={draft.provider !== "claude"}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Claude permission mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLAUDE_PERMISSION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AgentDetailRow>
                  {CLAUDE_COMING_SOON.map((item) => (
                    <AgentDetailRow
                      key={item.title}
                      label={item.title}
                      description={item.description}
                      disabled
                    >
                      <div className="flex h-8 items-center rounded-md border border-border/60 bg-muted/20 px-3 text-xs text-muted-foreground">
                        Coming soon
                      </div>
                    </AgentDetailRow>
                  ))}
                </div>
              </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              This removes the agent from the workspace. Tasks still assigned to it must be reassigned first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
