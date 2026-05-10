import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Square, Terminal as TerminalIcon, FolderOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivePtySession {
  pty_id: string;
  run_id: string | null;
  folder_key: string | null;
  folder_name: string | null;
  dev_port: number | null;
  repo: string | null;
  production_url: string | null;
  provider: string | null;
  command: string | null;
  cwd: string | null;
  started_at: number | null;
}

interface Props {
  onOpenSession: (session: ActivePtySession) => void;
  onNewShell: () => void;
  onOpenProject?: (folderKey: string) => void;
  onSessionCountChange?: (count: number) => void;
}

export default function TerminalSessions({
  onOpenSession,
  onNewShell,
  onOpenProject,
  onSessionCountChange,
}: Props) {
  const [sessions, setSessions] = useState<ActivePtySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const refresh = async () => {
      try {
        const rows = await invoke<ActivePtySession[]>("list_active_pty_sessions");
        if (!cancelled) {
          setSessions(rows);
          onSessionCountChange?.(rows.length);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    refresh();
    timer = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [onSessionCountChange]);

  const handleStop = async (id: string) => {
    try {
      await invoke("pty_kill", { id });
      setSessions((prev) => {
        const next = prev.filter((s) => s.pty_id !== id);
        onSessionCountChange?.(next.length);
        return next;
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-1 shrink-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <h1 className="text-base font-semibold">Terminal sessions</h1>
        <span className="text-[10px] font-mono text-muted-foreground">
          {sessions.length} active
        </span>
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={onNewShell}>
            <Plus className="h-3.5 w-3.5" />
            New shell
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No active terminal sessions. Start a dev server from a project, or open a new shell.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {sessions.map((s) => (
                <SessionRow
                  key={s.pty_id}
                  session={s}
                  onOpen={() => onOpenSession(s)}
                  onStop={() => handleStop(s.pty_id)}
                  onOpenProject={
                    s.folder_key && onOpenProject
                      ? () => onOpenProject(s.folder_key as string)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SessionRow({
  session: s,
  onOpen,
  onStop,
  onOpenProject,
}: {
  session: ActivePtySession;
  onOpen: () => void;
  onStop: () => void;
  onOpenProject?: () => void;
}) {
  const title = s.folder_name ?? s.pty_id;
  const sub = s.provider ?? (s.pty_id.startsWith("term-") ? "shell" : null);
  const elapsed = s.started_at != null ? formatElapsed(Date.now() - s.started_at) : null;
  const localhostUrl = s.dev_port != null ? `http://localhost:${s.dev_port}` : null;
  const canOpenProjectActions = Boolean(s.folder_key);
  const canOpenRepo = Boolean(s.repo && s.repo.startsWith("http"));
  const canOpenLive = Boolean(s.production_url);

  return (
    <li>
      <div
        className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 hover:bg-accent/40 cursor-pointer"
        onClick={onOpen}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        <TerminalIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {sub && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {sub}
              </span>
            )}
          </div>
          {s.command && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {s.command}
            </p>
          )}
        </div>
        {elapsed && (
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{elapsed}</span>
        )}
        {canOpenProjectActions && s.folder_key && (
          <OpenEditorButtonGroup folderKey={s.folder_key} />
        )}
        {onOpenProject && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProject();
            }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Project
          </Button>
        )}
        {canOpenLive && s.production_url && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              invoke("open_url", { url: s.production_url }).catch(() => {});
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Live site
          </Button>
        )}
        {canOpenRepo && s.repo && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              invoke("open_url", { url: s.repo }).catch(() => {});
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Repo
          </Button>
        )}
        {localhostUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              invoke("open_url", { url: localhostUrl }).catch(() => {});
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            localhost:{s.dev_port}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
        >
          <Square className="h-3.5 w-3.5 fill-destructive text-destructive" />
          Stop
        </Button>
      </div>
    </li>
  );
}

function OpenEditorButtonGroup({ folderKey }: { folderKey: string }) {
  const open = (command: string) => invoke(command, { folderKey }).catch(() => {});
  const launch = (command: string) => invoke(command).catch(() => {});

  return (
    <DropdownMenu>
      <ButtonGroup>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-l-[min(var(--radius-md),12px)]! rounded-r-none! text-xs"
          onClick={(e) => {
            e.stopPropagation();
            open("open_in_cursor");
          }}
        >
          Cursor
        </Button>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-l-none! rounded-r-[min(var(--radius-md),12px)]! border border-input bg-background px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label="Choose editor"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
      </ButtonGroup>
      <DropdownMenuContent align="end" className="w-28">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              open("open_in_finder");
            }}
          >
            Finder
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              open("open_in_warp");
            }}
          >
            Warp
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              open("open_in_terminal");
            }}
          >
            Terminal
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              launch("launch_codex_desktop");
            }}
          >
            Codex
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              launch("launch_claude_desktop");
            }}
          >
            Claude
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
