import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { type VariantProps } from "class-variance-authority"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type CopyButtonProps = VariantProps<typeof buttonVariants> & {
    textToCopy: string
    tooltipText?: string
    tooltipCopiedText?: string
    iconSize?: number
    showTooltip?: boolean
    successMessage?: string
    errorMessage?: string
    className?: string
  }

export function CopyButton({
  textToCopy,
  tooltipText = "Copy",
  tooltipCopiedText = "Copied",
  iconSize = 16,
  showTooltip = true,
  className,
  variant = "ghost",
  size = "icon",
}: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) {
      return
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 1200)
    return () => window.clearTimeout(timeout)
  }, [isCopied])

  const button = (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "h-fit w-fit p-2 text-muted-foreground hover:text-foreground",
        className
      )}
      disabled={!textToCopy}
      onClick={async () => {
        await navigator.clipboard.writeText(textToCopy)
        setIsCopied(true)
      }}
    >
      {isCopied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </Button>
  )

  if (!showTooltip) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom">
        {isCopied ? tooltipCopiedText : tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}
