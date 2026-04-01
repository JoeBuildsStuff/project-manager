import { useChatStore } from "@/lib/chat/chat-store";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessagesList } from "@/components/chat/chat-messages-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatHistory } from "@/components/chat/chat-history";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function ChatPanel() {
  const { isOpen, isMinimized, isMaximized, showHistory } = useChatStore();

  const { handleActionClick } = useChat({
    onActionClick: (action) => {
      switch (action.type) {
        case "filter":
        case "sort":
        case "navigate":
          // In Tauri there's no router — just notify via toast
          toast.info(`Action: ${action.label}`);
          break;
        case "create":
          toast.success(`Action: ${action.label}`);
          break;
        case "function_call":
          toast.success(`Executed: ${action.label}`);
          break;
        default:
          console.log("Unknown action type:", action);
      }
    },
  });

  if (!isOpen || isMinimized) {
    return null;
  }

  return (
    <div
      className={cn(
        "z-40 bg-background border border-border flex flex-col transition-all duration-300 ease-in-out",
        isMaximized && [
          "fixed top-0 right-0 h-full w-96",
          "border-l border-t-0 border-r-0 border-b-0 rounded-none",
        ],
        !isMaximized && [
          "fixed bottom-8 right-2",
          "w-full sm:w-96 h-full sm:h-[600px]",
          "rounded-3xl shadow-2xl",
        ]
      )}
    >
      {showHistory ? (
        <ChatHistory />
      ) : (
        <>
          <ChatHeader />
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 h-full">
              <div className="p-3">
                <ChatMessagesList onActionClick={handleActionClick} />
              </div>
            </ScrollArea>
          </div>
          <div className="bg-transparent">
            <ChatInput />
          </div>
        </>
      )}
    </div>
  );
}
