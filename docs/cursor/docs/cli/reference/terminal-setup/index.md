# Terminal Setup

Configure your terminal for the best Cursor CLI experience. This guide covers keybindings for multi-line input, Vim mode, and theme synchronization.

## [Quick start](https://cursor.com/docs/cli/reference/terminal-setup#quick-start)

If `Shift+Enter` doesn't work for newlines in your terminal, run `/setup-terminal` for guidance on configuring alternatives:

```
/setup-terminal
```

This command detects your terminal and provides instructions for configuring `Option+EnterAlt+Enter` as an alternative way to insert newlines.

## [Universal options](https://cursor.com/docs/cli/reference/terminal-setup#universal-options)

These methods work in **all terminals**, including tmux, screen, and SSH sessions:


| Method    | Description                                              |
| --------- | -------------------------------------------------------- |
| `\+Enter` | Type a backslash, then press Enter to insert a newline   |
| `Ctrl+J`  | Standard control character for newline (ASCII line feed) |


If you're in tmux or having trouble with other keybindings, `Ctrl+J` is the most reliable option.

## [Terminal support](https://cursor.com/docs/cli/reference/terminal-setup#terminal-support)

### [Native Shift+Enter support](https://cursor.com/docs/cli/reference/terminal-setup#native-shiftenter-support)

These terminals support `Shift+Enter` for newlines out of the box:

- **iTerm2** (macOS)
- **Ghostty**
- **Kitty**
- **Warp**
- **Zed** (integrated terminal)

### [Requires `/setup-terminal](https://cursor.com/docs/cli/reference/terminal-setup#requires-setup-terminal)`

These terminals need `/setup-terminal` to configure `Option+EnterAlt+Enter` for newlines:

- **Apple Terminal** (macOS)
- **Alacritty**
- **VS Code** (integrated terminal)

### [Terminal multiplexers](https://cursor.com/docs/cli/reference/terminal-setup#terminal-multiplexers)

**tmux** and **screen** intercept `Shift+Enter` before it reaches applications. Use the universal options instead:

- `Ctrl+J` — Works reliably in all multiplexer sessions
- `\+Enter` — Also works universally

You can configure your outer terminal (e.g., iTerm2) for `Shift+Enter`, but the keybinding won't pass through tmux. Use the universal options for the most consistent experience.

## [Vim mode](https://cursor.com/docs/cli/reference/terminal-setup#vim-mode)

Enable Vim keybindings for navigation and editing in the CLI input area.

### [Toggle with slash command](https://cursor.com/docs/cli/reference/terminal-setup#toggle-with-slash-command)

```
/vim
```

This toggles Vim mode on or off for the current session and saves the preference.

### [Configure in settings](https://cursor.com/docs/cli/reference/terminal-setup#configure-in-settings)

Add to your `~/.cursor/cli-config.json`:

```
{
  "version": 1,
  "editor": { "vimMode": true },
  "permissions": { "allow": [], "deny": [] }
}
```

### [Modes](https://cursor.com/docs/cli/reference/terminal-setup#modes)

Vim mode uses modal editing:

- **Normal mode** — Navigate and execute commands (default when Vim mode is enabled)
- **Insert mode** — Type text normally

Press `Esc` to return to normal mode from insert mode.

### [Navigation](https://cursor.com/docs/cli/reference/terminal-setup#navigation)


| Key           | Description                                           |
| ------------- | ----------------------------------------------------- |
| `h`, `l`      | Move left / right                                     |
| `j`, `k`      | Move down / up                                        |
| `w`, `b`      | Next / previous word                                  |
| `e`           | End of word                                           |
| `W`, `B`, `E` | Same as above, but for WORD (non-whitespace sequence) |
| `0`, `$`      | Start / end of line                                   |


### [Editing](https://cursor.com/docs/cli/reference/terminal-setup#editing)


| Key        | Description                                 |
| ---------- | ------------------------------------------- |
| `x`        | Delete character under cursor               |
| `X`        | Delete character before cursor              |
| `d` motion | Delete range (e.g., `dw` deletes word)      |
| `dd`       | Delete entire line                          |
| `D`        | Delete to end of line                       |
| `s`        | Substitute character (delete + insert mode) |
| `S`, `cc`  | Change entire line                          |
| `C`        | Change to end of line                       |


### [Entering insert mode](https://cursor.com/docs/cli/reference/terminal-setup#entering-insert-mode)


| Key | Description             |
| --- | ----------------------- |
| `i` | Insert at cursor        |
| `a` | Insert after cursor     |
| `I` | Insert at start of line |
| `A` | Insert at end of line   |
| `o` | Open new line below     |
| `O` | Open new line above     |


### [Counts](https://cursor.com/docs/cli/reference/terminal-setup#counts)

