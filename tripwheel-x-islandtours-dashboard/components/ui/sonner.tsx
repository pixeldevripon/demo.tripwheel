"use client"

import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon, CancelCircleIcon, CheckmarkCircle02Icon, InformationCircleIcon, Loading03Icon } from '@hugeicons/core-free-icons';

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // TOP-right, not the library default of bottom-right: every long
      // dashboard form has a sticky action bar (Save / Copy from English) in
      // the bottom-right corner, and a toast landed straight on top of Save -
      // blocking the click for as long as it was on screen.
      position="top-right"
      className="toaster group [--normal-bg:var(--popover)] [--normal-text:var(--popover-foreground)] [--normal-border:var(--border)] [--border-radius:var(--radius)]"
      icons={{
        success: (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
        ),
        info: (
          <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />
        ),
        warning: (
          <HugeiconsIcon icon={Alert02Icon} className="size-4" />
        ),
        error: (
          <HugeiconsIcon icon={CancelCircleIcon} className="size-4" />
        ),
        loading: (
          <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
