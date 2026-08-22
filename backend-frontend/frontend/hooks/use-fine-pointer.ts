import * as React from "react"

const FINE_POINTER = "(hover: hover) and (pointer: fine)"
const HAS_TOUCH = "(any-pointer: coarse)"

/**
 * True only on devices whose sole input is a mouse or trackpad — i.e. devices
 * with no swipe gesture to reach horizontally-overflowing content with.
 *
 * Use this, NOT `useIsMobile()`, to gate scroll affordances (prev/next
 * chevrons). Capability and viewport width are different questions: a narrow
 * desktop window is still mouse-only and needs the chevrons, while a touch
 * laptop is a wide viewport that can already swipe and must not get them.
 * `(hover: hover) and (pointer: fine)` alone is true on a touch laptop, so the
 * `(any-pointer: coarse)` check is what actually removes it.
 *
 * Starts `false` and settles after mount, so the server render (which has no
 * pointer to query) and the first client render always agree.
 *
 * @example
 *   const finePointer = useFinePointer()
 *   {finePointer && canScrollRight && <ScrollButton />}
 */
export function useFinePointer() {
  const [finePointer, setFinePointer] = React.useState(false)

  React.useEffect(() => {
    const fine = window.matchMedia(FINE_POINTER)
    const touch = window.matchMedia(HAS_TOUCH)
    // Both can flip mid-session: plugging in a mouse, or Chrome's device
    // emulation being toggled in devtools.
    const sync = () => setFinePointer(fine.matches && !touch.matches)

    sync()
    fine.addEventListener("change", sync)
    touch.addEventListener("change", sync)

    return () => {
      fine.removeEventListener("change", sync)
      touch.removeEventListener("change", sync)
    }
  }, [])

  return finePointer
}
