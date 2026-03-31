// In-memory chat action stubs for Tauri (no Supabase/server needed)
// Messages are stored in the Zustand store (chat-store.ts) with localStorage persistence
import type { Json } from "@/types/supabase";

export type ChatRole = "user" | "assistant" | "system";

export interface CreateSessionParams {
  title?: string;
  context?: Json | null;
}

export async function createChatSession(params: CreateSessionParams = {}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    data: {
      id,
      title: params.title || "New Chat",
      created_at: now,
      updated_at: now,
      context: params.context ?? null,
    },
  };
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  return { data: { id: sessionId, title, updated_at: new Date().toISOString() } };
}

export async function deleteChatSession(_sessionId: string) {
  return { data: { success: true } };
}

export async function listChatSessions() {
  // The store manages sessions locally — return empty so UI reads from store
  return { data: [] };
}

export interface AddMessageParams {
  sessionId: string;
  role: ChatRole;
  content: string;
  parentId?: string | null;
  reasoning?: string | null;
  context?: Json | null;
  functionResult?: Json | null;
  citations?: Json | null;
  rootUserMessageId?: string | null;
  variantGroupId?: string | null;
  variantIndex?: number | null;
}

export async function addChatMessage(_params: AddMessageParams) {
  const id = crypto.randomUUID();
  return { data: { id, created_at: new Date().toISOString() } };
}

export interface AttachmentInput {
  name: string;
  mime_type: string;
  size: number;
  storage_path: string;
}

export async function addChatAttachments(
  _messageId: string,
  _attachments: AttachmentInput[]
) {
  return { data: [] };
}

export interface ToolCallInput {
  name: string;
  arguments: Json;
  result?: Json | null;
  reasoning?: string | null;
}

export async function addChatToolCalls(
  _messageId: string,
  _calls: ToolCallInput[]
) {
  return { data: [] };
}

export interface SuggestedActionInput {
  type: "filter" | "sort" | "navigate" | "create" | "function_call";
  label: string;
  payload: Json;
}

export async function addChatSuggestedActions(
  _messageId: string,
  _actions: SuggestedActionInput[]
) {
  return { data: [] };
}

export async function getChatMessages(_sessionId: string) {
  return { data: [] };
}
