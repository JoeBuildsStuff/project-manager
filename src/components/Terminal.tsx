import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HistoryEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface TerminalOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
}

export default function Terminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [_cmdHistoryIndex, setCmdHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, running]);

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setRunning(true);
    setCmdHistory((prev) => [trimmed, ...prev]);
    setCmdHistoryIndex(-1);

    try {
      const result = await invoke<TerminalOutput>("execute_terminal_command", { command: trimmed });
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exit_code,
        },
      ]);
    } catch (e) {
      setHistory((prev) => [
        ...prev,
        { command: trimmed, stdout: "", stderr: String(e), exitCode: -1 },
      ]);
    } finally {
      setRunning(false);
      setInput("");
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCmdHistoryIndex((prev) => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        setInput(cmdHistory[next] ?? "");
        return next;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCmdHistoryIndex((prev) => {
        const next = prev - 1;
        if (next < 0) {
          setInput("");
          return -1;
        }
        setInput(cmdHistory[next] ?? "");
        return next;
      });
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2 py-1">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <span className="text-xs text-muted-foreground">Terminal</span>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-700 bg-black font-mono text-sm text-green-400 overflow-hidden"
        onClick={() => inputRef.current?.focus()}
      >
      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 && (
          <div className="text-zinc-500 text-xs">
            Terminal ready. Type a command and press Enter. Ctrl+L to clear.
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 select-none">$</span>
              <span className="text-white">{entry.command}</span>
              {entry.exitCode !== 0 && (
                <span className="text-red-500 text-xs ml-auto">[{entry.exitCode}]</span>
              )}
            </div>
            {entry.stdout && (
              <pre className="whitespace-pre-wrap text-green-300 pl-4 leading-relaxed">
                {entry.stdout}
              </pre>
            )}
            {entry.stderr && (
              <pre className="whitespace-pre-wrap text-red-400 pl-4 leading-relaxed">
                {entry.stderr}
              </pre>
            )}
          </div>
        ))}
        {running && (
          <div className="text-zinc-500 animate-pulse text-xs">running...</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 border-t border-zinc-700 px-4 py-2 bg-zinc-900">
        <span className="text-blue-400 select-none shrink-0">$</span>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          className="flex-1 bg-transparent outline-none text-white placeholder:text-zinc-600 caret-green-400"
          placeholder="enter command..."
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
      </div>
    </div>
  );
}
