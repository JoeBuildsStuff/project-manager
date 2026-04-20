# Configuration

Configure the Agent CLI using the `cli-config.json` file.

## [File location](https://cursor.com/docs/cli/reference/configuration#file-location)


| Type    | Platform    | Path                                       |
| ------- | ----------- | ------------------------------------------ |
| Global  | macOS/Linux | `~/.cursor/cli-config.json`                |
| Global  | Windows     | `$env:USERPROFILE\.cursor\cli-config.json` |
| Project | All         | `<project>/.cursor/cli.json`               |


Only permissions can be configured at the project level. All other CLI
settings must be set globally.

Override with environment variables:

- `**CURSOR_CONFIG_DIR**`: custom directory path
- `**XDG_CONFIG_HOME**` (Linux/BSD): uses `$XDG_CONFIG_HOME/cursor/cli-config.json`

## [Schema](https://cursor.com/docs/cli/reference/configuration#schema)

### [Required fields](https://cursor.com/docs/cli/reference/configuration#required-fields)


| Field               | Type    | Description                                                                                 |
| ------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `version`           | number  | Config schema version (current: `1`)                                                        |
| `editor.vimMode`    | boolean | Enable Vim keybindings (default: `false`)                                                   |
| `permissions.allow` | string  | Permitted operations (see [Permissions](https://cursor.com/docs/cli/reference/permissions)) |
| `permissions.deny`  | string  | Forbidden operations (see [Permissions](https://cursor.com/docs/cli/reference/permissions)) |


### [Optional fields](https://cursor.com/docs/cli/reference/configuration#optional-fields)


| Field                                 | Type    | Description                                                             |
| ------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `model`                               | object  | Selected model configuration                                            |
| `hasChangedDefaultModel`              | boolean | CLI-managed model override flag                                         |
| `network.useHttp1ForAgent`            | boolean | Use HTTP/1.1 instead of HTTP/2 for agent connections (default: `false`) |
| `attribution.attributeCommitsToAgent` | boolean | Add "Made with Cursor" trailer to Agent commits (default: `true`)       |
| `attribution.attributePRsToAgent`     | boolean | Add "Made with Cursor" footer to Agent PRs (default: `true`)            |


## [Examples](https://cursor.com/docs/cli/reference/configuration#examples)

### [Minimal config](https://cursor.com/docs/cli/reference/configuration#minimal-config)

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": { "allow": ["Shell(ls)"], "deny": [] }
}
```

### [Enable Vim mode](https://cursor.com/docs/cli/reference/configuration#enable-vim-mode)

```
{
  "version": 1,
  "editor": { "vimMode": true },
  "permissions": { "allow": ["Shell(ls)"], "deny": [] }
}
```

### [Configure permissions](https://cursor.com/docs/cli/reference/configuration#configure-permissions)

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": {
    "allow": ["Shell(ls)", "Shell(echo)"],
    "deny": ["Shell(rm)"]
  }
}
```

See [Permissions](https://cursor.com/docs/cli/reference/permissions) for available permission types and examples.

## [Troubleshooting](https://cursor.com/docs/cli/reference/configuration#troubleshooting)

**Config errors**: Move the file aside and restart:

```
mv ~/.cursor/cli-config.json ~/.cursor/cli-config.json.bad
```

**Changes don't persist**: Ensure valid JSON and write permissions. Some fields are CLI-managed and may be overwritten.

## [Notes](https://cursor.com/docs/cli/reference/configuration#notes)

- Pure JSON format (no comments)
- CLI performs self-repair for missing fields
- Corrupted files are backed up as `.bad` and recreated
- Permission entries are exact strings (see [Permissions](https://cursor.com/docs/cli/reference/permissions) for details)

## [Models](https://cursor.com/docs/cli/reference/configuration#models)

You can select a model for the CLI using the `/model` slash command.

```
/model auto
/model gpt-5.2
/model sonnet-4.5-thinking
```

See the [Slash commands](https://cursor.com/docs/cli/reference/slash-commands) docs for other commands.

## [Proxy configuration](https://cursor.com/docs/cli/reference/configuration#proxy-configuration)

If your network routes traffic through a proxy server, configure the CLI using environment variables and the config file.

### [Environment variables](https://cursor.com/docs/cli/reference/configuration#environment-variables)

Set these environment variables before running the CLI:

```
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
export NODE_USE_ENV_PROXY=1
```

If your proxy performs SSL inspection (man-in-the-middle), also trust your organization's CA certificate:

```
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca-cert.pem
```

### [HTTP/1.1 fallback](https://cursor.com/docs/cli/reference/configuration#http11-fallback)

Some enterprise proxies (like Zscaler) don't support HTTP/2 bidirectional streaming. Enable HTTP/1.1 mode in your config:

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": { "allow": [], "deny": [] },
  "network": {
    "useHttp1ForAgent": true
  }
}
```

This switches agent connections to HTTP/1.1 with Server-Sent Events (SSE), which works with most corporate proxies.

See [Network Configuration](https://cursor.com/docs/enterprise/network-configuration) for proxy testing commands and troubleshooting.

