import { cloneElement, useRef, useState, type ReactElement } from 'react'

interface TooltipProps {
  label: string
  children: ReactElement
}

/**
 * Tooltip — Design System §10.18.
 * Inverted pill (dark bg, canvas text). Appears after ~400ms hover delay,
 * Esc dismisses. Triggered on focus as well as hover — never the only copy
 * of essential information.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  function show() {
    timeoutRef.current = setTimeout(() => setVisible(true), 400)
  }
  function hide() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
    >
      {cloneElement(children, { 'aria-describedby': visible ? 'tooltip' : undefined })}
      {visible && (
        <span
          id="tooltip"
          role="tooltip"
          className="pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm bg-ink-primary px-3 py-2 font-ui text-caption text-canvas shadow-2"
        >
          {label}
        </span>
      )}
    </span>
  )
}
