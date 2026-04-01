import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      offset={10}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "400px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !grid grid-cols-[auto_1fr] !items-start gap-x-1.5 !pr-9 !rounded-xl",
          icon: "!self-start !h-auto mt-px !text-muted-foreground",
          description: "!text-muted-foreground !my-1",
          actionButton: cn(
            buttonVariants({ variant: "secondary", size: "xs" }),
            "col-start-2 row-start-2 justify-self-start !ml-0 !bg-secondary !rounded-md !text-secondary-foreground hover:!bg-secondary/80"
          ),
          closeButton: cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "!absolute !left-auto !right-2.5 !top-2.5 !transform-none !border-0 !bg-transparent !rounded-md hover:!bg-accent hover:!text-accent-foreground dark:hover:!bg-accent/50"
          ),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
