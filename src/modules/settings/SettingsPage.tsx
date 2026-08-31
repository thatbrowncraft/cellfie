import { useState } from 'react'
import { Sun, Moon, Monitor, TextAa, Download, Upload, ArrowsLeftRight, ArrowsDownUp, CheckCircle, Info } from '@phosphor-icons/react'
import { ReadingLayout } from '../../shared/layouts'
import { Button } from '../../shared/components'
import { useTheme, type ThemeMode } from '../../core/theme'
import { useReaderNavigationMode, type ReaderNavigationMode } from '../../core/reader-settings'
import { cn } from '../../shared/utils/cn'
import { exportJsonBackup } from '../../core/export'
import { moduleStatusList } from '../../config/modules'
import { ImportBackupDialog } from './components/ImportBackupDialog'
import { AboutDialog } from './components/AboutDialog'

const themeOptions: { mode: ThemeMode; label: string; icon: JSX.Element }[] = [
  { mode: 'system', label: 'System', icon: <Monitor size={20} /> },
  { mode: 'light', label: 'Light', icon: <Sun size={20} /> },
  { mode: 'dark', label: 'Dark', icon: <Moon size={20} /> }
]

const readerNavigationOptions: { mode: ReaderNavigationMode; label: string; icon: JSX.Element; description: string }[] = [
  { mode: 'swipe', label: 'Swipe', icon: <ArrowsLeftRight size={20} />, description: 'Swipe left/right to turn pages' },
  { mode: 'scroll', label: 'Scroll', icon: <ArrowsDownUp size={20} />, description: 'Drag up/down to read down the page' }
]

/**
 * Settings — the one page where this foundation ships genuinely working
 * controls (theme mode, large text) rather than placeholders, since Theme
 * System and Accessibility are Task 3 deliverables in their own right.
 * Module Activation task: the Modules list below now reflects real
 * shipped status (see `config/modules.ts`) instead of a hardcoded
 * "Coming soon" list. Export and restore-from-backup import both work —
 * see `core/export` for what a backup can and can't include (uploaded
 * book/image files themselves never are).
 */
export function SettingsPage() {
  const { mode, setMode, largeText, setLargeText } = useTheme()
  const [readerNavigationMode, setReaderNavigationMode] = useReaderNavigationMode()
  const [importOpen, setImportOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

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
          Every shipped module is active by default. AI stays off until you choose to turn it on.
        </p>
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {moduleStatusList.map(({ id, label, icon: ModuleIcon, status }) => (
            <li key={id} className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 font-ui text-ui text-ink-primary">
                <ModuleIcon size={18} />
                {label}
              </span>
              {status === 'active' ? (
                <span className="flex items-center gap-1 rounded-full bg-olive/15 px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-olive">
                  <CheckCircle size={14} weight="fill" />
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-border px-2 py-0.5 font-ui text-micro uppercase tracking-wide text-ink-tertiary">
                  Optional · Off
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">Your data</h2>
        <p className="mb-4 font-body text-body text-ink-secondary">
          Everything you create in Cellfie stays on this device. Export a full JSON backup of your library metadata,
          study progress, concepts, saved study content, notes, highlights, bookmarks, annotations, and your custom
          work across Cellfie's modules (Notes has its own Markdown export too). Import merges a backup back in —
          your uploaded book/image files themselves aren't part of a backup and can't be restored this way, only the
          data that references them.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" icon={<Download size={18} />} onClick={() => void exportJsonBackup()}>
            Export JSON backup
          </Button>
          <Button variant="secondary" icon={<Upload size={18} />} onClick={() => setImportOpen(true)}>
            Import
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 font-display text-h2 font-medium text-ink-primary">About</h2>
        <button
          onClick={() => setAboutOpen(true)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-surface p-4"
        >
          <span className="flex items-center gap-3 font-ui text-ui font-medium text-ink-primary">
            <Info size={20} />
            About Cellfie
          </span>
          <span className="font-ui text-caption text-ink-tertiary">Built by thatbrowncraft 🧬</span>
        </button>
      </section>

      <ImportBackupDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </ReadingLayout>
  )
}
