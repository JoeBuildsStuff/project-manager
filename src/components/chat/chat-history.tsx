import { formatDistanceToNow } from "date-fns";
import { ChevronRight, MessagesSquare, SquarePen, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/lib/chat/chat-store";
import { cn } from "@/lib/utils";

export function ChatHistory() {
  const {
    currentSessionId,
    setShowHistory,
    createSession,
    deleteSession,
    switchToSession,
    getSessions,
  } = useChatStore();

  const sessions = getSessions();

  const handleSessionClick = (sessionId: string) => {
    switchToSession(sessionId);
    setShowHistory(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const handleNewChat = () => {
    createSession();
    setShowHistory(false);
  };

  const handleBackToChat = () => {
    setShowHistory(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-tl-xl"
            onClick={handleNewChat}
            title="New chat"
          >
            <SquarePen className="size-4" strokeWidth={1} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-tr-xl"
            onClick={handleBackToChat}
            title="Back to current chat"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessagesSquare
                className="size-8 text-muted-foreground mb-2"
                strokeWidth={1}
              />
              <p className="text-sm text-muted-foreground mb-4 font-light">
                No chat history yet
              </p>
              <Button
                className="flex items-center"
                variant="outline"
                size="sm"
                onClick={handleNewChat}
              >
                <span className="font-light">Start chat</span>
                <ChevronRight className="size-4" strokeWidth={1} />
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex flex-col p-2 rounded-lg cursor-pointer overflow-hidden",
                    "hover:bg-accent/50 transition-colors",
                    "border border-transparent",
                    session.id === currentSessionId && "bg-accent border-border"
                  )}
                  onClick={() => handleSessionClick(session.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden justify-between">
                    <h3
                      className={cn(
                        "flex font-medium text-sm overflow-hidden text-ellipsis whitespace-nowrap",
                        session.id === currentSessionId &&
                          "text-accent-foreground"
                      )}
                    >
                      {session.title.slice(0, 20)}
                    </h3>
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span>
                      {session.messageCount} message
                      {session.messageCount !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {formatDistanceToNow(session.updatedAt, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
