import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, Check } from "lucide-react";

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
        <div className="max-w-lg space-y-6">
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
        </div>
      </div>
    </div>
  );
}