Prefix commands with a number to repeat them. For example, `3w` moves forward 3 words, `2dd` deletes 2 lines.

Vim mode affects the input area only. Navigation through chat history and other UI elements uses standard keybindings.

## [Terminal theme](https://cursor.com/docs/cli/reference/terminal-setup#terminal-theme)

Cursor CLI automatically detects your terminal's color scheme and adapts its appearance.

### [Automatic detection](https://cursor.com/docs/cli/reference/terminal-setup#automatic-detection)

The CLI queries your terminal for its background color using standard escape sequences. Most modern terminals support this:

- **Dark terminals** → CLI uses dark theme
- **Light terminals** → CLI uses light theme

### [Terminals with automatic detection](https://cursor.com/docs/cli/reference/terminal-setup#terminals-with-automatic-detection)

These terminals report their color scheme correctly:

- iTerm2
- Ghostty
- Kitty
- Alacritty
- Apple Terminal
- Windows Terminal
- VS Code integrated terminal

### [Forcing a theme](https://cursor.com/docs/cli/reference/terminal-setup#forcing-a-theme)

If automatic detection doesn't work, you can override it with an environment variable:

```
# Force dark theme
export COLORFGBG="15;0"

# Force light theme
export COLORFGBG="0;15"
```

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.) to make it permanent.

### [Troubleshooting theme issues](https://cursor.com/docs/cli/reference/terminal-setup#troubleshooting-theme-issues)

**Colors look wrong:**

- Ensure your terminal supports 256 colors or true color
- Check that `TERM` is set correctly (e.g., `xterm-256color`)
- Try setting `COLORFGBG` explicitly

**tmux users:**

- Add to your `.tmux.conf` to pass through color detection:

```
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"
```

- Restart tmux after making changes

## [Manual configuration](https://cursor.com/docs/cli/reference/terminal-setup#manual-configuration)

If `/setup-terminal` doesn't work for your terminal, you can manually configure keybindings.

### [Option+Enter for newlines](https://cursor.com/docs/cli/reference/terminal-setup#optionenter-for-newlines)

`Option+EnterAlt+Enter` sends a special escape sequence that Cursor CLI recognizes as a newline. Configure your terminal to send `\x1b\r` (Escape followed by carriage return) when `Option+EnterAlt+Enter` is pressed.

**iTerm2:**

1. Open **Preferences** → **Profiles** → **Keys** → **Key Mappings**
2. Click **+** to add a new mapping
3. Set **Keyboard Shortcut** to `Option+EnterAlt+Enter`
4. Set **Action** to "Send Escape Sequence"
5. Enter `\r` as the escape sequence

**Alacritty:**

Add to your `alacritty.toml`:

```
[keyboard]
bindings = [\
  { key = "Return", mods = "Alt", chars = "\u001b\r" }\
]
```

**Kitty:**

Add to your `kitty.conf`:

```
map alt+enter send_text all \x1b\r
```

### [Shift+Enter](https://cursor.com/docs/cli/reference/terminal-setup#shiftenter)

`Shift+Enter` support depends on your terminal correctly reporting the key modifier. Most modern terminals handle this automatically, but some may need configuration.

**VS Code terminal:**

VS Code's integrated terminal may not pass `Shift+Enter` correctly. Add to your `keybindings.json`:

```
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },\
  "when": "terminalFocus"\
}\
```\
\
## [Troubleshooting](https://cursor.com/docs/cli/reference/terminal-setup\#troubleshooting)\
\
**Keybindings not working:**\
\
- Verify your terminal is detecting the keys correctly using `cat` or `showkey`\
- Check if a terminal multiplexer (tmux/screen) is intercepting the keys\
- Use `Ctrl+J` as a reliable fallback\
\
**tmux users:**\
\
- `Shift+Enter` and `Option+EnterAlt+Enter` won't work through tmux\
- Use `Ctrl+J` or `\+Enter` instead\
- These universal options work everywhere, including nested tmux sessions\
\
**SSH sessions:**\
\
- Remote terminal capabilities depend on your local terminal emulator\
- `Ctrl+J` works reliably over SSH\
- `\+Enter` is another reliable option\
\
## [Summary](https://cursor.com/docs/cli/reference/terminal-setup\#summary)\
\
| Keybinding | Works in | Notes |\
| --- | --- | --- |\
| `Ctrl+J` | All terminals | Most reliable, works everywhere |\
| `\+Enter` | All terminals | Universal alternative |\
| `Shift+Enter` | iTerm2, Ghostty, Kitty, Warp, Zed | Native support, no config needed |\
| `Option+EnterAlt+Enter` | After `/setup-terminal` | Newline alternative for Apple Terminal, Alacritty, VS Code |\
\
```

