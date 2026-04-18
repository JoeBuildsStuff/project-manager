import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface TerminalProps {
  workingDirectory?: string;
  hideHeader?: boolean;
  sessionId?: string;
}

export default function Terminal({
  workingDirectory,
  hideHeader,
  sessionId,
}: TerminalProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const idRef = useRef<string>(
    sessionId ?? `term-${Math.random().toString(36).slice(2, 10)}`
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      fontFamily: '"Geist Mono", Menlo, monospace',
      fontSize: 13,
      theme: {
        background: "#000000",
        foreground: "#e4e4e7",
        cursor: "#4ade80",
        selectionBackground: "#3f3f46",
      },
      cursorBlink: true,
      scrollback: 10000,
      convertEol: false,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const id = idRef.current;
    let unlistenOutput: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;
    let disposed = false;

    const setup = async () => {
      unlistenOutput = await listen<{ id: string; data: string }>(
        `pty://output/${id}`,
        (e) => term.write(e.payload.data)
      );
      unlistenExit = await listen<{ id: string; code: number | null }>(
        `pty://exit/${id}`,
        (e) => {
          term.write(`\r\n\x1b[90m[process exited${
            e.payload.code != null ? ` with code ${e.payload.code}` : ""
          }]\x1b[0m\r\n`);
        }
      );

      if (disposed) return;

      const { cols, rows } = term;
      try {
        await invoke("pty_start", {
          id,
          cwd: workingDirectory ?? null,
          cols,
          rows,
        });
      } catch (err) {
        term.write(`\x1b[31mfailed to start pty: ${String(err)}\x1b[0m\r\n`);
      }
    };
    setup();

    const disposeData = term.onData((data) => {
      invoke("pty_write", { id, data }).catch(() => {});
    });

    const disposeResize = term.onResize(({ cols, rows }) => {
      invoke("pty_resize", { id, cols, rows }).catch(() => {});
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {}
    });
    ro.observe(container);

    const onFocus = () => term.focus();
    container.addEventListener("click", onFocus);

    return () => {
      disposed = true;
      unlistenOutput?.();
      unlistenExit?.();
      disposeData.dispose();
      disposeResize.dispose();
      ro.disconnect();
      container.removeEventListener("click", onFocus);
      invoke("pty_kill", { id }).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Re-mount pty when workingDirectory changes.
  }, [workingDirectory]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {!hideHeader && (
        <div className="flex shrink-0 items-center gap-2 py-1">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <span className="text-xs text-muted-foreground">Terminal</span>
          {workingDirectory && (
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {workingDirectory}
            </span>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 rounded-lg border border-zinc-700 bg-black p-2 overflow-hidden"
      />
    </div>
  );
}
