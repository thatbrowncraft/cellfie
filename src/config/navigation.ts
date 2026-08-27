import type { Icon } from '@phosphor-icons/react'
import {
  House,
  BookOpen,
  GitBranch,
  Bug,
  Flask,
  Scales,
  NotePencil,
  Gear
} from '@phosphor-icons/react'

export interface NavItem {
  path: string
  label: string
  /**
   * Mobile nav label correction — the label shown in the bottom tab bar
   * and the sidebar's own nav list, kept short so long page names never
   * force items to shrink below a readable/collideable width. Optional:
   * falls back to `label` for every item that doesn't need a shorter
   * form. The full `label` (e.g. "Comparison Studio") still governs
   * anywhere else it's used — page titles are set independently by each
   * page, not derived from this config — so nothing else changes.
   */
  navLabel?: string
  icon: Icon
  /**
   * Navigation Parity Correction — the bottom tab bar and the hamburger
   * drawer/sidebar are two interfaces onto the SAME eight destinations,
   * not two different navigation sets. This used to gate the bottom bar
   * down to 5 "most-used" items (Laboratory, Comparison Studio, and
   * Settings were hamburger-only), so a person on mobile had no direct
   * one-tap path to those three sections at all. Every item is now
   * `true` — kept as a field (rather than deleted) so a future item can
   * still opt out explicitly if the app ever grows past 8 sections,
   * without another silent parity drift.
   */
  inBottomNav: boolean
}

/**
 * Navigation — Task 3 scope.
 *
 * The Software Design Document (v3, §8) specifies a fuller nav with Learn
 * and Concept Explorer as separate modules, plus Collections/Bookmarks as
 * top-level items. Task 3's brief explicitly scopes navigation to eight
 * pages for this foundation build: Dashboard, Library, Concepts, Organism
 * Explorer, Laboratory, Comparison Studio, Notes, Settings.
 *
 * "Concepts" is a placeholder home for what the SDD calls Learn + Concept
 * Explorer — kept as one route now so it can split into two routes later
 * without any redesign (the module folder, layout, and nav entry pattern
 * stays identical either way).
 *
 * Universal Search is reached via Cmd/Ctrl+K, not a nav item — per §10.7.
 *
 * Navigation Parity Correction — all eight sections are reachable
 * directly from BOTH the bottom tab bar (mobile) and the hamburger
 * drawer/sidebar; see `BottomNav.tsx` for how it fits all 8 on a phone
 * width (horizontally scrollable icon strip, same active styling as the
 * sidebar). Do not reintroduce a subset here — see `NavItem.inBottomNav`.
 */
export const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: House, inBottomNav: true },
  { path: '/library', label: 'Library', icon: BookOpen, inBottomNav: true },
  { path: '/concepts', label: 'Concepts', icon: GitBranch, inBottomNav: true },
  { path: '/organisms', label: 'Organism Explorer', navLabel: 'Organisms', icon: Bug, inBottomNav: true },
  { path: '/laboratory', label: 'Laboratory', icon: Flask, inBottomNav: true },
  { path: '/comparison', label: 'Comparison Studio', navLabel: 'Comparison', icon: Scales, inBottomNav: true },
  { path: '/notes', label: 'Study Vault', navLabel: 'Vault', icon: NotePencil, inBottomNav: true },
  { path: '/settings', label: 'Settings', icon: Gear, inBottomNav: true }
]
