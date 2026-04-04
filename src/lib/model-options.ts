export const ANTHROPIC_MODEL_OPTIONS = [
  {
    value: "claude-haiku-4-5",
    label: "Haiku 4.5",
    menuLabel: "Haiku 4.5 ($1 / $5)",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    menuLabel: "Sonnet 4.6 ($3 / $15)",
  },
  {
    value: "claude-opus-4-6",
    label: "Opus 4.6",
    menuLabel: "Opus 4.6 ($5 / $25)",
  },
] as const;

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
