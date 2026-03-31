import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FolderOpen, Check, Eye, EyeOff, KeyRound, Trash2, BrainCircuit } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Reusable secret field hook
// ─────────────────────────────────────────────────────────────────────────────
function useSecretField(secretKey: string) {
  const [hasKey, setHasKey] = useState(false);
  const [input, setInput] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<boolean>("has_secret", { key: secretKey })
      .then(setHasKey)
      .catch(() => setHasKey(false));
  }, [secretKey]);

  const save = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      await invoke("save_secret", { key: secretKey, value: trimmed });
      setHasKey(true);
      setSaved(true);
      setInput("");
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setError("");
    try {
      await invoke("delete_secret", { key: secretKey });
      setHasKey(false);
      setInput("");
    } catch (e) {
      setError(String(e));
    }
  };

  return { hasKey, input, setInput, visible, setVisible, saving, saved, setSaved, error, save, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable secret field component
// ─────────────────────────────────────────────────────────────────────────────
function SecretField({
  icon,
  title,
  description,
  help,
  placeholder,
  maskedDisplay,
  field,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  help?: React.ReactNode;
  placeholder: string;
  maskedDisplay: string;
  field: ReturnType<typeof useSecretField>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {help}
      </div>

      {field.hasKey ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-mono text-muted-foreground">{maskedDisplay}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={field.remove}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={field.visible ? "text" : "password"}
              value={field.input}
              onChange={(e) => {
                field.setInput(e.target.value);
                field.setSaved(false);
              }}
              placeholder={placeholder}
              className="pr-8 font-mono text-xs"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => field.setVisible(!field.visible)}
              tabIndex={-1}
            >
              {field.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={field.save}
            disabled={field.saving || !field.input.trim()}
          >
            {field.saved ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Saved
              </>
            ) : field.saving ? (
              "Saving..."
            ) : (
              "Save"
            )}
          </Button>
        </div>
      )}

      {field.error && <p className="text-xs text-destructive">{field.error}</p>}
    </div>
  );
}

interface Props {
  workspacePath: string | null;
  onWorkspaceChanged: () => void;
  onBack: () => void;
}

export default function Settings({ workspacePath, onWorkspaceChanged, onBack }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Secret fields
  const githubToken = useSecretField("github_token");
  const anthropicKey = useSecretField("anthropic_api_key");
  const openaiKey = useSecretField("openai_api_key");
  const cerebrasKey = useSecretField("cerebras_api_key");

  const handlePickFolder = async () => {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Choose your workspace folder",
    });
    if (result) {
      setSelectedPath(result);
      setSaved(false);
      setError("");
    }
  };

  const handleSave = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setError("");
    try {
      await invoke("set_workspace_path", { path: selectedPath });
      setSaved(true);
      onWorkspaceChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-medium">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-8">
          {/* Workspace folder */}
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">Workspace folder</h2>
              <p className="text-xs text-muted-foreground mt-1">
                The folder where your projects are stored. Each subfolder is tracked as a project.
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs font-mono text-muted-foreground truncate">
                {workspacePath ?? "Not configured"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handlePickFolder}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Choose new folder
              </Button>

              {selectedPath && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleSave}
                  disabled={saving || saved}
                >
                  {saved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : saving ? (
                    "Saving..."
                  ) : (
                    "Apply"
                  )}
                </Button>
              )}
            </div>

            {selectedPath && !saved && (
              <p className="text-xs text-muted-foreground">
                New path: <code className="font-mono">{selectedPath}</code>
              </p>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* GitHub Token */}
          <SecretField
            icon={<KeyRound className="h-4 w-4" />}
            title="GitHub Token"
            description="A personal access token used to update repo metadata (e.g. About URL) via the GitHub API. Stored securely in your macOS Keychain — never written to disk."
            help={
              <p className="text-xs text-muted-foreground mt-1">
                Create one at{" "}
                <button
                  className="text-blue-400 hover:underline"
                  onClick={() => invoke("open_url", { url: "https://github.com/settings/tokens?type=beta" })}
                >
                  github.com/settings/tokens
                </button>
                {" "}with <code className="rounded bg-muted px-1 py-0.5 text-[10px]">repo</code> scope
                (or fine-grained with <code className="rounded bg-muted px-1 py-0.5 text-[10px]">metadata: read/write</code>).
              </p>
            }
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            maskedDisplay="ghp_••••••••••••••••••••"
            field={githubToken}
          />

          {/* LLM API Keys */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <BrainCircuit className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">AI Chat API Keys</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide your own API keys to power the built-in chat assistant.
              Keys are stored securely in your macOS Keychain and never leave your machine — they are sent
              directly from this app to the provider over HTTPS.
            </p>
          </div>

          <SecretField
            title="Anthropic"
            description="Powers Claude models in the chat assistant."
            help={
              <p className="text-xs text-muted-foreground mt-1">
                Get your key at{" "}
                <button
                  className="text-blue-400 hover:underline"
                  onClick={() => invoke("open_url", { url: "https://console.anthropic.com/settings/keys" })}
                >
                  console.anthropic.com
                </button>
              </p>
            }
            placeholder="sk-ant-api03-xxxxxxxxxxxx"
            maskedDisplay="sk-ant-••••••••••••••••"
            field={anthropicKey}
          />

          <SecretField
            title="OpenAI"
            description="Powers GPT models in the chat assistant."
            help={
              <p className="text-xs text-muted-foreground mt-1">
                Get your key at{" "}
                <button
                  className="text-blue-400 hover:underline"
                  onClick={() => invoke("open_url", { url: "https://platform.openai.com/api-keys" })}
                >
                  platform.openai.com
                </button>
              </p>
            }
            placeholder="sk-proj-xxxxxxxxxxxx"
            maskedDisplay="sk-proj-••••••••••••••••"
            field={openaiKey}
          />

          <SecretField
            title="Cerebras"
            description="Powers fast inference models in the chat assistant."
            help={
              <p className="text-xs text-muted-foreground mt-1">
                Get your key at{" "}
                <button
                  className="text-blue-400 hover:underline"
                  onClick={() => invoke("open_url", { url: "https://cloud.cerebras.ai/" })}
                >
                  cloud.cerebras.ai
                </button>
              </p>
            }
            placeholder="csk-xxxxxxxxxxxx"
            maskedDisplay="csk-••••••••••••••••"
            field={cerebrasKey}
          />
        </div>
      </div>
    </div>
  );
}
