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
  icon: Icon
  /** Shown in the mobile bottom tab bar (kept to the most-used 5, per platform convention). */
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
 */
export const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: House, inBottomNav: true },
  { path: '/library', label: 'Library', icon: BookOpen, inBottomNav: true },
  { path: '/concepts', label: 'Concepts', icon: GitBranch, inBottomNav: true },
  { path: '/organisms', label: 'Organism Explorer', icon: Bug, inBottomNav: true },
  { path: '/laboratory', label: 'Laboratory', icon: Flask, inBottomNav: false },
  { path: '/comparison', label: 'Comparison Studio', icon: Scales, inBottomNav: false },
  { path: '/notes', label: 'Notes', icon: NotePencil, inBottomNav: true },
  { path: '/settings', label: 'Settings', icon: Gear, inBottomNav: false }
]
