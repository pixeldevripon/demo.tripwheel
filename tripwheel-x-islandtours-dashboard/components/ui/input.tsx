import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Vega re-skin: taller (h-10) and roomier with the rounder
        // radius; quiet line that firms on hover, vivid ring only on focus.
        // Placeholders are EXAMPLE VALUES set in content-subtle so they never
        // compete with typed text.
        "h-10 w-full min-w-0 rounded-md border border-input bg-surface-raised shadow-xs px-3 py-2 text-base md:text-sm transition-[color,border-color,box-shadow] duration-normal outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-content hover:not-focus-visible:not-disabled:border-line-strong placeholder:text-sm placeholder:text-content-subtle focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger-solid aria-invalid:focus-visible:ring-danger-solid/20 dark:aria-invalid:border-danger-border",
        className
      )}
      {...props}
    />
  )
}

export { Input }
