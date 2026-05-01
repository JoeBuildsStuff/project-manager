import { cn } from "@/lib/utils";

/**
 * Pinned/star icons — same amber pairing as `Badge variant="amber"`:
 * light: text on pale surfaces; dark: `amber-400` on dark surfaces.
 */
export const starIconPinnedClass =
  "text-amber-800 dark:text-amber-400";

export const starIconUnpinnedClass =
  "text-amber-700/55 dark:text-amber-400/40";

export const starTogglePinnedClass = cn(
  starIconPinnedClass,
  "hover:text-amber-900 dark:hover:text-amber-300",
);

export const starToggleUnpinnedClass = cn(
  starIconUnpinnedClass,
  "hover:text-amber-800 dark:hover:text-amber-400",
);
