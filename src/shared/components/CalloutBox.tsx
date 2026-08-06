import type { ReactNode } from 'react'
import { Lightbulb, Warning, ShieldWarning, Sparkle } from '@phosphor-icons/react'
import { cn } from '../utils/cn'

type CalloutType = 'tip' | 'warning' | 'safety' | 'aside'

interface CalloutBoxProps {
  type: CalloutType
  title?: string
  children: ReactNode
  className?: string
}

const typeConfig: Record<CalloutType, { border: string; icon: ReactNode; defaultTitle: string }> = {
  tip: { border: 'border-olive', icon: <Lightbulb size={18} className="text-olive" aria-hidden />, defaultTitle: 'Tip' },
  warning: {
    border: 'border-warning',
    icon: <Warning size={18} className="text-warning" aria-hidden />,
    defaultTitle: 'Warning'
  },
  safety: {
    border: 'border-error',
    icon: <ShieldWarning size={18} className="text-error" aria-hidden />,
    defaultTitle: 'Safety-critical'
  },
  aside: {
    border: 'border-sage',
    icon: <Sparkle size={18} className="text-sage" aria-hidden />,
    defaultTitle: 'Did you know?'
  }
}

/**
 * Callout Box — Design System §10.10.
 * Left border accent colored by type, matching icon, never color/icon
 * alone conveying meaning — a text label always accompanies (§13).
 */
export function CalloutBox({ type, title, children, className }: CalloutBoxProps) {
  const config = typeConfig[type]
  return (
    <div className={cn('rounded-sm border-l-4 bg-surface-raised p-4', config.border, className)}>
      <div className="mb-2 flex items-center gap-2">
        {config.icon}
        <span className="font-ui text-ui font-medium text-ink-primary">{title ?? config.defaultTitle}:</span>
      </div>
      <div className="font-body text-body text-ink-secondary">{children}</div>
    </div>
  )
}
