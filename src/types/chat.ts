// Re-export all chat types from the store so components can import from @/types/chat
export type {
  ChatMessage,
  ChatAction,
  PageContext,
  ChatSession,
  ChatSessionSummary,
  ToolCall,
} from "@/lib/chat/chat-store";
import type { ChatSession, ChatMessage, PageContext } from "@/lib/chat/chat-store";

export interface ChatContextValue {
  // Session management
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentSession: ChatSession | null;

  // Legacy support - maps to current session
  messages: ChatMessage[];
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  currentContext: PageContext | null;

  // Session actions
  createSession: (title?: string) => string;
  switchToSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  getSessions: () => import("@/lib/chat/chat-store").ChatSessionSummary[];

  // Message actions
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;

  // UI state
  setOpen: (open: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setMaximized: (maximized: boolean) => void;
  toggleChat: () => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;

  // Context
  updatePageContext: (context: PageContext) => void;

  // Utility
  getUnreadCount: () => number;
}

export interface ChatProviderProps {
  children: React.ReactNode;
}

export interface ChatAPIRequest {
  message: string;
  context?: PageContext | null;
  messages?: ChatMessage[];
  model?: string;
  reasoningEffort?: string;
}

export interface ChatAPIResponse {
  message: string;
  reasoning?: string;
  actions?: Array<{
    type: "filter" | "sort" | "navigate" | "create" | "function_call";
    label: string;
    payload: Record<string, unknown>;
  }>;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: {
      success: boolean;
      data?: unknown;
      error?: string;
    };
    reasoning?: string;
  }>;
  citations?: Array<{
    url: string;
    title: string;
    cited_text: string;
  }>;
}
