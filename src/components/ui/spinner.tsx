import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      sm: "size-4",
      default: "size-5",
      lg: "size-6",
      xl: "size-8",
    },
    variant: {
      default: "text-secondary-foreground",
      destructive: "text-destructive",
      outline: "text-border",
      secondary: "text-secondary-foreground",
      ghost: "text-muted-foreground",
      link: "text-primary",
      green: "text-green-600",
      blue: "text-blue-600",
      red: "text-red-600",
      gray: "text-gray-600",
    },
  },
  defaultVariants: {
    size: "default",
    variant: "default",
  },
})

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
}

export default function Spinner({ size, variant, className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(spinnerVariants({ size, variant }), className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="opacity-25"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
      />
    </svg>
  )
}
