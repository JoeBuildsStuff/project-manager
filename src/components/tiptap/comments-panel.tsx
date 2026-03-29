"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  EllipsisVertical,
  List,
  ListTodo,
  MoreVertical,
  Square,
  SquareCheckBig,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { isRichTextContentEmpty } from "@/components/tiptap/comment-content-utils";
import { CommentInputEditor } from "@/components/tiptap/comment-input-editor";
import type {
  Thread,
  ThreadVisibilityFilters,
} from "@/components/tiptap/comment-thread-types";
import { ButtonGroup, ButtonGroupSeparator } from "../ui/button-group";
import { Skeleton } from "@/components/ui/skeleton";

function formatCommentTimestamp(timestamp: string) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  if (isToday(parsed)) {
    return `Today at ${format(parsed, "p")}`;
  }

  if (isYesterday(parsed)) {
    return `Yesterday at ${format(parsed, "p")}`;
  }

  return format(parsed, "MMM d, yyyy 'at' p");
}

function userDisplay(userId: string, currentUserId: string | null) {
  return userId === currentUserId ? "You" : userId.slice(0, 8);
}

function userInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "U"
  );
}

function isInteractiveKeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, button, select, [contenteditable='true'], [role='textbox'], [data-role='comment-input']"
    )
  );
}

type CommentsPanelProps = {
  showComments: boolean;
  isLoadingThreads: boolean;
  threads: Thread[];
  selectedThreadId: string | null;
  currentUserId: string | null;
  currentUserInitials: string;
  currentUserAvatarUrl: string | null;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSelectThread: (threadId: string) => void;
  onHoverThread: (threadId: string | null) => void;
  onCreateReply: () => void;
  onToggleThreadResolved: (threadId: string, resolved: boolean) => void;
  onDeleteThread: (threadId: string) => void;
  onDeleteComment: (threadId: string, commentId: string) => void;
  onUpdateComment: (
    threadId: string,
    commentId: string,
    content: string
  ) => Promise<boolean> | boolean;
  threadFilters: ThreadVisibilityFilters;
  onThreadFiltersChange: (
    threadFilters:
      | ThreadVisibilityFilters
      | ((prev: ThreadVisibilityFilters) => ThreadVisibilityFilters)
  ) => void;
  onCloseComments: () => void;
};

