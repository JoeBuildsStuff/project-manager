import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, ArrowRight } from "lucide-react";

interface Props {
  onConfigured: () => void;
}

export default function WorkspaceSetup({ onConfigured }: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePickFolder = async () => {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Choose your workspace folder",
    });
    if (result) {
      setSelectedPath(result);
      setError("");
    }
  };

  const handleContinue = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setError("");
    try {
      await invoke("set_workspace_path", { path: selectedPath });
      onConfigured();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-8 px-6 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Project Manager
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Choose a folder to use as your workspace. Each subfolder becomes a
            tracked project. A database file will be created in this folder to
            store project metadata.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-12 text-sm"
            onClick={handlePickFolder}
          >
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            {selectedPath ? (
              <span className="truncate font-mono text-xs">{selectedPath}</span>
            ) : (
              <span className="text-muted-foreground">Select workspace folder...</span>
            )}
          </Button>

          {selectedPath && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-left text-xs text-muted-foreground space-y-1">
              <p>This will:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Create <code className="font-mono">project-metadata.sqlite</code> in this folder</li>
                <li>Create a <code className="font-mono">README.md</code> describing the workspace</li>
                <li>Track each subfolder as a project</li>
              </ul>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            size="lg"
            className="w-full h-12 gap-2"
            onClick={handleContinue}
            disabled={!selectedPath || saving}
          >
            {saving ? "Setting up..." : "Get started"}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          You can change this later in the app settings.
        </p>
      </div>
    </div>
  );
}
