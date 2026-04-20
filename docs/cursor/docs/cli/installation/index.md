# Installation

## [Installation](https://cursor.com/docs/cli/installation#installation)

### [macOS, Linux and Windows (WSL)](https://cursor.com/docs/cli/installation#macos-linux-and-windows-wsl)

Install Cursor CLI with a single command:

```
curl https://cursor.com/install -fsS | bash
```

### [Windows (native)](https://cursor.com/docs/cli/installation#windows-native)

Install Cursor CLI on Windows using PowerShell:

```
irm 'https://cursor.com/install?win32=true' | iex
```

### [Verification](https://cursor.com/docs/cli/installation#verification)

After installation, verify that Cursor CLI is working correctly:

```
agent --version
```

## [Post-installation setup](https://cursor.com/docs/cli/installation#post-installation-setup)

1. **Add ~/.local/bin to your PATH:**

For bash:

```
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

For zsh:

```
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

1. **Start using Cursor Agent:**

```
agent
```

## [Updates](https://cursor.com/docs/cli/installation#updates)

Cursor CLI will try to auto-update by default to ensure you always have the latest version.

To manually update Cursor CLI to the latest version:

```
agent update
```

