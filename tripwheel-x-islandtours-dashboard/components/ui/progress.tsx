"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-0.5 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-primary transition-all -translate-x-(--progress-remaining)"
        // 03 §8.3: the runtime value travels through a CSS custom property;
        // the spread keeps a literal `style` attribute out of the JSX.
        {...{
          style: {
            "--progress-remaining": `${100 - (value || 0)}%`,
          } as React.CSSProperties,
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
