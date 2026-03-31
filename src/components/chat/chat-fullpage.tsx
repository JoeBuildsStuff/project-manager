import { useChatStore } from "@/lib/chat/chat-store";
import { useChat } from "@/hooks/use-chat";
import { ChatMessagesList } from "@/components/chat/chat-messages-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { PictureInPicture2, PanelRight, LaptopMinimal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatFullPage() {
  const { setLayoutMode } = useChatStore();

  const { handleActionClick } = useChat({
    onActionClick: (action) => {
      switch (action.type) {
        case "create":
          toast.success(`Action: ${action.label}`);
          break;
        case "function_call":
          toast.success(`Executed: ${action.label}`);
          break;
        default:
          console.log("Action:", action);
      }
    },
  });

  return (
    <div className="h-full flex flex-col relative">
      {/* Layout mode toggle */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-background/95 backdrop-blur border rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setLayoutMode("floating")}
          title="Floating mode"
        >
          <PictureInPicture2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setLayoutMode("inset")}
          title="Inset mode"
        >
          <PanelRight className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 w-7 p-0"
          title="Full page mode"
        >
          <LaptopMinimal className="size-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full">
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-full">
            <ChatMessagesList onActionClick={handleActionClick} />
          </ScrollArea>
        </div>
        <div>
          <ChatInput />
        </div>
      </div>
    </div>
  );
}
