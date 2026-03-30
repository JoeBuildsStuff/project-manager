"use client";

import { Editor, useEditorState } from "@tiptap/react";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import { useCallback, useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/tiptap/link-button";
import TableButton from "./table-button";
import {
  editorMenuPopoverContentClassName,
  editorMenuPopoverItemClassName,
  editorMenuPopoverShortcutClassName,
} from "@/components/tiptap/editor-menu-popover-classes";
import { cn } from "@/lib/utils";

interface BubbleMenuProps {
  editor: Editor;
  onRequestCommentFromSelection?: (payload: {
    anchorFrom: number;
    anchorTo: number;
    anchorExact: string;
    anchorPrefix: string;
    anchorSuffix: string;
    position: {
      top: number;
      left: number;
    };
  }) => void;
}

const BubbleMenuComponent = ({
  editor,
  onRequestCommentFromSelection,
}: BubbleMenuProps) => {
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

  const bubbleMenuRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.style.zIndex = "20";
    }
  }, []);

  const handleRequestComment = () => {
    const { from, to, empty } = editor.state.selection;
    if (empty || to <= from) {
      return;
    }

    const doc = editor.state.doc;
    const prefixStart = Math.max(1, from - 32);
    const suffixEnd = Math.min(doc.content.size, to + 32);
    const coords = editor.view.coordsAtPos(to);

    onRequestCommentFromSelection?.({
      anchorFrom: from,
      anchorTo: to,
      anchorExact: doc.textBetween(from, to, " ", " "),
      anchorPrefix: doc.textBetween(prefixStart, from, " ", " "),
      anchorSuffix: doc.textBetween(to, suffixEnd, " ", " "),
      position: {
        top: coords.bottom + 8,
        left: (coords.left + coords.right) / 2,
      },
    });
  };

  const menuTriggerClassName = cn(
    buttonVariants({
      variant: "secondary",
      size: "sm",
    }),
    "h-8 min-w-8 px-1.5 text-xs"
  );
  const commentButtonClassName = cn(
    buttonVariants({
      variant: "ghost",
      size: "sm",
    }),
    "h-8 min-w-8 px-1.5 text-xs bg-transparent"
  );

  return (
    <TiptapBubbleMenu
      ref={bubbleMenuRef}
      className=""
      options={{
        offset: 6,
        placement: "top",
      }}
      editor={editor}
      shouldShow={({ editor, state }) => {
        if (!editor.isFocused) {
          return false;
        }

        const { from, to, empty } = state.selection;

        if (empty) {
          return false;
        }

        const selectedText = state.doc.textBetween(from, to).trim();
        return selectedText.length > 0;
      }}
    >
      <div className="flex flex-row gap-0.5 border rounded-xl border-border bg-background p-1">
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
            sideOffset={10}
            className={editorMenuPopoverContentClassName("w-48")}
          >
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().setParagraph().focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <Type className="" />
              <span>Text</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⌥ 0</span>
            </button>
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().toggleHeading({ level: 1 }).focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <Heading1 className="" />
              <span>Heading 1</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⌥ 1</span>
            </button>
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().toggleHeading({ level: 2 }).focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <Heading2 className="" />
              <span>Heading 2</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⌥ 2</span>
            </button>
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().toggleHeading({ level: 3 }).focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <Heading3 className="" />
              <span>Heading 3</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⌥ 3</span>
            </button>
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().toggleOrderedList().focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <ListOrdered className="" />
              <span>Ordered list</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⇧ 7</span>
            </button>
            <button
              type="button"
              className={editorMenuPopoverItemClassName}
              onClick={() => {
                editor.chain().toggleBulletList().focus().run();
                setBlockTypeOpen(false);
              }}
            >
              <List className="" />
              <span>Bullet list</span>
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⇧ 8</span>
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
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⌥ C</span>
            </button>
          </PopoverContent>
        </Popover>

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
            sideOffset={10}
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
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⇧ L</span>
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
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⇧ E</span>
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
              <span className={editorMenuPopoverShortcutClassName}>⌘ ⇧ R</span>
            </button>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger>
            <Toggle
              onClick={() => editor.chain().toggleBold().focus().run()}
              pressed={editorState.isBold}
              size="sm"
              className="text-xs"
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
              onClick={() => editor.chain().toggleItalic().focus().run()}
              pressed={editorState.isItalic}
              size="sm"
              className="text-xs"
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
              onClick={() => editor.chain().toggleStrike().focus().run()}
              pressed={editorState.isStrike}
              size="sm"
              className="text-xs"
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
              onClick={() => editor.chain().toggleUnderline().focus().run()}
              pressed={editorState.isUnderline}
              size="sm"
              className="text-xs"
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
              onClick={() => editor.chain().toggleCode().focus().run()}
              pressed={editorState.isCode}
              size="sm"
              className="text-xs"
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
        <LinkButton editor={editor} size="sm" className="text-xs" />
        <TableButton editor={editor} size="sm" className="text-xs" />
        {onRequestCommentFromSelection ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={commentButtonClassName}
                onClick={handleRequestComment}
              >
                <MessageSquare className="" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add comment</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TiptapBubbleMenu>
  );
};

export default BubbleMenuComponent;
