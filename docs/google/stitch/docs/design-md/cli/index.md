Stitch

Validate with the CLI \| Stitch [Skip to content](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#_top)

[![Stitch logo](https://app-companion-430619.appspot.com/docs/_astro/stitch-word.w5zbZpUZ.svg)![Stitch logo](https://app-companion-430619.appspot.com/docs/_astro/stitch-word-light.CzIMNVVH.svg) Stitch](https://app-companion-430619.appspot.com/docs/)

Search ` CtrlK `

Cancel

Clear

[X](https://x.com/stitchbygoogle)

Select themeDarkLightAuto

- Stitch

  - [Everything you need to know](https://app-companion-430619.appspot.com/docs/learn/overview/)
  - [Effective Prompting](https://app-companion-430619.appspot.com/docs/learn/prompting/)
  - [Device Types](https://app-companion-430619.appspot.com/docs/learn/device-types/)
  - [Design Modes](https://app-companion-430619.appspot.com/docs/learn/design-modes/)
  - [Generate design variations](https://app-companion-430619.appspot.com/docs/learn/variants/)
  - [Controls & Hotkeys](https://app-companion-430619.appspot.com/docs/learn/controls/)

- MCP

  - [Setup & Authentication](https://app-companion-430619.appspot.com/docs/mcp/setup/)
  - [Guide](https://app-companion-430619.appspot.com/docs/mcp/guide/)
  - [Reference](https://app-companion-430619.appspot.com/docs/mcp/reference/)

- SDK

  - [Build your first design](https://app-companion-430619.appspot.com/docs/sdk/tutorial/)
  - [Use with AI SDK](https://app-companion-430619.appspot.com/docs/sdk/ai-sdk/)
  - [Agent-driven workflows](https://app-companion-430619.appspot.com/docs/sdk/agent-workflows/)
  - [How to edit a screen](https://app-companion-430619.appspot.com/docs/sdk/edit-screen/)
  - [How to generate variants](https://app-companion-430619.appspot.com/docs/sdk/generate-variants/)
  - [How to download artifacts](https://app-companion-430619.appspot.com/docs/sdk/download-artifacts/)
  - [How to extract themes](https://app-companion-430619.appspot.com/docs/sdk/extract-themes/)
  - [Reference](https://app-companion-430619.appspot.com/docs/sdk/reference/)
  - [Architecture](https://app-companion-430619.appspot.com/docs/sdk/architecture/)

- DESIGN.md

  - [What is DESIGN.md?](https://app-companion-430619.appspot.com/docs/design-md/overview/)
  - [The specification](https://app-companion-430619.appspot.com/docs/design-md/specification/)
  - [View, edit, and export](https://app-companion-430619.appspot.com/docs/design-md/usage/)
  - [Validate with the CLI](https://app-companion-430619.appspot.com/docs/design-md/cli/)
  - [Linting rules](https://app-companion-430619.appspot.com/docs/design-md/linting-rules/)

[X](https://x.com/stitchbygoogle)

Select themeDarkLightAuto

On this page Overview

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#_top)
- [Install](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#install)
- [Lint a DESIGN.md](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#lint-a-designmd)
- [Compare two versions](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#compare-two-versions)
- [Export tokens](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#export-tokens)
  - [Tailwind CSS](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#tailwind-css)
  - [DTCG (W3C Design Tokens)](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#dtcg-w3c-design-tokens)
- [View the spec](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#view-the-spec)
- [Programmatic API](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#programmatic-api)

## On this page

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#_top)
- [Install](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#install)
- [Lint a DESIGN.md](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#lint-a-designmd)
- [Compare two versions](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#compare-two-versions)
- [Export tokens](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#export-tokens)
  - [Tailwind CSS](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#tailwind-css)
  - [DTCG (W3C Design Tokens)](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#dtcg-w3c-design-tokens)
- [View the spec](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#view-the-spec)
- [Programmatic API](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#programmatic-api)

Learn

# Validate with the CLI

Lint, diff, and export DESIGN.md files using the @google/design.md command-line tool.

The `@google/design.md` CLI validates your design system against the spec, catches broken token references, checks WCAG contrast ratios, and exports tokens to other formats — all as structured JSON that agents can act on.

## Install

[Section titled “Install”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#install)

Terminal window

```
npm install @google/design.md
```

Or run directly without installing:

Terminal window

```
npx @google/design.md lint DESIGN.md
```

All commands accept a file path or `-` for stdin. Output defaults to JSON.

## Lint a DESIGN.md

[Section titled “Lint a DESIGN.md”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#lint-a-designmd)

Validate a DESIGN.md file for structural correctness. The linter parses the YAML front matter, resolves all token references, runs [8 lint rules](https://app-companion-430619.appspot.com/docs/design-md/linting-rules/), and reports findings.

Terminal window

```
npx @google/design.md lint DESIGN.md
```

Example output:

```
{

  "findings": [\
\
    {\
\
      "severity": "warning",\
\
      "path": "colors",\
\
      "message": "No 'primary' color defined. The agent will auto-generate key colors, reducing your control over the palette."\
\
    },\
\
    {\
\
      "severity": "info",\
\
      "message": "Design system defines 4 colors, 3 typography scales, 2 rounding levels."\
\
    }\
\
  ],

  "summary": { "errors": 0, "warnings": 1, "infos": 1 }

}
```

Pipe from stdin if you’re generating DESIGN.md files programmatically:

Terminal window

```
cat DESIGN.md | npx @google/design.md lint -
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | positional | required | Path to DESIGN.md (or `-` for stdin) |
| `--format` | `json` \| `text` | `json` | Output format |

Exit code `1` if errors are found, `0` otherwise.

## Compare two versions

[Section titled “Compare two versions”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#compare-two-versions)

Detect token-level changes between two DESIGN.md files. The `diff` command reports which tokens were added, removed, or modified, and flags regressions (more errors or warnings in the “after” file).

Terminal window

```
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

Example output:

```
{

  "tokens": {

    "colors": { "added": ["accent"], "removed": [], "modified": ["tertiary"] },

    "typography": { "added": [], "removed": [], "modified": [] }

  },

  "findings": {

    "before": { "errors": 0, "warnings": 1 },

    "after": { "errors": 0, "warnings": 2 },

    "delta": { "errors": 0, "warnings": 1 }

  },

  "regression": true

}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `before` | positional | required | Path to the “before” DESIGN.md |
| `after` | positional | required | Path to the “after” DESIGN.md |
| `--format` | `json` \| `text` | `json` | Output format |

Exit code `1` if regressions are detected.

## Export tokens

[Section titled “Export tokens”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#export-tokens)

Convert DESIGN.md tokens to other formats for use in your codebase.

### Tailwind CSS

[Section titled “Tailwind CSS”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#tailwind-css)

Generate a `theme.extend` configuration object:

Terminal window

```
npx @google/design.md export --format tailwind DESIGN.md
```

The output is a JSON object with `colors`, `fontFamily`, `fontSize`, `borderRadius`, and `spacing` mapped from your design tokens. Drop it into your `tailwind.config.js`.

### DTCG (W3C Design Tokens)

[Section titled “DTCG (W3C Design Tokens)”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#dtcg-w3c-design-tokens)

Generate a [W3C Design Tokens Format Module](https://tr.designtokens.org/format/) compliant `tokens.json`:

Terminal window

```
npx @google/design.md export --format dtcg DESIGN.md
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | positional | required | Path to DESIGN.md |
| `--format` | `tailwind` \| `dtcg` | required | Export target format |

## View the spec

[Section titled “View the spec”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#view-the-spec)

Output the DESIGN.md format specification. This is useful for injecting spec context into agent prompts so the agent knows exactly what structure to produce.

Terminal window

```
npx @google/design.md spec

npx @google/design.md spec --rules

npx @google/design.md spec --rules-only --format json
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--rules` | boolean | `false` | Append the active linting rules table |
| `--rules-only` | boolean | `false` | Output only the linting rules table |
| `--format` | `markdown` \| `json` | `markdown` | Output format |

## Programmatic API

[Section titled “Programmatic API”](https://app-companion-430619.appspot.com/docs/design-md/cli/index.html#programmatic-api)

The linter is also available as a TypeScript library:

```
import { lint } from '@google/design.md/linter';

const report = lint(markdownString);

console.log(report.findings);      // Finding[]

console.log(report.summary);       // { errors, warnings, infos }

console.log(report.designSystem);  // Resolved DesignSystemState

console.log(report.tailwindConfig); // Generated Tailwind theme
```

[Previous \\
\\
View, edit, and export](https://app-companion-430619.appspot.com/docs/design-md/usage/) [Next \\
\\
Linting rules](https://app-companion-430619.appspot.com/docs/design-md/linting-rules/)