import { Dialog, Button, CalloutBox } from '../../../shared/components'

interface AboutDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Settings → About Cellfie. Creator/copyright attribution content.
 *
 * Everything below is hardcoded static UI copy — there is no state, no
 * storage read/write (not localStorage, not IndexedDB), no network
 * request, and nothing here is user-editable. It exists purely as a
 * presentational dialog reusing the app's existing `Dialog`/`CalloutBox`/
 * `Button` components, same as every other Settings dialog.
 */
export function AboutDialog({ open, onClose }: AboutDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="About Cellfie" size="md" actions={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <p className="font-ui text-caption font-medium uppercase tracking-wide text-ink-tertiary">
          A tiny note from thatbrowncraft 🧬
        </p>

        <p className="font-body text-body text-ink-secondary">
          Hey, I'm thatbrowncraft, the human who dreamed up Cellfie, designed its direction, and kept poking at it
          until this little science lab became real. 🥹
        </p>

        <p className="font-body text-body text-ink-secondary">
          Cellfie's concept, product direction, architecture, feature ideas, UX decisions, visual direction,
          workflows, organisation, and overall creative implementation were developed under my direction, with AI
          tools helping me build and create parts of it.
        </p>

        <p className="font-body text-body text-ink-secondary">
          The books and references you bring into Cellfie are yours. Your library, notes, annotations and personal
          data are yours to manage, subject to the rights and licenses of the materials you provide.
        </p>

        <p className="font-body text-body text-ink-secondary">But Cellfie itself isn't a free-for-all template. 👀</p>

        <p className="font-body text-body text-ink-secondary">
          Please don't copy its original code, artwork, UI, written copy, distinctive workflows, structure, or
          substantially reproduce its implementation for another project without permission.
        </p>

        <p className="font-body text-body text-ink-secondary">Reference ≠ permission to clone. 😭</p>

        <p className="font-body text-body text-ink-secondary">
          Got inspired by something here and want to reuse it? Ask first. I'd much rather say yes properly than
          discover Cellfie somewhere else wearing a suspiciously familiar wig.
        </p>

        <p className="font-body text-body text-ink-secondary">
          Built with curiosity, questionable amounts of caffeine, and a frankly unreasonable love for science.
        </p>

        <p className="font-ui text-caption text-ink-tertiary">© thatbrowncraft</p>

        <p className="font-ui text-caption text-ink-tertiary">
          AI-assisted development notice: Some code, artwork, and other creative material in Cellfie was produced or
          refined with AI-assisted tools under the project's human direction and review. Third-party materials remain
          subject to their respective licenses and rights.
        </p>

        <CalloutBox type="aside" title="Copyright & attribution">
          <p className="mb-3">
            Unless otherwise stated by a third-party license, Cellfie's original code, artwork, interface design,
            written materials and creative implementation belong to thatbrowncraft.
          </p>
          <p className="mb-3">Third-party content and materials provided by users remain subject to their respective owners and licenses.</p>
          <p>Permission is required before reproducing or substantially adapting Cellfie's original creative work.</p>
        </CalloutBox>
      </div>
    </Dialog>
  )
}
