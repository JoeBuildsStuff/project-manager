import { ArrowLeft, Square, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Terminal from "./Terminal";
import type { ActivePtySession } from "./TerminalSessions";

interface Props {
  session: ActivePtySession;
  onBack: () => void;
  onOpenProject?: (folderKey: string) => void;
}

export default function TerminalSessionPage({ session, onBack, onOpenProject }: Props) {
  const title = session.folder_name ?? session.pty_id;
  const isAttach = !!session.run_id || !session.pty_id.startsWith("term-");

  const handleStop = async () => {
    try {
      await invoke("pty_kill", { id: session.pty_id });
    } catch {
      // ignore
    }
    onBack();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-1 shrink-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-base font-semibold truncate">{title}</h1>
        {session.provider && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {session.provider}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {session.folder_key && onOpenProject && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => onOpenProject(session.folder_key as string)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open project
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleStop}>
            <Square className="h-3.5 w-3.5 fill-destructive text-destructive" />
            Stop
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 m-2 mb-0">
        {isAttach ? (
          <Terminal
            key={session.pty_id}
            attachToPtyId={session.pty_id}
            replayFromRunId={session.run_id ?? undefined}
            workingDirectory={session.cwd ?? undefined}
            hideHeader
          />
        ) : (
          <Terminal key={session.pty_id} sessionId={session.pty_id} hideHeader />
        )}
      </div>
    </div>
  );
}
