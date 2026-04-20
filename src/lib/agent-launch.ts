import type { LlmAgent } from "@/types";

function shellQuote(value: string): string {
  if (!value) {
    return "''";
  }

  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildTaskAgentPrompt(title: string, description?: string | null): string {
  const trimmedTitle = title.trim();
  const trimmedDescription = description?.trim();

  if (!trimmedDescription) {
    return trimmedTitle;
  }

  return `Task: ${trimmedTitle}\n\nDescription:\n${trimmedDescription}`;
}

export function buildAgentLaunchCommand(
  agent: LlmAgent,
  prompt: string,
  workingDirectory: string,
): { command: string | null; reason?: string } {
  const provider = agent.provider?.trim().toLowerCase();
  const model = agent.model?.trim();

  if (!provider) {
    return { command: null, reason: "Assigned agent is missing a provider." };
  }

  if (!model) {
    return { command: null, reason: "Assigned agent is missing a model." };
  }

  const quotedPrompt = shellQuote(prompt);
  const quotedWorkingDirectory = shellQuote(workingDirectory);

  if (provider === "codex") {
    const args = ["codex"];
    const config = agent.codex_config;

    args.push("--cd", quotedWorkingDirectory);
    args.push("--model", shellQuote(model));

    if (config?.profile?.trim()) {
      args.push("--profile", shellQuote(config.profile.trim()));
    }
    if (config?.sandbox_mode?.trim()) {
      args.push("--sandbox", shellQuote(config.sandbox_mode.trim()));
    }
    if (config?.approval_policy?.trim()) {
      args.push("--ask-for-approval", shellQuote(config.approval_policy.trim()));
    }
    if (config?.web_search === "live") {
      args.push("--search");
    }
    for (const dir of config?.additional_directories ?? []) {
      if (dir.trim()) {
        args.push("--add-dir", shellQuote(dir.trim()));
      }
    }

    args.push(quotedPrompt);
    return { command: args.join(" ") };
  }

  if (provider === "claude") {
    const args = ["claude"];
    const config = agent.claude_config;
    const instructions = agent.instructions?.trim() ?? agent.system_prompt?.trim();

    args.push("--model", shellQuote(model));

    if (config?.permission_mode?.trim()) {
      args.push("--permission-mode", shellQuote(config.permission_mode.trim()));
    }
    if (instructions) {
      args.push("--append-system-prompt", shellQuote(instructions));
    }

    args.push(quotedPrompt);
    return { command: args.join(" ") };
  }

  if (provider === "cursor") {
    const args = ["cursor", "agent"];
    const config = agent.cursor_config;

    args.push("--workspace", quotedWorkingDirectory);
    args.push("--model", shellQuote(model));

    if (config?.mode === "plan" || config?.mode === "ask") {
      args.push("--mode", shellQuote(config.mode));
    }
    if (config?.sandbox_mode?.trim()) {
      args.push("--sandbox", shellQuote(config.sandbox_mode.trim()));
    }
    if (config?.cloud_mode) {
      args.push("--cloud");
    }
    if (config?.max_mode) {
      args.push("--force");
    }
    if (config?.worktree) {
      args.push("--worktree");
    }

    args.push(quotedPrompt);
    return { command: args.join(" ") };
  }

  return { command: null, reason: `Unsupported agent provider: ${provider}.` };
}
