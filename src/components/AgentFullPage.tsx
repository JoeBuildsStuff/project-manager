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

const PROVIDER_OPTIONS = [
  { value: "codex", label: "Codex" },
  { value: "cursor", label: "Cursor" },
  { value: "claude", label: "Claude" },
] as const;
type ProviderKey = (typeof PROVIDER_OPTIONS)[number]["value"];

const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderKey, string> = {
  codex: "gpt-5.4",
  claude: "default",
  cursor: "Auto",
};

const MODEL_SUGGESTIONS: Record<ProviderKey, string[]> = {
  codex: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.2-codex", "gpt-5.1-codex-max"],
  claude: ["default", "sonnet", "opus", "haiku", "opusplan", "claude-opus-4-6"],
  cursor: ["Auto", "Premium", "Composer 2"],
};

const CLAUDE_EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
] as const;

const CODEX_REASONING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
] as const;

const CURSOR_REASONING_OPTIONS = [
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

const CODEX_APPROVAL_OPTIONS = [
  { value: "untrusted", label: "Auto", description: "Works in the project by default, but asks before risky commands or actions outside the workspace." },
  { value: "on-request", label: "On Request", description: "Defers command approval until Codex explicitly asks for it." },
  { value: "never", label: "Full Access", description: "Never asks for approval before commands; use only in trusted environments." },
] as const;

const CODEX_SANDBOX_OPTIONS = [
  { value: "read-only", label: "Read-only", description: "Can inspect files but cannot edit or run mutating commands." },
  { value: "workspace-write", label: "Workspace Write", description: "Can edit and run commands inside the workspace." },
  { value: "danger-full-access", label: "Danger Full Access", description: "No sandbox limits. Codex can act across your machine." },
] as const;

const CODEX_SEARCH_OPTIONS = [
  { value: "cached", label: "Cached", description: "Uses the default cached web context." },
  { value: "live", label: "Live", description: "Enables live web search at startup." },
] as const;

type AgentDraft = {
  id: number | null;
  name: string;
  provider: ProviderKey;
  model: string;
  instructions: string;
  claude: {
    effort: (typeof CLAUDE_EFFORT_OPTIONS)[number]["value"];
    permissionMode: (typeof CLAUDE_PERMISSION_OPTIONS)[number]["value"];
  };
  codex: {
    reasoningEffort: (typeof CODEX_REASONING_OPTIONS)[number]["value"];
    approvalPolicy: (typeof CODEX_APPROVAL_OPTIONS)[number]["value"];
    sandboxMode: (typeof CODEX_SANDBOX_OPTIONS)[number]["value"];
    webSearch: (typeof CODEX_SEARCH_OPTIONS)[number]["value"];
    profile: string;
    cwd: string;
    additionalDirectories: string;
  };
  cursor: {
    reasoning: (typeof CURSOR_REASONING_OPTIONS)[number]["value"];
  };
};

function createEmptyDraft(): AgentDraft {
  return {
    id: null,
    name: "",
    provider: "codex",
    model: DEFAULT_MODEL_BY_PROVIDER.codex,
    instructions: "",
    claude: {
      effort: "medium",
      permissionMode: "default",
    },
    codex: {
      reasoningEffort: "medium",
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      webSearch: "cached",
      profile: "",
      cwd: "",
      additionalDirectories: "",
    },
    cursor: {
      reasoning: "medium",
    },
  };
}

function toDraft(agent: LlmAgent): AgentDraft {
  const provider = PROVIDER_OPTIONS.some((option) => option.value === agent.provider)
    ? (agent.provider as ProviderKey)
    : "codex";
  return {
    id: agent.id,
    name: agent.name,
    provider,
    model: agent.model?.trim() || DEFAULT_MODEL_BY_PROVIDER[provider],
    instructions: agent.instructions ?? agent.system_prompt ?? "",
    claude: {
      effort:
        CLAUDE_EFFORT_OPTIONS.find((option) => option.value === (agent.claude_config?.effort ?? agent.reasoning))
          ?.value ?? "medium",
      permissionMode:
        CLAUDE_PERMISSION_OPTIONS.find((option) => option.value === (agent.claude_config?.permission_mode ?? agent.permission_mode))
          ?.value ?? "default",
    },
    codex: {
      reasoningEffort:
        CODEX_REASONING_OPTIONS.find((option) => option.value === (agent.codex_config?.reasoning_effort ?? agent.reasoning))
          ?.value ?? "medium",
      approvalPolicy:
        CODEX_APPROVAL_OPTIONS.find((option) => option.value === agent.codex_config?.approval_policy)?.value
          ?? "untrusted",
      sandboxMode:
        CODEX_SANDBOX_OPTIONS.find((option) => option.value === agent.codex_config?.sandbox_mode)?.value
          ?? "workspace-write",
      webSearch:
        CODEX_SEARCH_OPTIONS.find((option) => option.value === agent.codex_config?.web_search)?.value
          ?? "cached",
      profile: agent.codex_config?.profile ?? "",
      cwd: agent.codex_config?.cwd ?? "",
      additionalDirectories: agent.codex_config?.additional_directories?.join("\n") ?? "",
    },
    cursor: {
      reasoning:
        CURSOR_REASONING_OPTIONS.find((option) => option.value === agent.reasoning)?.value ?? "medium",
    },
  };
}

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

function DisabledField({ label }: { label: string }) {
  return (
    <div className="flex h-8 items-center rounded-md border border-border/60 bg-muted/20 px-3 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

interface Props {
  agent: LlmAgent | null;
  onBack: () => void;
  onSaved: (agent: LlmAgent) => void;
  onDeleted: () => void;
}

export default function AgentFullPage({ agent, onBack, onSaved, onDeleted }: Props) {
  const [draft, setDraft] = useState<AgentDraft>(() => (
    agent ? toDraft(agent) : createEmptyDraft()
  ));
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
      if (!next.model.trim()) return;
      if (next.id == null && createInFlightRef.current) {
        pendingPersistRef.current = true;
        return;
      }

      const additionalDirectories = next.codex.additionalDirectories
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);
      const reasoning =
        next.provider === "claude"
          ? next.claude.effort
          : next.provider === "codex"
            ? next.codex.reasoningEffort
            : next.cursor.reasoning;
      const permissionMode = next.provider === "claude" ? next.claude.permissionMode : null;
      const payload = {
        name: next.name.trim(),
        provider: next.provider,
        model: next.model.trim(),
        instructions: next.instructions.trim() || null,
        reasoning,
        permissionMode,
        systemPrompt: next.provider === "claude" ? (next.instructions.trim() || null) : null,
        claudeConfig:
          next.provider === "claude"
            ? {
              effort: next.claude.effort,
              permission_mode: next.claude.permissionMode,
            }
            : null,
        codexConfig:
          next.provider === "codex"
            ? {
              reasoning_effort: next.codex.reasoningEffort,
              approval_policy: next.codex.approvalPolicy,
              sandbox_mode: next.codex.sandboxMode,
              web_search: next.codex.webSearch,
              profile: next.codex.profile.trim() || null,
              cwd: next.codex.cwd.trim() || null,
              additional_directories: additionalDirectories.length > 0 ? additionalDirectories : null,
            }
            : null,
      };

      const requestId = ++saveSequenceRef.current;
      activeSaveCountRef.current += 1;
      setSaving(true);
      setError("");

      try {
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
    if (!draft.name.trim()) return;

    textSaveTimerRef.current = setTimeout(() => {
      textSaveTimerRef.current = null;
      void persistDraft();
    }, TEXT_SAVE_DEBOUNCE_MS);

    return clearTextSaveDebounce;
  }, [
    draft.name,
    draft.model,
    draft.instructions,
    draft.codex.profile,
    draft.codex.cwd,
    draft.codex.additionalDirectories,
    clearTextSaveDebounce,
    persistDraft,
  ]);

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

  const updateAndPersist = (nextDraft: AgentDraft, overrides?: Partial<AgentDraft>) => {
    clearTextSaveDebounce();
    setDraft(nextDraft);
    void persistDraft(overrides ?? nextDraft);
  };

  const renderReasoningSection = () => {
    if (draft.provider === "claude") {
      return (
        <AgentDetailRow
          label="Effort"
          description="Claude supports low, medium, high, and max effort."
        >
          <Select
            value={draft.claude.effort}
            onValueChange={(value) => {
              const nextValue = value as AgentDraft["claude"]["effort"];
              const nextDraft = { ...draft, claude: { ...draft.claude, effort: nextValue } };
              updateAndPersist(nextDraft, { claude: nextDraft.claude });
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLAUDE_EFFORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AgentDetailRow>
      );
    }

    if (draft.provider === "codex") {
      return (
        <AgentDetailRow
          label="Effort"
          description="Codex uses OpenAI reasoning effort levels."
        >
          <Select
            value={draft.codex.reasoningEffort}
            onValueChange={(value) => {
              const nextValue = value as AgentDraft["codex"]["reasoningEffort"];
              const nextDraft = { ...draft, codex: { ...draft.codex, reasoningEffort: nextValue } };
              updateAndPersist(nextDraft, { codex: nextDraft.codex });
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CODEX_REASONING_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AgentDetailRow>
      );
    }

    return (
      <AgentDetailRow
        label="Reasoning"
        description="Cursor keeps the shared reasoning selector."
      >
        <Select
          value={draft.cursor.reasoning}
          onValueChange={(value) => {
            const nextValue = value as AgentDraft["cursor"]["reasoning"];
            const nextDraft = { ...draft, cursor: { reasoning: nextValue } };
            updateAndPersist(nextDraft, { cursor: nextDraft.cursor });
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURSOR_REASONING_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AgentDetailRow>
    );
  };

  const renderAccessSection = () => {
    if (draft.provider === "claude") {
      return (
        <AgentDetailRow
          label="Permissions"
          description={CLAUDE_PERMISSION_OPTIONS.find((option) => option.value === draft.claude.permissionMode)?.description}
        >
          <Select
            value={draft.claude.permissionMode}
            onValueChange={(value) => {
              const nextValue = value as AgentDraft["claude"]["permissionMode"];
              const nextDraft = { ...draft, claude: { ...draft.claude, permissionMode: nextValue } };
              updateAndPersist(nextDraft, { claude: nextDraft.claude });
            }}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLAUDE_PERMISSION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AgentDetailRow>
      );
    }

    if (draft.provider === "codex") {
      return (
        <>
          <AgentDetailRow
            label="Approvals"
            description={CODEX_APPROVAL_OPTIONS.find((option) => option.value === draft.codex.approvalPolicy)?.description}
          >
            <Select
              value={draft.codex.approvalPolicy}
              onValueChange={(value) => {
                const nextValue = value as AgentDraft["codex"]["approvalPolicy"];
                const nextDraft = { ...draft, codex: { ...draft.codex, approvalPolicy: nextValue } };
                updateAndPersist(nextDraft, { codex: nextDraft.codex });
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CODEX_APPROVAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AgentDetailRow>
          <AgentDetailRow
            label="Sandbox"
            description={CODEX_SANDBOX_OPTIONS.find((option) => option.value === draft.codex.sandboxMode)?.description}
          >
            <Select
              value={draft.codex.sandboxMode}
              onValueChange={(value) => {
                const nextValue = value as AgentDraft["codex"]["sandboxMode"];
                const nextDraft = { ...draft, codex: { ...draft.codex, sandboxMode: nextValue } };
                updateAndPersist(nextDraft, { codex: nextDraft.codex });
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CODEX_SANDBOX_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AgentDetailRow>
        </>
      );
    }

    return (
      <AgentDetailRow
        label="Permissions"
        description="Cursor-specific access controls are not configured yet."
        disabled
      >
        <DisabledField label="No provider-specific permissions" />
      </AgentDetailRow>
    );
  };

  const renderAdvancedSection = () => {
    if (draft.provider === "codex") {
      return (
        <>
          <AgentDetailRow
            label="Search"
            description={CODEX_SEARCH_OPTIONS.find((option) => option.value === draft.codex.webSearch)?.description}
          >
            <Select
              value={draft.codex.webSearch}
              onValueChange={(value) => {
                const nextValue = value as AgentDraft["codex"]["webSearch"];
                const nextDraft = { ...draft, codex: { ...draft.codex, webSearch: nextValue } };
                updateAndPersist(nextDraft, { codex: nextDraft.codex });
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CODEX_SEARCH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AgentDetailRow>
          <AgentDetailRow
            label="Profile"
            description="Maps to `--profile` when launching Codex."
          >
            <Input
              value={draft.codex.profile}
              onChange={(event) => setDraft({
                ...draft,
                codex: { ...draft.codex, profile: event.target.value },
              })}
              placeholder="default"
              className="h-8 text-xs"
            />
          </AgentDetailRow>
          <AgentDetailRow
            label="Working Dir"
            description="Maps to `--cd` for the startup working directory."
          >
            <Input
              value={draft.codex.cwd}
              onChange={(event) => setDraft({
                ...draft,
                codex: { ...draft.codex, cwd: event.target.value },
              })}
              placeholder="/path/to/project"
              className="h-8 text-xs"
            />
          </AgentDetailRow>
          <AgentDetailRow
            label="Extra Dirs"
            description="One path per line. Maps to repeatable `--add-dir` flags."
          >
            <Textarea
              value={draft.codex.additionalDirectories}
              onChange={(event) => setDraft({
                ...draft,
                codex: { ...draft.codex, additionalDirectories: event.target.value },
              })}
              placeholder={"/path/to/backend\n/path/to/shared"}
              className="min-h-24 resize-none text-xs"
            />
          </AgentDetailRow>
        </>
      );
    }

    if (draft.provider === "claude") {
      return (
        <>
          {CLAUDE_COMING_SOON.map((item) => (
            <AgentDetailRow
              key={item.title}
              label={item.title}
              description={item.description}
              disabled
            >
              <DisabledField label="Coming soon" />
            </AgentDetailRow>
          ))}
        </>
      );
    }

    return (
      <AgentDetailRow
        label="Advanced"
        description="Cursor-specific advanced options are not configured yet."
        disabled
      >
        <DisabledField label="No advanced Cursor fields" />
      </AgentDetailRow>
    );
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
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Agent name"
              className="mt-1 h-8 text-xs"
            />
          </div>

          <div>
            <SectionLabel>Basics</SectionLabel>
            <div className="space-y-3">
              <AgentDetailRow label="Provider">
                <Select
                  value={draft.provider}
                  onValueChange={(value) => {
                    if (!value || !PROVIDER_OPTIONS.some((option) => option.value === value)) return;
                    const provider = value as ProviderKey;
                    const nextDraft = {
                      ...draft,
                      provider,
                      model: DEFAULT_MODEL_BY_PROVIDER[provider],
                    };
                    updateAndPersist(nextDraft, nextDraft);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AgentDetailRow>

              <AgentDetailRow
                label="Model"
                description={`Common choices: ${MODEL_SUGGESTIONS[draft.provider].join(", ")}`}
              >
                <Select
                  value={draft.model}
                  onValueChange={(value) => {
                    if (!value) return;
                    const nextDraft = { ...draft, model: value };
                    updateAndPersist(nextDraft, { model: value });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODEL_SUGGESTIONS[draft.provider].map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AgentDetailRow>

              <AgentDetailRow
                label="Instructions"
                description={
                  draft.provider === "claude"
                    ? "Shared UI field; stored as Claude system prompt semantics."
                    : "Shared startup instructions for this provider."
                }
              >
                <Textarea
                  value={draft.instructions}
                  onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
                  placeholder="Tell the agent how it should behave by default."
                  className="min-h-32 resize-none text-xs"
                />
              </AgentDetailRow>
            </div>
          </div>

          <div>
            <SectionLabel>Reasoning / Effort</SectionLabel>
            <div className="space-y-3">
              {renderReasoningSection()}
            </div>
          </div>

          <div>
            <SectionLabel>Access / Permissions</SectionLabel>
            <div className="space-y-3">
              {renderAccessSection()}
            </div>
          </div>

          <div>
            <SectionLabel>Advanced</SectionLabel>
            <div className="space-y-3">
              {renderAdvancedSection()}
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
