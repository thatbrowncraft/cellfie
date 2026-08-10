import { Sun, Moon, Monitor, TextAa, Download, Upload, ArrowsLeftRight, ArrowsDownUp } from '@phosphor-icons/react'
import { ReadingLayout } from '../../shared/layouts'
import { Button } from '../../shared/components'
import { useTheme, type ThemeMode } from '../../core/theme'
import { useReaderNavigationMode, type ReaderNavigationMode } from '../../core/reader-settings'
import { cn } from '../../shared/utils/cn'
import { exportJsonBackup } from '../../core/export'

const themeOptions: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
  { mode: 'system', label: 'System', icon: <Monitor size={20} /> },
  { mode: 'light', label: 'Light', icon: <Sun size={20} /> },
  { mode: 'dark', label: 'Dark', icon: <Moon size={20} /> }
]

const readerNavigationOptions: { mode: ReaderNavigationMode; label: string; icon: JSX.Element; description: string }[] = [
  { mode: 'swipe', label: 'Swipe', icon: <ArrowsLeftRight size={20} />, description: 'Swipe left/right to turn pages' },
  { mode: 'scroll', label: 'Scroll', icon: <ArrowsDownUp size={20} />, description: 'Drag up/down to read down the page' }
]

const futureModules = [
  'Learn',
  'Organism Explorer',
  'Laboratory',
  'Concept Explorer',
  'Comparison Studio',
  'AI (optional, opt-in)'
]

/**
 * Settings — the one page where this foundation ships genuinely working
 * controls (theme mode, large text) rather than placeholders, since Theme
 * System and Accessibility are Task 3 deliverables in their own right.
 * Module toggles, export/import, and offline diagnostics are shown as
 * inert previews — those are real features arriving in later phases.
 */
export function SettingsPage() {
  const { mode, setMode, largeText, setLargeText } = useTheme()
  const [readerNavigationMode, setReaderNavigationMode] = useReaderNavigationMode()

  return (
    <ReadingLayout title="Settings" eyebrow="System">
      <section className="mb-10">
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Reading</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">
          Choose how you move through a PDF page in Library. Applies to every book, on this device.
        </p>
        <div role="radiogroup" aria-label="Page navigation" className="flex gap-3">
          {readerNavigationOptions.map((opt) => (
            <button
              key={opt.mode}
              role="radio"
              aria-checked={readerNavigationMode === opt.mode}
              onClick={() => setReaderNavigationMode(opt.mode)}
              className={cn(
                'flex flex-1 flex-col items-center gap-2 rounded-md border p-4 font-ui text-ui font-medium transition-colors duration-micro',
                readerNavigationMode === opt.mode
                  ? 'border-terracotta bg-surface-raised text-ink-primary'
                  : 'border-border text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {opt.icon}
              {opt.label}
              <span className="text-center font-ui text-caption font-normal text-ink-tertiary">{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Appearance</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">Choose how Cellfie looks. Your preference is saved on this device.</p>
        <div role="radiogroup" aria-label="Theme" className="flex gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.mode}
              role="radio"
              aria-checked={mode === opt.mode}
              onClick={() => setMode(opt.mode)}
              className={cn(
                'flex flex-1 flex-col items-center gap-2 rounded-md border p-4 font-ui text-ui font-medium transition-colors duration-micro',
                mode === opt.mode
                  ? 'border-terracotta bg-surface-raised text-ink-primary'
                  : 'border-border text-ink-secondary hover:bg-surface-raised'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Accessibility</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">
          Scales the entire type scale by roughly 1.18× without breaking layout (§13).
        </p>
        <button
          role="switch"
          aria-checked={largeText}
          onClick={() => setLargeText(!largeText)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-surface p-4"
        >
          <span className="flex items-center gap-3 font-ui text-ui font-medium text-ink-primary">
            <TextAa size={20} />
            Large text
          </span>
          <span
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors duration-micro',
              largeText ? 'bg-olive' : 'bg-border-strong'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform duration-micro',
                largeText ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>
      </section>

      <section className="mb-10">
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Modules</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">
          Every module can be shown or hidden from navigation. Toggles activate as each module ships.
        </p>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {futureModules.map((name) => (
            <li key={name} className="flex items-center justify-between px-4 py-3">
              <span className="font-ui text-ui text-ink-tertiary">{name}</span>
              <span className="rounded-full bg-border px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                Coming soon
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Your data</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">
          Everything lives on this device. Export a full JSON backup of your library metadata, highlights, notes, and
          bookmarks (Notes has its own Markdown export too). Restoring from a backup arrives in a later phase.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" icon={<Download size={18} />} onClick={() => void exportJsonBackup()}>
            Export JSON backup
          </Button>
          <Button variant="secondary" disabled icon={<Upload size={18} />}>
            Import
          </Button>
        </div>
      </section>
    </ReadingLayout>
  )
}
