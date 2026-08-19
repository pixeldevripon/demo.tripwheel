import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full resize-none rounded-md border border-input bg-surface-raised shadow-xs px-3 py-3 text-base transition-[color,border-color,box-shadow] duration-normal outline-none hover:not-focus-visible:not-disabled:border-line-strong placeholder:text-sm placeholder:text-content-subtle focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-solid md:text-sm dark:aria-invalid:border-danger-border",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
