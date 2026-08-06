import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

interface TypeProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  children: ReactNode
  className?: string
}

/**
 * Typography components — Design System §3.
 * Fraunces for Display/H1/H2/H3 only. Literata for BodyLg/Body (reading
 * content). Karla for UIText/Caption/Micro (interface chrome). This mapping
 * is deliberate and should not be crossed — see §3.1's rule.
 */

export function Display({ as: Tag = 'h1', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-display font-semibold text-display text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function H1({ as: Tag = 'h1', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-display font-semibold text-h1 text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function H2({ as: Tag = 'h2', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-display font-medium text-h2 text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function H3({ as: Tag = 'h3', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-display font-medium text-h3 text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function BodyLg({ as: Tag = 'p', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-body text-body-lg text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function Body({ as: Tag = 'p', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-body text-body text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function UIText({ as: Tag = 'span', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-ui font-medium text-ui text-ink-primary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function Caption({ as: Tag = 'span', children, className, ...rest }: TypeProps) {
  return (
    <Tag className={cn('font-ui text-caption text-ink-secondary', className)} {...rest}>
      {children}
    </Tag>
  )
}

export function Micro({ as: Tag = 'span', children, className, ...rest }: TypeProps) {
  return (
    <Tag
      className={cn('font-ui font-medium text-micro uppercase tracking-wide text-ink-tertiary', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}
