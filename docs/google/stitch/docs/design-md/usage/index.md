Stitch

View, edit, and export \| Stitch [Skip to content](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#_top)

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

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#_top)
- [View the design system](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#view-the-design-system)
- [Set a default design system](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#set-a-default-design-system)
- [Edit via the Design System panel](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#edit-via-the-design-system-panel)
- [Export with your project](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#export-with-your-project)
- [Working outside Stitch?](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#working-outside-stitch)

## On this page

- [Overview](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#_top)
- [View the design system](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#view-the-design-system)
- [Set a default design system](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#set-a-default-design-system)
- [Edit via the Design System panel](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#edit-via-the-design-system-panel)
- [Export with your project](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#export-with-your-project)
- [Working outside Stitch?](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#working-outside-stitch)

Learn

# View, edit, and export

Work with your design system in the Stitch UI. View tokens, tweak values, and export with your project.

## View the design system

[Section titled “View the design system”](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#view-the-design-system)

Open the **Design System** panel to see the active design system for any screen. The panel shows the resolved tokens: colors, fonts, roundedness, spacing, and component patterns.

If the project has multiple design systems, the panel displays the one applied to the currently selected screen.

## Set a default design system

[Section titled “Set a default design system”](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#set-a-default-design-system)

To apply a design system to all future screens in a project, select it as the project default. New screens generated after this point will automatically inherit its tokens.

Existing screens are not retroactively updated. To bring them into alignment, apply the design system to them individually.

## Edit via the Design System panel

[Section titled “Edit via the Design System panel”](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#edit-via-the-design-system-panel)

The Design System panel supports direct edits to the active design system. Changes you make here update both the structured tokens and the `DESIGN.md` summary.

Editable properties include:

- **Color palette**: primary, secondary, tertiary, and neutral base colors
- **Typography**: headline, body, and label font families
- **Roundedness**: corner radius scale

For more granular changes (component guidelines, do’s and don’ts, or the overview narrative), edit the `DESIGN.md` markdown directly.

## Export with your project

[Section titled “Export with your project”](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#export-with-your-project)

When you export a project, the `DESIGN.md` file is included in the zip alongside the generated screens. This gives downstream consumers (developers, other design tools, or other agents) a portable record of the design system.

The exported `DESIGN.md` is a standalone document. It doesn’t depend on Stitch to be useful.

## Working outside Stitch?

[Section titled “Working outside Stitch?”](https://app-companion-430619.appspot.com/docs/design-md/usage/index.html#working-outside-stitch)

The [`@google/design.md` CLI](https://app-companion-430619.appspot.com/docs/design-md/cli/) validates any DESIGN.md file against the formal spec, checks WCAG contrast ratios, and exports tokens to Tailwind or W3C Design Token formats. It works with any DESIGN.md, whether it was generated by Stitch or written by hand.

[Previous \\
\\
The specification](https://app-companion-430619.appspot.com/docs/design-md/specification/) [Next \\
\\
Validate with the CLI](https://app-companion-430619.appspot.com/docs/design-md/cli/)