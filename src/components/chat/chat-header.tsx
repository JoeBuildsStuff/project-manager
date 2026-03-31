import {
  MessageSquareOff,
  SquarePen,
  Ellipsis,
  PanelRight,
  PictureInPicture2,
  LaptopMinimal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/lib/chat/chat-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useState, useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Download } from "lucide-react";
import { X } from "lucide-react";

export function ChatHeader() {
  const {
    setOpen,
    setMinimized,
    clearMessages,
    setShowHistory,
    currentSession,
    updateSessionTitle,
    layoutMode,
    setLayoutMode,
    createSession,
  } = useChatStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  const handleClearChat = () => {
    if (isConfirmingClear) {
      clearMessages();
      setIsConfirmingClear(false);
    } else {
      setIsConfirmingClear(true);
      // Reset confirmation after 3 seconds
      setTimeout(() => {
        setIsConfirmingClear(false);
      }, 3000);
    }
  };

  const handleNewChat = () => {
    createSession();
  };

  const handleDownloadChat = () => {
    console.log("Download chat");
  };

  const handleShowHistory = () => {
    setShowHistory(true);
  };

  const handleLayoutChange = (mode: "floating" | "inset" | "fullpage") => {
    // fullpage mode not supported in Tauri — treat it as inset
    setLayoutMode(mode === "fullpage" ? "inset" : mode);
  };

  const handleTitleClick = () => {
    if (currentSession) {
      setEditTitle(currentSession.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleSubmit = () => {
    if (currentSession && editTitle.trim()) {
      updateSessionTitle(currentSession.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setEditTitle("");
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSubmit();
    } else if (e.key === "Escape") {
      handleTitleCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "p-2 border-b",
        "rounded-t-xl"
      )}
    >
      {/* Left section - Navigate to historical chats */}
      <div className="flex items-center flex-1 min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0 rounded-tl-xl"
          onClick={handleShowHistory}
          title="View chat history"
        >
          <ChevronLeft />
        </Button>

        {/* Chat Title */}
        <div className="flex-1 min-w-0 ml-2">
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="h-7 text-sm font-medium border-none shadow-none px-1 py-0 focus-visible:ring-0 focus-visible:border-none bg-transparent"
              placeholder="Enter chat title..."
            />
          ) : (
            <Button
              variant="ghost"
              onClick={handleTitleClick}
              className="h-7 w-full justify-start text-left truncate text-sm font-medium px-1 py-0 hover:bg-muted/50"
              title={currentSession?.title || "New Chat"}
            >
              {currentSession?.title || "New Chat"}
            </Button>
          )}
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center space-x-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="More actions"
            >
              <Ellipsis className="size-4 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleNewChat}>
                <SquarePen className="mr-2 size-4" />
                New chat
                <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadChat}>
                <Download className="mr-2 size-4" />
                Download chat
                <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {layoutMode === "inset" ? (
                    <>
                      <PanelRight className="mr-2 size-4 text-muted-foreground" />
                      Inset
                    </>
                  ) : layoutMode === "fullpage" ? (
                    <>
                      <LaptopMinimal className="mr-2 size-4 text-muted-foreground" />
                      Full Page
                    </>
                  ) : (
                    <>
                      <PictureInPicture2 className="mr-2 size-4 text-muted-foreground" />
                      Floating
                    </>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={layoutMode}
                      onValueChange={(value) =>
                        handleLayoutChange(
                          value as "floating" | "inset" | "fullpage"
                        )
                      }
                    >
                      <DropdownMenuRadioItem value="inset">
                        <PanelRight className="size-4 shrink-0 text-muted-foreground" />
                        Inset
                        <DropdownMenuShortcut>⌘↑</DropdownMenuShortcut>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="floating">
                        <PictureInPicture2 className="size-4 shrink-0 text-muted-foreground" />
                        Floating
                        <DropdownMenuShortcut>⌘↓</DropdownMenuShortcut>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="fullpage">
                        <LaptopMinimal className="size-4 shrink-0 text-muted-foreground" />
                        Full Page
                        <DropdownMenuShortcut>⌘F</DropdownMenuShortcut>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleClearChat}
                onSelect={(e) => {
                  if (!isConfirmingClear) {
                    e.preventDefault();
                  }
                }}
              >
                <MessageSquareOff className="mr-2 size-4" />
                {isConfirmingClear ? "Confirm" : "Clear"}
                {/* <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut> */}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-tr-xl"
          onClick={handleClose}
          title="Close"
        >
          <X className="size-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}
