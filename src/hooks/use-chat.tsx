import { useCallback, useMemo } from "react";
import { useChatStore } from "@/lib/chat/chat-store";
import { toast } from "sonner";
import type { ChatAction, PageContext } from "@/types/chat";
import type { Attachment } from "@/components/chat/chat-input";

interface ToolCallResponse {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
  reasoning?: string;
}

interface UseChatProps {
  onSendMessage?: (message: string, attachments?: Attachment[]) => Promise<void>;
  onActionClick?: (action: ChatAction) => void;
}

export function useChat({ onSendMessage, onActionClick }: UseChatProps = {}) {
  const {
    messages,
    isOpen,
    isMinimized,
    isLoading,
    currentContext,
    currentSessionId,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    setOpen,
    setMinimized,
    setLoading,
    toggleChat,
    updatePageContext,
    createSession,
  } = useChatStore();

  // Ensure a local session exists
  const ensureSession = useCallback((): string => {
    if (currentSessionId) return currentSessionId;
    return createSession();
  }, [currentSessionId, createSession]);

  // Call /api/chat (handled by Vite middleware in dev, Tauri command in prod)
  const sendToAPI = useCallback(
    async (
      content: string,
      context: PageContext | null,
      attachments?: Attachment[],
      model?: string,
      reasoningEffort?: string
    ) => {
      const { messages: latestMessages } = useChatStore.getState();

      // Determine endpoint from model
      const isCerebras = model?.startsWith("gpt-oss-120b");
      const isOpenAI = model?.startsWith("gpt-5");
      const endpoint = isCerebras
        ? "/api/chat/cerebras"
        : isOpenAI
        ? "/api/chat/openai"
        : "/api/chat";

      const body: Record<string, unknown> = {
        message: content,
        context,
        messages: latestMessages.slice(-10),
        model,
        reasoningEffort,
      };

      // Timezone context
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const offsetMinutes = new Date().getTimezoneOffset();
        const sign = offsetMinutes <= 0 ? "+" : "-";
        const abs = Math.abs(offsetMinutes);
        const hh = String(Math.floor(abs / 60)).padStart(2, "0");
        const mm = String(abs % 60).padStart(2, "0");
        body.clientTz = tz;
        body.clientOffset = `${sign}${hh}:${mm}`;
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        body.clientNowIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${body.clientOffset}`;
        body.clientPath = window.location.pathname || "";
      } catch {}

      // Include attachments as base64 for images (file uploads not supported in Tauri without backend)
      if (attachments && attachments.length > 0) {
        const encodedAttachments = await Promise.all(
          attachments.map(async (a) => {
            if (a.type.startsWith("image/")) {
              const buf = await a.file.arrayBuffer();
              const base64 = btoa(
                new Uint8Array(buf).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ""
                )
              );
              return { name: a.name, type: a.type, size: a.size, base64 };
            }
            return { name: a.name, type: a.type, size: a.size };
          })
        );
        body.attachments = encodedAttachments;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Add assistant message directly to the store
      addMessage({
        role: "assistant",
        content:
          result.message || "I apologize, but I couldn't generate a response.",
        reasoning: result.reasoning || undefined,
        suggestedActions: result.actions || [],
        toolCalls: result.toolCalls?.map((t: ToolCallResponse) => ({
          id: t.id || crypto.randomUUID(),
          name: t.name,
          arguments: t.arguments,
          result: t.result,
          reasoning: t.reasoning,
        })),
        citations: result.citations || undefined,
      });
    },
    [addMessage]
  );

  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: Attachment[],
      model?: string,
      reasoningEffort?: string,
      options?: { skipUserAdd?: boolean }
    ) => {
      if (
        (!content.trim() && (!attachments || attachments.length === 0)) ||
        isLoading
      )
        return;

      ensureSession();

      // Optimistically add user message
      if (!options?.skipUserAdd) {
        const trimmed = content.trim() || "Sent with attachments";
        const localAttachments = (attachments || []).map((a) => ({
          id: crypto.randomUUID(),
          name: a.name,
          size: a.size,
          type: a.type,
          data: a.type.startsWith("image/")
            ? URL.createObjectURL(a.file)
            : undefined,
        }));
        addMessage({
          role: "user",
          content: trimmed,
          attachments: localAttachments,
          context: currentContext
            ? {
                filters: currentContext.currentFilters,
                data: { totalCount: currentContext.totalCount },
              }
            : undefined,
        });
        setLoading(true);
      }

      if (options?.skipUserAdd) setLoading(true);

      try {
        if (onSendMessage) {
          await onSendMessage(content, attachments);
        } else {
          await sendToAPI(
            content,
            currentContext,
            attachments,
            model,
            reasoningEffort
          );
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        const description =
          error instanceof Error ? error.message : "Please try again.";
        toast.error("Unable to complete chat request", { description });
        addMessage({
          role: "assistant",
          content:
            "Sorry, I encountered an error while processing your message. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      currentContext,
      ensureSession,
      onSendMessage,
      isLoading,
      setLoading,
      sendToAPI,
      addMessage,
    ]
  );

  const handleActionClick = useCallback(
    (action: ChatAction) => {
      if (onActionClick) {
        onActionClick(action);
      } else {
        console.log("Action clicked:", action);
        addMessage({
          role: "system",
          content: `Action executed: ${action.label}`,
        });
      }
    },
    [onActionClick, addMessage]
  );

  const getUnreadCount = useCallback(() => {
    if (isOpen) return 0;
    return 0;
  }, [isOpen]);

  const chatState = useMemo(
    () => ({
      isEmpty: messages.length === 0,
      hasMessages: messages.length > 0,
      lastMessage: messages[messages.length - 1] || null,
      messageCount: messages.length,
      isTyping: isLoading,
    }),
    [messages, isLoading]
  );

  const contextInfo = useMemo(() => {
    if (!currentContext) {
      return {
        hasContext: false,
        pageDescription: "No page context available",
        summary: "Unable to determine current page context",
      };
    }
    const { totalCount, currentFilters, currentSort } = currentContext;
    const hasFilters =
      ((currentFilters as Record<string, unknown>)?.activeFiltersCount as number) > 0;
    const hasSorting =
      ((currentSort as Record<string, unknown>)?.activeSortsCount as number) > 0;
    return {
      hasContext: true,
      pageDescription: "Current data view",
      summary: `Viewing ${totalCount} items${hasFilters ? " (filtered)" : ""}${hasSorting ? " (sorted)" : ""}`,
      hasFilters,
      hasSorting,
      dataCount: totalCount,
      visibleCount: currentContext.visibleData.length,
    };
  }, [currentContext]);

  return {
    messages,
    isOpen,
    isMinimized,
    isLoading,
    currentContext,
    chatState,
    contextInfo,

    sendMessage,
    addMessage,
    updateMessage,
    deleteMessage,
    clearMessages,
    handleActionClick,

    setOpen,
    setMinimized,
    toggleChat,
    openChat: () => setOpen(true),
    closeChat: () => setOpen(false),
    minimizeChat: () => setMinimized(true),
    maximizeChat: () => setMinimized(false),

    updatePageContext,
    getUnreadCount,
    hasUnread: getUnreadCount() > 0,

    clearAndClose: () => {
      clearMessages();
      setOpen(false);
    },

    canSendMessage: (content: string) => {
      return content.trim().length > 0 && !isLoading;
    },

    getContextSummary: () => {
      if (!currentContext) return null;
      const { totalCount, currentFilters, currentSort } = currentContext;
      const hasFilters =
        ((currentFilters as Record<string, unknown>)?.activeFiltersCount as number) > 0;
      const hasSorting =
        ((currentSort as Record<string, unknown>)?.activeSortsCount as number) > 0;
      let summary = `${totalCount} items`;
      if (hasFilters) summary += " (filtered)";
      if (hasSorting) summary += " (sorted)";
      return summary;
    },

    getSuggestedPrompts: () => {
      if (!currentContext) return [];
      const { totalCount } = currentContext;
      if (!totalCount) {
        return [
          "Why are there no items?",
          "How can I add a new item?",
          "Show me how to import items",
        ];
      }
      return [
        "Filter items by status",
        "Show me recent items",
        "Sort items by priority",
      ];
    },
  };
}
