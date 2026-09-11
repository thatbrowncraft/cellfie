/**
 * core/world-explorer/projection — orthographic globe projection, hand
 * -written instead of pulling in a mapping library (d3-geo, three.js,
 * react-globe.gl, ...). Rationale, per brief §13/§14 (performance,
 * offline-first, "choose the smallest reasonable implementation"):
 * Cellfie's only dependencies today are React, react-router-dom, Dexie
 * and pdfjs-dist — no rendering/geo library at all. A WebGL 3D globe
 * library is hundreds of KB and pulls in three.js; this app is a
 * mobile-first offline PWA where that's a real cost for one feature.
 * An orthographic projection of country centroid POINTS (not full
 * country boundary polygons — see `countries.ts`'s doc comment for why
 * that dataset choice too) onto a 2D SVG circle needs nothing but the
 * trigonometry below, renders instantly, and works offline with zero
 * added bytes to the dependency graph.
 *
 * The trade-off being made explicitly: this draws a wireframe sphere
 * with each country as a labelled point, not textured landmasses with
 * real coastlines. That is a deliberate, disclosed scope decision, not
 * an oversight — see the World Explorer summary for the fuller
 * reasoning. It still delivers every interaction the brief asks for
 * (slow idle rotation, drag-to-rotate, tap a country, zoom, mobile
 * touch) — just via points-on-a-sphere rather than a full raster/vector
 * relief map.
 */

export interface Rotation {
  /** Spin around the vertical axis, in degrees — dragging left/right changes this. */
  lambda: number
  /** Tilt, in degrees — dragging up/down changes this. Clamped by the caller to keep the poles from flipping past vertical. */
  phi: number
}

export interface ProjectedPoint {
  /** SVG-space offset from the globe's centre, in the same units as `radius`. */
  x: number
  y: number
  /** False when the point is on the far side of the sphere (would be hidden behind the globe). */
  visible: boolean
  /** Depth, -1..1 — used to fade/shrink near-limb points and to sort front-most points on top. */
  depth: number
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Projects a (lat, lon) in degrees onto the 2D plane of a sphere of the
 * given `radius`, after rotating the globe by `rotation`. Verified by
 * hand against known reference points before use (lon=0,lat=0 → centre
 * front; lon=±90 → limb; lon=180 → hidden; lat=90 → top pole) — see the
 * World Explorer implementation notes for that check.
 */
export function project(lat: number, lon: number, rotation: Rotation, radius: number): ProjectedPoint {
  const phi = toRad(lat)
  const lambda = toRad(lon) - toRad(rotation.lambda)
  const rphi = toRad(rotation.phi)

  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const cosLambda = Math.cos(lambda)
  const sinLambda = Math.sin(lambda)

  // Point on the unit sphere after longitude (spin) rotation.
  const x0 = cosPhi * sinLambda
  const y0 = sinPhi
  const z0 = cosPhi * cosLambda

  // Tilt around the horizontal axis for vertical drag.
  const cosR = Math.cos(rphi)
  const sinR = Math.sin(rphi)
  const y1 = y0 * cosR - z0 * sinR
  const z1 = y0 * sinR + z0 * cosR

  return {
    x: x0 * radius,
    y: -y1 * radius,
    visible: z1 > 0,
    depth: z1
  }
}

/** Clamp the tilt so a vertical drag can't flip the globe upside down past the poles. */
export function clampPhi(phi: number): number {
  return Math.max(-89, Math.min(89, phi))
}

/** Normalises a spin angle back into the range -180 to 180 (exclusive/inclusive) so it never grows without bound during long drags. */
export function normalizeLambda(lambda: number): number {
  let l = lambda % 360
  if (l > 180) l -= 360
  if (l <= -180) l += 360
  return l
}

/**
 * One meridian (constant longitude) or parallel (constant latitude)
 * graticule line, as a sequence of already-projected points — split
 * into visible-only runs by the caller before drawing, since a
 * graticule line typically crosses to the far side of the globe.
 */
export function graticulePoints(
  kind: 'meridian' | 'parallel',
  value: number,
  rotation: Rotation,
  radius: number,
  steps = 48
): ProjectedPoint[] {
  const points: ProjectedPoint[] = []
  for (let i = 0; i <= steps; i++) {
    if (kind === 'meridian') {
      const lat = -90 + (180 * i) / steps
      points.push(project(lat, value, rotation, radius))
    } else {
      const lon = -180 + (360 * i) / steps
      points.push(project(value, lon, rotation, radius))
    }
  }
  return points
}
