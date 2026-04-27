# Cursor CLI

Cursor CLI lets you interact with AI agents directly from your terminal to write, review, and modify code. Whether you prefer an interactive terminal interface or print automation for scripts and CI pipelines, the CLI provides powerful coding assistance right where you work.

## [Getting started](https://cursor.com/docs/cli/overview#getting-started)

```
# Install (macOS, Linux, WSL)curl https://cursor.com/install -fsS | bash# Install (Windows PowerShell)irm 'https://cursor.com/install?win32=true' | iex# Run interactive sessionagent
```

## [Interactive mode](https://cursor.com/docs/cli/overview#interactive-mode)

Start a conversational session with the agent to describe your goals, review proposed changes, and approve commands:

```
# Start interactive sessionagent# Start with initial promptagent "refactor the auth module to use JWT tokens"
```

## [Modes](https://cursor.com/docs/cli/overview#modes)

The CLI supports the same modes as the editor. Switch between modes using slash commands, keyboard shortcuts, or the `--mode` flag.


| Mode      | Description                                                  | Shortcut                                      |
| --------- | ------------------------------------------------------------ | --------------------------------------------- |
| **Agent** | Full access to all tools for complex coding tasks            | Default (no `--mode` value needed)            |
| **Plan**  | Design your approach before coding with clarifying questions | `Shift+Tab`, `/plan`, `--plan`, `--mode=plan` |
| **Ask**   | Read-only exploration without making changes                 | `/ask`, `--mode=ask`                          |


## [Non-interactive mode](https://cursor.com/docs/cli/overview#non-interactive-mode)

Use print mode for non-interactive scenarios like scripts, CI pipelines, or automation:

```
# Run with specific prompt and modelagent -p "find and fix performance issues" --model "gpt-5.2"# Use with git changes included for reviewagent -p "review these changes for security issues" --output-format text
```

## [Cloud Agent handoff](https://cursor.com/docs/cli/overview#cloud-agent-handoff)

Push your conversation to a [Cloud Agent](https://cursor.com/docs/cloud-agent) to continue running while you're away. Prepend `&` to any message, or start a session directly in cloud mode with `-c` / `--cloud`:

```
# Start in cloud modeagent -c "refactor the auth module and add comprehensive tests"# Send a task to Cloud Agent mid-conversation& refactor the auth module and add comprehensive tests
```

Pick up your Cloud Agent tasks on web or mobile at [cursor.com/agents](https://cursor.com/agents).

## [Sessions](https://cursor.com/docs/cli/overview#sessions)

Resume previous conversations to maintain context across multiple interactions:

```
# List all previous chatsagent ls# Resume latest conversationagent resume# Continue the previous sessionagent --continue# Resume specific conversationagent --resume="chat-id-here"
```

## [Sandbox controls](https://cursor.com/docs/cli/overview#sandbox-controls)

Configure command execution settings with `/sandbox` or the `--sandbox <mode>` flag (`enabled` or `disabled`). Toggle sandbox mode on or off and control network access through an interactive menu. Settings persist across sessions.

## [Max Mode](https://cursor.com/docs/cli/overview#max-mode)

Toggle [Max Mode](https://cursor.com/help/ai-features/max-mode) on models that support it using `/max-mode [on|off]`.

## [Sudo password prompting](https://cursor.com/docs/cli/overview#sudo-password-prompting)

Run commands requiring elevated privileges without leaving the CLI. When a command needs `sudo`, Cursor displays a secure, masked password prompt. Your password flows directly to `sudo` via a secure IPC channel; the AI model never sees it.

