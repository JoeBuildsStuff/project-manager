Stitch

What is DESIGN.md? \| Stitch [Skip to content](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#_top)

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

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#_top)
- [What it gives you](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#what-it-gives-you)
- [The philosophy](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#the-philosophy)
- [How they’re created](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#how-theyre-created)
  - [Let the agent generate it](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#let-the-agent-generate-it)
  - [Derive from branding](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#derive-from-branding)
  - [Write it by hand](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#write-it-by-hand)
- [Example](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#example)

## On this page

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#_top)
- [What it gives you](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#what-it-gives-you)
- [The philosophy](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#the-philosophy)
- [How they’re created](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#how-theyre-created)
  - [Let the agent generate it](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#let-the-agent-generate-it)
  - [Derive from branding](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#derive-from-branding)
  - [Write it by hand](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#write-it-by-hand)
- [Example](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#example)

Learn

# What is DESIGN.md?

A design system document that AI agents read to generate consistent UI across your project.

Stitch

![](https://app-companion-430619.appspot.com/docs/design-systems-design-md.png)

Every project has a visual identity: colors, fonts, spacing, component styles. Traditionally, this lives in a Figma file, a brand PDF, or a designer’s head. None of these are readable by an AI agent.

**`DESIGN.md` changes that.** It’s a plain-text design system document that both humans and agents can read, edit, and enforce. Think of it as the design counterpart to `AGENTS.md`:

| File | Who reads it | What it defines |
| --- | --- | --- |
| `README.md` | Humans | What the project is |
| `AGENTS.md` | Coding agents | How to build the project |
| `DESIGN.md` | Design agents | How the project should look and feel |

## What it gives you

[Section titled “What it gives you”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#what-it-gives-you)

When a design agent like Stitch reads your `DESIGN.md`, every screen it generates follows the same visual rules: your color palette, your typography, your component patterns. Without it, each screen stands alone. With it, they look like they belong together.

`DESIGN.md` is a **living artifact**, not a static config file. It evolves as your design evolves. The agent generates it, you refine it, and it’s re-applied to screens as you iterate.

Under the hood, every `DESIGN.md` has two layers: **YAML front matter** containing machine-readable design tokens (exact hex values, font properties, spacing scales) and a **markdown body** providing human-readable design rationale. Tokens give agents precise values. Prose tells them _why_ those values exist. See [the specification](https://app-companion-430619.appspot.com/docs/design-md/specification/) for the full format.

## The philosophy

[Section titled “The philosophy”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#the-philosophy)

The DESIGN.md spec is a **foundation, not a prescription**. It provides a common ground that agents, tools, and teams can rely on — a shared vocabulary for colors, typography, layout, and components — while preserving the freedom to extend the format for domain-specific needs. Unknown sections and custom tokens are accepted, not rejected.

## How they’re created

[Section titled “How they’re created”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#how-theyre-created)

There are three paths to a `DESIGN.md`, from effortless to precise.

Stitch

![Creating a design system from a prompt in Stitch](https://app-companion-430619.appspot.com/docs/design-systems-create.png)

### Let the agent generate it

[Section titled “Let the agent generate it”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#let-the-agent-generate-it)

Describe the vibe. The agent translates your aesthetic intent into tokens and guidelines.

PROMPT

A playful coffee shop ordering app with warm colors, rounded corners, and a friendly feel

Stitch generates a complete design system (colors, typography, spacing, component styles) and summarizes it as a `DESIGN.md`.

### Derive from branding

[Section titled “Derive from branding”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#derive-from-branding)

If you already have a brand, provide a URL or image. The agent extracts your palette, typography, and style patterns to build the `DESIGN.md` from what already exists.

Stitch

![Importing a design system from a website URL in Stitch](https://app-companion-430619.appspot.com/docs/design-system-import-from-website.png)

### Write it by hand

[Section titled “Write it by hand”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#write-it-by-hand)

Advanced users can author a `DESIGN.md` directly, encoding exact design preferences. Every section is just markdown with optional YAML front matter for design tokens. No special syntax beyond standard markdown and YAML.

## Example

[Section titled “Example”](https://app-companion-430619.appspot.com/docs/design-md/overview/index.html#example)

Below is a minimal `DESIGN.md` for a dark-themed productivity app. The YAML front matter defines the exact token values; the markdown body explains the design intent.

```
---

name: DevFocus Dark

colors:

  primary: "#2665fd"

  secondary: "#475569"

  surface: "#0b1326"

  on-surface: "#dae2fd"

  error: "#ffb4ab"

typography:

  body-md:

    fontFamily: Inter

    fontSize: 16px

    fontWeight: 400

rounded:

  md: 8px

---

# Design System

## Overview

A focused, minimal dark interface for a developer productivity tool.

Clean lines, low visual noise, high information density.

## Colors

- **Primary** (#2665fd): CTAs, active states, key interactive elements

- **Secondary** (#475569): Supporting UI, chips, secondary actions

- **Surface** (#0b1326): Page backgrounds

- **On-surface** (#dae2fd): Primary text on dark backgrounds

- **Error** (#ffb4ab): Validation errors, destructive actions

## Typography

- **Headlines**: Inter, semi-bold

- **Body**: Inter, regular, 14–16px

- **Labels**: Inter, medium, 12px, uppercase for section headers

## Components

- **Buttons**: Rounded (8px), primary uses brand blue fill

- **Inputs**: 1px border, subtle surface-variant background

- **Cards**: No elevation, relies on border and background contrast

## Do's and Don'ts

- Do use the primary color sparingly, only for the most important action

- Don't mix rounded and sharp corners in the same view

- Do maintain 4:1 contrast ratio for all text
```

This is what the agent reads when generating your next screen. For the complete format specification, see [The specification](https://app-companion-430619.appspot.com/docs/design-md/specification/). To validate your DESIGN.md against the spec, see [Validate with the CLI](https://app-companion-430619.appspot.com/docs/design-md/cli/).

[Previous \\
\\
Architecture](https://app-companion-430619.appspot.com/docs/sdk/architecture/) [Next \\
\\
The specification](https://app-companion-430619.appspot.com/docs/design-md/specification/)