export function CommentsPanel({
  showComments,
  isLoadingThreads,
  threads,
  selectedThreadId,
  currentUserId,
  currentUserInitials,
  currentUserAvatarUrl,
  replyContent,
  onReplyContentChange,
  onSelectThread,
  onHoverThread,
  onCreateReply,
  onToggleThreadResolved,
  onDeleteThread,
  onDeleteComment,
  onUpdateComment,
  threadFilters,
  onThreadFiltersChange,
  onCloseComments,
}: CommentsPanelProps) {
  const [editingComment, setEditingComment] = useState<{
    threadId: string;
    commentId: string;
  } | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const clearEditingState = () => {
    setEditingComment(null);
    setEditingContent("");
  };

  const submitEdit = (threadId: string, commentId: string) => {
    if (isRichTextContentEmpty(editingContent) || isSubmittingEdit) {
      return;
    }

    setIsSubmittingEdit(true);
    void Promise.resolve(onUpdateComment(threadId, commentId, editingContent))
      .then((didUpdate) => {
        if (didUpdate) {
          clearEditingState();
        }
      })
      .finally(() => {
        setIsSubmittingEdit(false);
      });
  };

  const orderedThreads = [...threads]
    .filter((t) =>
      t.status === "unresolved" ? threadFilters.open : threadFilters.resolved
    )
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "unresolved" ? -1 : 1;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <aside
      aria-hidden={!showComments}
      className="flex min-h-0 min-w-80 w-80 flex-col rounded-md border border-border bg-card"
    >
      <div className="h-12 border-b border-border px-2">
        <div className="flex h-full items-center justify-between">
          <h2 className="text-sm font-semibold">Comments</h2>
          <div className="flex items-center">
            <ButtonGroup>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCloseComments}
                aria-label="Close comments"
                className="size-7 p-0"
              >
                <X className="size-4" />
              </Button>
              {/* <ButtonGroupSeparator /> */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="More Options"
                    className="size-7 p-0"
                  >
                    <EllipsisVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                      Show
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={threadFilters.open}
                      onCheckedChange={(checked) =>
                        onThreadFiltersChange((prev) => ({
                          ...prev,
                          open: checked === true,
                        }))
                      }
                    >
                      <Square />
                      Open
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={threadFilters.resolved}
                      onCheckedChange={(checked) =>
                        onThreadFiltersChange((prev) => ({
                          ...prev,
                          resolved: checked === true,
                        }))
                      }
                    >
                      <SquareCheckBig />
                      Resolved
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {isLoadingThreads ? (
          <div className="space-y-2">
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card px-3 pb-3 pt-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-16 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </div>
              <div className="mt-2 space-y-1.5">
                <Skeleton className="h-3.5 w-full rounded" />
                <Skeleton className="h-3.5 w-4/5 rounded" />
                <Skeleton className="h-3.5 w-3/5 rounded" />
              </div>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card px-3 pb-3 pt-3 opacity-75">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-3.5 w-20 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                </div>
                <Skeleton className="size-4 shrink-0 rounded" />
              </div>
              <div className="mt-2 space-y-1.5">
                <Skeleton className="h-3.5 w-full rounded" />
                <Skeleton className="h-3.5 w-2/3 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {orderedThreads.map((thread) => {
              const isSelected = selectedThreadId === thread.id;
              const firstComment = thread.comments[0];
              const authorName = userDisplay(
                firstComment?.userId ?? thread.createdBy,
                currentUserId
              );
              const authorInitials = userInitials(authorName);
              const createdAt = formatCommentTimestamp(
                firstComment?.createdAt ?? thread.createdAt
              );
              const replies = thread.comments.slice(1);
              const replyCountLabel = `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`;
              const isEditingFirstComment = Boolean(
                firstComment &&
                editingComment?.threadId === thread.id &&
                editingComment.commentId === firstComment.id
              );
              const canEditFirstComment =
                firstComment?.userId === currentUserId;

              return (
                <div
                  key={thread.id}
                  className={`w-full overflow-hidden rounded-xl border text-left text-xs transition ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "cursor-pointer border-border hover:border-primary/50"
                  }`}
                  onClick={() => onSelectThread(thread.id)}
                  onMouseEnter={() => onHoverThread(thread.id)}
                  onMouseLeave={() => onHoverThread(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (isInteractiveKeyTarget(event.target)) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectThread(thread.id);
                    }
                  }}
                >
                  <div className="px-3 pb-3 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <Avatar className="size-9 shrink-0">
                          {firstComment?.userId === currentUserId &&
                          currentUserAvatarUrl ? (
                            <AvatarImage
                              src={currentUserAvatarUrl}
                              alt={authorName}
                            />
                          ) : null}
                          <AvatarFallback>{authorInitials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {authorName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {createdAt}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Checkbox
                          checked={thread.status === "resolved"}
                          onCheckedChange={(checked) => {
                            onToggleThreadResolved(thread.id, Boolean(checked));
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={
                            thread.status === "resolved"
                              ? "Reopen thread"
                              : "Resolve thread"
                          }
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={(event) => event.stopPropagation()}
                              aria-label="Comment actions"
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {canEditFirstComment && firstComment ? (
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setEditingComment({
                                    threadId: thread.id,
                                    commentId: firstComment.id,
                                  });
                                  setEditingContent(firstComment.content);
                                }}
                              >
                                <SquarePen className="size-4" />
                                Edit
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onDeleteThread(thread.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-2">
                      {isEditingFirstComment && firstComment ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <CommentInputEditor
                            value={editingContent}
                            onChange={setEditingContent}
                            onSubmitShortcut={() => {
                              submitEdit(thread.id, firstComment.id);
                            }}
                            placeholder="Edit comment"
                            editorClassName="text-sm"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                clearEditingState();
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                submitEdit(thread.id, firstComment.id);
                              }}
                              disabled={
                                isRichTextContentEmpty(editingContent) ||
                                isSubmittingEdit
                              }
                            >
                              Submit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <CommentInputEditor
                          value={firstComment?.content ?? ""}
                          readOnly
                          autoFocus={false}
                          editorClassName="text-sm"
                        />
                      )}
                    </div>
                    {replies.length > 0 && !isSelected ? (
                      <p className="mt-2 text-xs font-medium dark:text-blue-400 text-blue-600">
                        {replyCountLabel}
                      </p>
                    ) : null}
                  </div>

                  {isSelected && replies.length > 0 ? (
                    <div>
                      {replies.map((reply) => {
                        const replyAuthor = userDisplay(
                          reply.userId,
                          currentUserId
                        );
                        const replyInitials =
                          reply.userId === currentUserId
                            ? currentUserInitials
                            : userInitials(replyAuthor);
                        const isEditingReply = Boolean(
                          editingComment?.threadId === thread.id &&
                          editingComment.commentId === reply.id
                        );
                        return (
                          <div
                            key={reply.id}
                            className="border-t border-border"
                          >
                            <div className="px-3 py-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2">
                                  <Avatar className="size-8 shrink-0">
                                    {reply.userId === currentUserId &&
                                    currentUserAvatarUrl ? (
                                      <AvatarImage
                                        src={currentUserAvatarUrl}
                                        alt={replyAuthor}
                                      />
                                    ) : null}
                                    <AvatarFallback>
                                      {replyInitials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="truncate text-sm font-semibold">
                                      {replyAuthor}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {formatCommentTimestamp(reply.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                {reply.userId === currentUserId ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        aria-label="Reply actions"
                                      >
                                        <MoreVertical className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="end"
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                    >
                                      <DropdownMenuItem
                                        onSelect={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          setEditingComment({
                                            threadId: thread.id,
                                            commentId: reply.id,
                                          });
                                          setEditingContent(reply.content);
                                        }}
                                      >
                                        <SquarePen className="size-4" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          onDeleteComment(thread.id, reply.id);
                                        }}
                                      >
                                        <Trash2 className="size-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : null}
                              </div>
                              <div className="mt-2">
                                {isEditingReply ? (
                                  <div
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <CommentInputEditor
                                      value={editingContent}
                                      onChange={setEditingContent}
                                      onSubmitShortcut={() => {
                                        submitEdit(thread.id, reply.id);
                                      }}
                                      placeholder="Edit"
                                      editorClassName="text-sm"
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          clearEditingState();
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          submitEdit(thread.id, reply.id);
                                        }}
                                        disabled={
                                          isRichTextContentEmpty(
                                            editingContent
                                          ) || isSubmittingEdit
                                        }
                                      >
                                        Submit
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <CommentInputEditor
                                    value={reply.content}
                                    readOnly
                                    autoFocus={false}
                                    editorClassName="text-sm"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {isSelected ? (
                    <div className="border-t border-border bg-background/60">
                      <div className="px-3 py-3">
                        <div className="min-w-0" data-role="comment-input">
                          <CommentInputEditor
                            value={replyContent}
                            onChange={onReplyContentChange}
                            placeholder="Add a reply"
                            onSubmitShortcut={onCreateReply}
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            onClick={onCreateReply}
                            disabled={isRichTextContentEmpty(replyContent)}
                          >
                            Add Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
