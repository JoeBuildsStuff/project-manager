"use client";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/chat/chat-store";
import { cn } from "@/lib/utils";
import { MessagesSquare, GalleryVerticalEnd, X } from "lucide-react";

export function ChatFooterBar() {
  const {
    isOpen,
    isMinimized,
    setOpen,
    setMinimized,
    setMaximized,
    layoutMode,
    setLayoutMode,
    sessions,
    switchToSession,
    setShowHistory,
    currentSessionId,
    openSessionIds,
    openSessionTab,
    closeSessionTab,
    createSession,
  } = useChatStore();

  const handleAskPM = () => {
    // Always create a new chat — it won't appear in footer until first message generates a title
    createSession();
    if (layoutMode === "inset") {
      setLayoutMode("inset");
    } else {
      setOpen(true);
      setMinimized(false);
      setMaximized(false);
    }
    setShowHistory(false);
  };

  const handleOpenSession = (sessionId: string) => {
    switchToSession(sessionId);
    openSessionTab(sessionId);
    setShowHistory(false);
    if (!isOpen || isMinimized) {
      if (layoutMode === "inset") {
        setLayoutMode("inset");
      } else {
        setOpen(true);
        setMinimized(false);
        setMaximized(false);
      }
    }
  };

  const handleCloseTab = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    closeSessionTab(sessionId);
  };

  const handleToggleHistory = () => {
    if (!isOpen || isMinimized) {
      setOpen(true);
      setMinimized(false);
      setMaximized(false);
      setShowHistory(true);
    } else {
      setShowHistory(true);
    }
  };

  if (layoutMode === "fullpage") {
    return null;
  }

  // Resolve open session IDs to actual session data, filtering out deleted ones
  const openSessions = openSessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => s != null);

  return (
    <div className="shrink-0 flex items-center justify-end bg-background z-50">
      <div className="flex items-center gap-0.5 pr-3 py-0.5">
        {/* Open chat tabs - expand leftward from Ask PM */}
        {openSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => handleOpenSession(session.id)}
            className={cn(
              "group relative h-6 px-2.5 text-xs rounded-md",
              "hover:bg-accent transition-colors",
              "max-w-[160px]",
              "flex items-center gap-1.5 cursor-pointer",
              session.id === currentSessionId && isOpen && !isMinimized
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <span className="truncate">{session.title.slice(0, 20)}</span>
            <X
              className="absolute right-2 size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground hover:bg-background"
              onClick={(e) => handleCloseTab(e, session.id)}
            />
          </button>
        ))}

        {/* Ask PM button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={handleAskPM}
        >
          <MessagesSquare className="size-3.5" />
          Ask PM
        </Button>

        {/* History button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleToggleHistory}
          title="Chat history"
        >
          <GalleryVerticalEnd className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
