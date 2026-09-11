import { GLOBE_STYLES, type GlobeStyleId } from '@/core/world-explorer/globeStyle'
import { cn } from '@/shared/utils/cn'

interface GlobeStyleSelectorProps {
  value: GlobeStyleId
  onChange: (style: GlobeStyleId) => void
}

/**
 * "Globe Style" selector — brief §5/§13: a compact segmented control,
 * not a settings panel, that sits above the globe without covering it
 * or interfering with dragging. Same pill visual language as
 * `CategoryPills` elsewhere in Cellfie (rounded-full, terracotta active
 * state) so it reads as belonging to the app rather than a bolted-on
 * widget.
 */
export function GlobeStyleSelector({ value, onChange }: GlobeStyleSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Globe style" className="flex items-center justify-center gap-2">
      {GLOBE_STYLES.map((style) => {
        const isActive = style.id === value
        return (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(style.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-ui text-caption font-medium transition-colors duration-micro',
              isActive
                ? 'border-terracotta bg-terracotta text-canvas'
                : 'border-border-strong bg-canvas text-ink-secondary hover:bg-surface-raised'
            )}
          >
            <span aria-hidden>{style.emoji}</span>
            {style.label}
          </button>
        )
      })}
    </div>
  )
}
