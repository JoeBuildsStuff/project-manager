import { invoke } from "@tauri-apps/api/core";
import type { ChatAPIResponse } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AttachmentPayload {
  name: string;
  type: string;
  size: number;
  base64?: string;
}

export interface ChatRequestBody {
  message: string;
  messages?: ChatMessage[];
  model?: string;
  reasoningEffort?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
  clientTz?: string;
  clientOffset?: string;
  clientNowIso?: string;
  clientPath?: string;
  attachments?: AttachmentPayload[];
}

// Anthropic API types (subset of what we need)
interface AnthropicTextBlock {
  type: "text";
  text: string;
  citations?: Array<{
    type: string;
    url?: string;
    title?: string;
    cited_text?: string;
  }>;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicServerToolUseBlock {
  type: "server_tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicWebSearchResultBlock {
  type: "web_search_tool_result";
  tool_use_id: string;
  content: unknown;
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicServerToolUseBlock
  | AnthropicWebSearchResultBlock;

interface AnthropicResponse {
  stop_reason: string;
  content: AnthropicContentBlock[];
}

interface OpenAIChatResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Send a request through the Rust proxy.
 * The Rust side retrieves the API key from the OS Keychain and injects auth
 * headers — the key never enters JavaScript.
 */
async function llmRequest(
  provider: string,
  body: Record<string, unknown>
): Promise<string> {
  return invoke<string>("llm_request", {
    provider,
    body: JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropic(body: ChatRequestBody): Promise<ChatAPIResponse> {
  let systemPrompt = `You are a helpful assistant integrated into a desktop project manager application. Use the available tools when appropriate to help users with their requests.

Web Search Capabilities:
- You have access to real-time web search for up-to-date information
- Use web search when users ask about current information not in your knowledge base
- Always cite sources from web search results`;

  if (body.clientTz || body.clientOffset || body.clientNowIso) {
    systemPrompt += `\n\nUser Locale Context:\n- Timezone: ${body.clientTz || "unknown"}\n- UTC offset: ${body.clientOffset || "unknown"}\n- Local time: ${body.clientNowIso || "unknown"}`;
  }

  if (body.context) {
    systemPrompt += `\n\nPage Context:\n${JSON.stringify(body.context, null, 2)}`;
  }

  // Map history to Anthropic format
  const history = (body.messages || [])
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Build new user message blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userBlocks: any[] = [{ type: "text", text: body.message }];

  for (const att of body.attachments || []) {
    if (att.type.startsWith("image/") && att.base64) {
      const mediaTypeMap: Record<string, string> = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/gif": "image/gif",
        "image/webp": "image/webp",
      };
      const mediaType = mediaTypeMap[att.type];
      if (mediaType) {
        userBlocks.push({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: att.base64 },
        });
      }
    } else {
      userBlocks.push({
        type: "text",
        text: `\n\nFile attachment: ${att.name} (${att.type}, ${formatFileSize(att.size)})`,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    ...history,
    { role: "user", content: userBlocks },
  ];

  const tools = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    },
  ];

  const maxIterations = 5;
  let iteration = 0;
  const allToolCalls: ChatAPIResponse["toolCalls"] = [];

  while (iteration < maxIterations) {
    const rawResp = await llmRequest("anthropic", {
      model: body.model || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    const resp: AnthropicResponse = JSON.parse(rawResp);
    const stopReason = resp.stop_reason;
    const content = resp.content;

    const textBlocks = content.filter((b): b is AnthropicTextBlock => b.type === "text");
    const toolUseBlocks = content.filter((b): b is AnthropicToolUseBlock => b.type === "tool_use");
    const serverToolUseBlocks = content.filter((b): b is AnthropicServerToolUseBlock => b.type === "server_tool_use");
    const webSearchResultBlocks = content.filter((b): b is AnthropicWebSearchResultBlock => b.type === "web_search_tool_result");

    // Record web search tool calls
    for (const st of serverToolUseBlocks) {
      const result = webSearchResultBlocks.find((r) => r.tool_use_id === st.id);
      allToolCalls!.push({
        id: st.id,
        name: st.name,
        arguments: st.input || {},
        result: result ? { success: true, data: result.content } : undefined,
      });
    }

    if (stopReason === "tool_use" || toolUseBlocks.length > 0) {
      const toolResults = toolUseBlocks.map((tb) => {
        allToolCalls!.push({
          id: tb.id,
          name: tb.name,
          arguments: tb.input,
          result: { success: false, error: "Tool not implemented in desktop mode" },
        });
        return {
          type: "tool_result" as const,
          tool_use_id: tb.id,
          content: "Tool execution not supported in desktop mode",
        };
      });
      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: toolResults });
      iteration++;
      continue;
    }

    if (stopReason === "pause_turn") {
      messages.push({ role: "assistant", content });
      iteration++;
      continue;
    }

    // Terminal — build response
    const citations: Array<{ url: string; title: string; cited_text: string }> = [];
    const messageText = textBlocks
      .map((tb) => {
        let text = tb.text || "";
        const cits = tb.citations || [];
        const webCits = cits.filter((c) => c.type === "web_search_result_location");
        if (webCits.length) {
          const markers: string[] = [];
          for (const c of webCits) {
            citations.push({
              url: c.url || "",
              title: c.title || "",
              cited_text: c.cited_text || "",
            });
            markers.push(`[${citations.length}]`);
          }
          text += markers.join("");
        }
        return text;
      })
      .join("")
      .trim();

    return {
      message: messageText || "Done.",
      toolCalls: allToolCalls.length ? allToolCalls : undefined,
      citations: citations.length ? citations : undefined,
      actions: [],
    };
  }

  return {
    message: "Could not complete the request within the tool-call limit.",
    toolCalls: allToolCalls!.length ? allToolCalls : undefined,
    actions: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cerebras
// ─────────────────────────────────────────────────────────────────────────────

async function callCerebras(body: ChatRequestBody): Promise<ChatAPIResponse> {
  const rawResp = await llmRequest(
    "cerebras",
    {
      model: body.model || "llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant integrated into a desktop project manager.",
        },
        ...(body.messages || [])
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: body.message },
      ],
      max_tokens: 2048,
    }
  );

  const resp: OpenAIChatResponse = JSON.parse(rawResp);
  const text = resp.choices[0]?.message?.content || "Done.";
  return { message: text, actions: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(body: ChatRequestBody): Promise<ChatAPIResponse> {
  const openaiModel = body.model || "gpt-4o";
  const usesMaxCompletionTokens =
    openaiModel.startsWith("o") || openaiModel.startsWith("gpt-5");

  const rawResp = await llmRequest(
    "openai",
    {
      model: openaiModel,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant integrated into a desktop project manager.",
        },
        ...(body.messages || [])
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: body.message },
      ],
      ...(usesMaxCompletionTokens
        ? { max_completion_tokens: 2048 }
        : { max_tokens: 2048 }),
    }
  );

  const resp: OpenAIChatResponse = JSON.parse(rawResp);
  const text = resp.choices[0]?.message?.content || "Done.";
  return { message: text, actions: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — single entry point for the chat hook
// ─────────────────────────────────────────────────────────────────────────────

export async function sendChatRequest(body: ChatRequestBody): Promise<ChatAPIResponse> {
  const model = body.model || "";
  const isCerebras = model.startsWith("gpt-oss-120b");
  const isOpenAI = model.startsWith("gpt-5") || model.startsWith("gpt-4o") || model.startsWith("o");

  if (isCerebras) {
    return callCerebras(body);
  } else if (isOpenAI) {
    return callOpenAI(body);
  } else {
    return callAnthropic(body);
  }
}
