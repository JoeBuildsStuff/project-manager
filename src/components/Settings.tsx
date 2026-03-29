import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FolderOpen, Check, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";

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

  // GitHub token state
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    invoke<boolean>("has_secret", { key: "github_token" })
      .then(setHasToken)
      .catch(() => setHasToken(false));
  }, []);

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

  const handleSaveToken = async () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    setTokenSaving(true);
    setTokenError("");
    try {
      await invoke("save_secret", { key: "github_token", value: trimmed });
      setHasToken(true);
      setTokenSaved(true);
      setTokenInput("");
      setTimeout(() => setTokenSaved(false), 2000);
    } catch (e) {
      setTokenError(String(e));
    } finally {
      setTokenSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    setTokenError("");
    try {
      await invoke("delete_secret", { key: "github_token" });
      setHasToken(false);
      setTokenInput("");
    } catch (e) {
      setTokenError(String(e));
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
          <div className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyRound className="h-4 w-4" />
                GitHub Token
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                A personal access token used to update repo metadata (e.g. About URL) via the GitHub API.
                Stored securely in your macOS Keychain — never written to disk.
              </p>
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
            </div>

            {hasToken ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <p className="text-xs font-mono text-muted-foreground">
                    ghp_••••••••••••••••••••
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleDeleteToken}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={tokenVisible ? "text" : "password"}
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setTokenSaved(false);
                    }}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="pr-8 font-mono text-xs"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setTokenVisible(!tokenVisible)}
                    tabIndex={-1}
                  >
                    {tokenVisible ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSaveToken}
                  disabled={tokenSaving || !tokenInput.trim()}
                >
                  {tokenSaved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : tokenSaving ? (
                    "Saving..."
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}

            {tokenError && <p className="text-xs text-destructive">{tokenError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
