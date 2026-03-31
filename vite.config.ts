import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin, Connect } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
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

interface ChatRequestBody {
  message: string;
  messages?: ChatMessage[];
  model?: string;
  reasoningEffort?: string;
  context?: Record<string, unknown> | null;
  clientTz?: string;
  clientOffset?: string;
  clientNowIso?: string;
  clientPath?: string;
  attachments?: AttachmentPayload[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  const json = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Anthropic call
// ─────────────────────────────────────────────────────────────────────────────
async function callAnthropic(body: ChatRequestBody) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in .env");

  const anthropic = new Anthropic({ apiKey });

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
  const history: Anthropic.MessageParam[] = (body.messages || [])
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Build new user message blocks
  const userBlocks: Anthropic.ContentBlockParam[] = [
    { type: "text", text: body.message },
  ];

  for (const att of body.attachments || []) {
    if (att.type.startsWith("image/") && att.base64) {
      const mediaTypeMap: Record<string, string> = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/gif": "image/gif",
        "image/webp": "image/webp",
      };
      const mediaType = mediaTypeMap[att.type] as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp"
        | undefined;
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

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userBlocks },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5,
    },
  ];

  const maxIterations = 5;
  let iteration = 0;
  const allToolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    reasoning?: string;
  }> = [];

  while (iteration < maxIterations) {
    const resp = await anthropic.messages.create({
      model: body.model || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    });

    const stopReason = resp.stop_reason;
    const content = resp.content;

    interface TextBlock { type: "text"; text: string; citations?: unknown[] }
    interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    interface ServerToolUseBlock { type: "server_tool_use"; id: string; name: string; input: Record<string, unknown> }
    interface WebSearchResultBlock { type: "web_search_tool_result"; tool_use_id: string; content: unknown }

    const textBlocks = content.filter((b) => b.type === "text") as TextBlock[];
    const toolUseBlocks = content.filter((b) => b.type === "tool_use") as ToolUseBlock[];
    const serverToolUseBlocks = content.filter((b) => b.type === "server_tool_use") as ServerToolUseBlock[];
    const webSearchResultBlocks = content.filter((b) => b.type === "web_search_tool_result") as WebSearchResultBlock[];

    // Record web search tool calls
    for (const st of serverToolUseBlocks) {
      const result = webSearchResultBlocks.find((r) => r.tool_use_id === st.id);
      allToolCalls.push({
        id: st.id,
        name: st.name,
        arguments: st.input || {},
        result: result ? { success: true, data: result.content } : undefined,
      });
    }

    if (stopReason === "tool_use" || toolUseBlocks.length > 0) {
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tb) => {
          allToolCalls.push({
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
        })
      );
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
        const cits = (tb.citations || []) as Array<{
          type: string;
          url?: string;
          title?: string;
          cited_text?: string;
        }>;
        const webCits = cits.filter((c) => c.type === "web_search_result_location");
        if (webCits.length) {
          const markers: string[] = [];
          for (const c of webCits) {
            citations.push({ url: c.url || "", title: c.title || "", cited_text: c.cited_text || "" });
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
    toolCalls: allToolCalls.length ? allToolCalls : undefined,
    actions: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vite plugin — registers /api/chat* as dev-server middleware
// ─────────────────────────────────────────────────────────────────────────────
function chatApiPlugin(): Plugin {
  return {
    name: "chat-api",
    configureServer(server) {
      const handler: Connect.NextHandleFunction = async (req, res, next) => {
        if (req.method !== "POST") return next();

        let rawBody: string;
        try {
          rawBody = await readBody(req);
        } catch {
          return sendJson(res, 400, { message: "Failed to read request body" });
        }

        let body: ChatRequestBody;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return sendJson(res, 400, { message: "Invalid JSON" });
        }

        if (!body.message || typeof body.message !== "string") {
          return sendJson(res, 400, { message: "Invalid message content" });
        }

        try {
          // NOTE: Vite strips the mount prefix ("/api/chat") from req.url,
          // so /api/chat/cerebras arrives here as /cerebras (or /cerebras?...)
          const url = req.url || "";
          const isCerebras = url === "/cerebras" || url.startsWith("/cerebras?") || url.startsWith("/cerebras/");
          const isOpenAI   = url === "/openai"   || url.startsWith("/openai?")   || url.startsWith("/openai/");
          let result: Awaited<ReturnType<typeof callAnthropic>>;

          if (isCerebras) {
            const cerebrasKey = process.env.CEREBRAS_API_KEY;
            if (!cerebrasKey) {
              result = await callAnthropic({ ...body, model: "claude-haiku-4-5" });
            } else {
              const { Cerebras } = await import("@cerebras/cerebras_cloud_sdk");
              const client = new Cerebras({ apiKey: cerebrasKey });
              const resp = await client.chat.completions.create({
                model: body.model || "llama-4-scout-17b-16e-instruct",
                messages: [
                  {
                    role: "system",
                    content: "You are a helpful assistant integrated into a desktop project manager.",
                  },
                  ...((body.messages || [])
                    .filter((m) => m.role !== "system")
                    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
                  { role: "user", content: body.message },
                ],
                max_tokens: 2048,
              });
              const text =
                (resp.choices[0]?.message?.content as string | undefined) || "Done.";
              result = { message: text, actions: [] };
            }
          } else if (isOpenAI) {
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
              result = await callAnthropic({ ...body, model: "claude-sonnet-4-6" });
            } else {
              const { default: OpenAI } = await import("openai");
              const client = new OpenAI({ apiKey: openaiKey });
              const openaiModel = body.model || "gpt-4o";
              // Newer OpenAI models (gpt-5, o-series) use max_completion_tokens
              const usesMaxCompletionTokens =
                openaiModel.startsWith("o") ||
                openaiModel.startsWith("gpt-5");
              const resp = await client.chat.completions.create({
                model: openaiModel,
                messages: [
                  {
                    role: "system",
                    content: "You are a helpful assistant integrated into a desktop project manager.",
                  },
                  ...((body.messages || [])
                    .filter((m) => m.role !== "system")
                    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))),
                  { role: "user", content: body.message },
                ],
                ...(usesMaxCompletionTokens
                  ? { max_completion_tokens: 2048 }
                  : { max_tokens: 2048 }),
              });
              const text = resp.choices[0]?.message?.content || "Done.";
              result = { message: text, actions: [] };
            }
          } else {
            // Default: Anthropic
            result = await callAnthropic(body);
          }

          sendJson(res, 200, result);
        } catch (error) {
          console.error("[chat-api]", error);
          const message =
            error instanceof Error ? error.message : "Internal error";
          sendJson(res, 500, { message });
        }
      };

      server.middlewares.use("/api/chat", handler);
    },
  };
}

export default defineConfig(async () => ({
  plugins: [tailwindcss(), react(), chatApiPlugin()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
