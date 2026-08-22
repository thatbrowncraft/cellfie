import type { Icon } from '@phosphor-icons/react'
import { BookOpen, GitBranch, Bug, Flask, Scales, Sparkle } from '@phosphor-icons/react'

export type ModuleStatus = 'active' | 'optional-off'

export interface ModuleStatusEntry {
  id: string
  label: string
  icon: Icon
  status: ModuleStatus
  /**
   * Present only for modules that already have a real route. Settings
   * only *displays* this — it never drives routing itself. See
   * `navigation.ts` / `app/router.tsx`, which register every shipped
   * route unconditionally already (Navigation Parity Correction).
   */
  path?: string
}

/**
 * Settings "Modules" status list — Module Activation task.
 *
 * This is a display-only status list for the Settings page. It does NOT
 * gate navigation or routing: every route referenced below was already
 * registered, unconditionally, in `navigation.ts`/`app/router.tsx` before
 * this file existed (see the Navigation Parity Correction note in
 * `navigation.ts` — all shipped sections have been reachable from both
 * the bottom nav and the sidebar since that fix). This file only changes
 * what the Settings page *says* about a module's status; it's kept
 * separate from navigation on purpose so editing it can never risk an
 * actual route.
 *
 * "Learn" has no separate route of its own yet — it and "Concept
 * Explorer" currently share one merged `/concepts` route, per
 * `navigation.ts`'s own doc comment ("kept as one route now so it can
 * split into two routes later without any redesign"). Both are listed
 * ACTIVE here since both are genuinely shipped today, just not yet split
 * into two URLs.
 *
 * "AI" has no route, no module folder, and no functionality at all — it
 * has not been built yet. It's listed here only so Settings can say
 * plainly that it will be optional and opt-in when it does ship. Do not
 * give it a `path`, and do not flip its status to 'active' until the
 * feature actually exists.
 */
export const moduleStatusList: ModuleStatusEntry[] = [
  { id: 'learn', label: 'Learn', icon: BookOpen, status: 'active', path: '/concepts' },
  { id: 'organism-explorer', label: 'Organism Explorer', icon: Bug, status: 'active', path: '/organisms' },
  { id: 'laboratory', label: 'Laboratory', icon: Flask, status: 'active', path: '/laboratory' },
  { id: 'concept-explorer', label: 'Concept Explorer', icon: GitBranch, status: 'active', path: '/concepts' },
  { id: 'comparison-studio', label: 'Comparison Studio', icon: Scales, status: 'active', path: '/comparison' },
  { id: 'ai', label: 'AI', icon: Sparkle, status: 'optional-off' }
]
