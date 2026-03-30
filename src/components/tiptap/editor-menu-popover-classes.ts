import { cn } from "@/lib/utils";

/**
 * PopoverContent overrides so editor pickers match {@link DropdownMenuContent}
 * (dense padding, scroll, same surface) instead of default Form-style popover.
 */
export function editorMenuPopoverContentClassName(widthClass: "w-40" | "w-48") {
  return cn(
    widthClass,
    "flex flex-col gap-0 p-1 min-w-32 text-popover-foreground",
    "max-h-(--available-height) overflow-x-hidden overflow-y-auto",
    "rounded-lg shadow-md ring-1 ring-foreground/10 outline-none"
  );
}

/** Mirrors {@link DropdownMenuItem} semantics for plain buttons inside a menu-like popover. */
export const editorMenuPopoverItemClassName = cn(
  "group/dropdown-menu-item relative flex w-full cursor-default items-center gap-1.5 rounded-md border-0 bg-transparent px-1.5 py-1 text-left text-sm outline-hidden select-none",
  "hover:bg-accent hover:text-accent-foreground",
  "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
);

/** Same typography as {@link DropdownMenuShortcut} (focus + hover via group). */
export const editorMenuPopoverShortcutClassName =
  "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground group-hover/dropdown-menu-item:text-accent-foreground";
