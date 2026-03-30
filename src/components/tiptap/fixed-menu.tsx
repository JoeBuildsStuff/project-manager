"use client";

import { Editor, useEditorState } from "@tiptap/react";
import { useState } from "react";
import {
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Code,
  MessageSquare,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/tiptap/link-button";
import TableButton from "@/components/tiptap/table-button";
import {
  editorMenuPopoverContentClassName,
  editorMenuPopoverItemClassName,
  editorMenuPopoverShortcutClassName,
} from "@/components/tiptap/editor-menu-popover-classes";
import { CopyButton } from "@/components/ui/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FixedMenuProps {
  editor: Editor;
  showComments?: boolean;
  onShowCommentsChange?: (show: boolean) => void;
}

const FixedMenu = ({
  editor,
  showComments,
  onShowCommentsChange,
}: FixedMenuProps) => {
  const [blockTypeOpen, setBlockTypeOpen] = useState(false);
  const [textAlignOpen, setTextAlignOpen] = useState(false);

  const editorState = useEditorState({
    editor,
    selector: (state: { editor: Editor }) => ({
      isBold: state.editor.isActive("bold"),
      isItalic: state.editor.isActive("italic"),
      isStrike: state.editor.isActive("strike"),
      isUnderline: state.editor.isActive("underline"),
      isCode: state.editor.isActive("code"),
      isHeading1: state.editor.isActive("heading", { level: 1 }),
      isHeading2: state.editor.isActive("heading", { level: 2 }),
      isHeading3: state.editor.isActive("heading", { level: 3 }),
      isOrderedList: state.editor.isActive("orderedList"),
      isBulletList: state.editor.isActive("bulletList"),
      isCodeBlock: state.editor.isActive("codeBlock"),
      isAlignLeft: state.editor.isActive({ textAlign: "left" }),
      isAlignCenter: state.editor.isActive({ textAlign: "center" }),
      isAlignRight: state.editor.isActive({ textAlign: "right" }),
    }),
  });

  const handleSetTextAlign = (alignment: "left" | "center" | "right") => {
    const chain = editor.chain().focus() as unknown as {
      setTextAlign: (value: typeof alignment) => { run: () => boolean };
    };

    chain.setTextAlign(alignment).run();
  };

  const getContentToCopy = () => {
    if (!editor) return "";

    const htmlContent = editor.getHTML();
    const textContent = editor.getText();

    // Return HTML content if it's different from plain text, otherwise return plain text
    return htmlContent !== textContent ? htmlContent : textContent;
  };

  const menuTriggerClassName = cn(
    buttonVariants({
      variant: "secondary",
      size: "sm",
    }),
    "h-8 min-w-8 px-1.5 text-xs"
  );

  return (
    <ScrollArea className="h-12 min-w-0 rounded-t-md border-b border-border bg-card">
        <div className="flex h-full flex-row items-center justify-between p-2">
          <div className="flex flex-row gap-1">
            {/* type of node */}
            <div className="flex flex-row gap-0.5 w-fit">
              <Popover open={blockTypeOpen} onOpenChange={setBlockTypeOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger
                      className={menuTriggerClassName}
                    >
                      {editorState.isHeading1 && <Heading1 className="" />}
                      {editorState.isHeading2 && <Heading2 className="" />}
                      {editorState.isHeading3 && <Heading3 className="" />}
                      {editorState.isOrderedList && <ListOrdered className="" />}
                      {editorState.isBulletList && <List className="" />}
                      {editorState.isCodeBlock && <Code className="" />}
                      {!editorState.isHeading1 &&
                        !editorState.isHeading2 &&
                        !editorState.isHeading3 &&
                        !editorState.isOrderedList &&
                        !editorState.isBulletList &&
                        !editorState.isCodeBlock && <Type className="" />}
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Block type</p>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className={editorMenuPopoverContentClassName("w-48")}
                >
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().setParagraph().run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <Type className="" />
                    <span>Text</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⌥ 0
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleHeading({ level: 1 }).run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <Heading1 className="" />
                    <span>Heading 1</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⌥ 1
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleHeading({ level: 2 }).run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <Heading2 className="" />
                    <span>Heading 2</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⌥ 2
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleHeading({ level: 3 }).run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <Heading3 className="" />
                    <span>Heading 3</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⌥ 3
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleOrderedList().run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <ListOrdered className="" />
                    <span>Ordered list</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⇧ 7
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleBulletList().run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <List className="" />
                    <span>Bullet list</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⇧ 8
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      editor.chain().focus().toggleCodeBlock().run();
                      setBlockTypeOpen(false);
                    }}
                  >
                    <Code className="" />
                    <span>Code block</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⌥ C
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            {/* alignment */}
            <div className="flex flex-row gap-0.5 w-fit">
              <Popover open={textAlignOpen} onOpenChange={setTextAlignOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger
                      className={menuTriggerClassName}
                    >
                      {editorState.isAlignLeft && <AlignLeft className="" />}
                      {editorState.isAlignCenter && <AlignCenter className="" />}
                      {editorState.isAlignRight && <AlignRight className="" />}
                      {!editorState.isAlignLeft &&
                        !editorState.isAlignCenter &&
                        !editorState.isAlignRight && <AlignLeft className="" />}
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Text alignment</p>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  className={editorMenuPopoverContentClassName("w-40")}
                >
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      handleSetTextAlign("left");
                      setTextAlignOpen(false);
                    }}
                  >
                    <AlignLeft className="" />
                    <span>Left</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⇧ L
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      handleSetTextAlign("center");
                      setTextAlignOpen(false);
                    }}
                  >
                    <AlignCenter className="" />
                    <span>Center</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⇧ E
                    </span>
                  </button>
                  <button
                    type="button"
                    className={editorMenuPopoverItemClassName}
                    onClick={() => {
                      handleSetTextAlign("right");
                      setTextAlignOpen(false);
                    }}
                  >
                    <AlignRight className="" />
                    <span>Right</span>
                    <span className={editorMenuPopoverShortcutClassName}>
                      ⌘ ⇧ R
                    </span>
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            {/* formatting */}
            <div className="flex flex-row gap-0.5 w-fit">
              <Tooltip>
                <TooltipTrigger>
                  <Toggle
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    pressed={editorState.isBold}
                    size="sm"
                  >
                    <Bold className="" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Bold <span className="ml-2">⌘B</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Toggle
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    pressed={editorState.isItalic}
                    size="sm"
                  >
                    <Italic className="" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Italic <span className="ml-2">⌘I</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Toggle
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    pressed={editorState.isStrike}
                    size="sm"
                  >
                    <Strikethrough className="" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Strikethrough <span className="ml-2">⌘⇧X</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Toggle
                    onClick={() =>
                      editor.chain().focus().toggleUnderline().run()
                    }
                    pressed={editorState.isUnderline}
                    size="sm"
                  >
                    <Underline className="" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Underline <span className="ml-2">⌘U</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger>
                  <Toggle
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    pressed={editorState.isCode}
                    size="sm"
                  >
                    <Code className="" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Inline code <span className="ml-2">⌘E</span>
                  </p>
                </TooltipContent>
              </Tooltip>
              <LinkButton editor={editor} size="sm" />
              <TableButton editor={editor} size="sm" />
              {onShowCommentsChange ? (
                <Tooltip>
                  <TooltipTrigger>
                    <Toggle
                      size="sm"
                      pressed={showComments ?? false}
                      onPressedChange={onShowCommentsChange}
                      aria-label={
                        showComments
                          ? "Hide comments panel"
                          : "Show comments panel"
                      }
                    >
                      <MessageSquare className="" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {showComments
                        ? "Hide comments panel"
                        : "Show comments panel"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>

          <div className="flex flex-row gap-1">
            <CopyButton
              textToCopy={getContentToCopy()}
              size="sm"
              variant="ghost"
              className="text-xs"
              successMessage="Content copied to clipboard"
              errorMessage="Failed to copy content"
            />
          </div>
        </div>
    </ScrollArea>
  );
};

export default FixedMenu;
