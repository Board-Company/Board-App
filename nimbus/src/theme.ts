/**
 * Nimbus design tokens.
 *
 * The app is a single dark theme built around a muted olive accent. Before this
 * module the same handful of colours were re-typed as hex literals in every
 * screen, which is how we ended up with `#fff` next to `#ffffff`, three reds and
 * a dozen greys. Screens import from here instead; `home.tsx` is the reference
 * for how the tokens are meant to compose.
 */

export const colors = {
  /** App background behind every screen. */
  background: '#2A2A2A',
  /** Recessed areas: board trays, list backdrops, modal scrims. */
  backgroundDeep: '#202020',
  /** Deepest neutral, used for sunken panels and code-ish blocks. */
  backgroundSunken: '#151515',
  /** Near-black, for full-bleed overlays and the darkest wells. */
  backgroundBlack: '#111111',

  /** Default card / row surface. */
  surface: '#333333',
  /** Raised or pressed state of a surface. */
  surfaceRaised: '#3A3A3A',
  /** Quieter surface for secondary rows and disabled chips. */
  surfaceMuted: '#292929',

  /** Olive hairline that outlines cards — the app's signature edge. */
  border: '#435C33',
  /** Neutral divider where the olive edge would be too loud. */
  borderMuted: '#3C3C3C',

  /** Primary accent: buttons, icons, active states, eval bar (white side). */
  accent: '#8CB369',
  /** Accent pressed / filled backgrounds behind accent text. */
  accentDark: '#24351B',
  /** Darkest accent, for the eval bar's black side and deep fills. */
  accentDeep: '#081005',

  /** Headings and primary copy. */
  textPrimary: '#FFFFFF',
  /** Supporting copy; the pale green that pairs with the accent. */
  textSecondary: '#C8D5B9',
  /** De-emphasised labels and metadata. */
  textMuted: '#AEB8A8',
  /** Timestamps, counts, placeholder text. */
  textFaint: '#8A8A8A',
  /** Disabled controls and inactive icons. */
  textDisabled: '#5D5D5D',

  /** Errors, resign/abort actions, losing eval. */
  danger: '#E84855',
  /** Warnings and reconnecting states. */
  warning: '#FF9B71',
  /** Success; intentionally the same olive as the accent. */
  success: '#8CB369',

  /** Placeholder text inside TextInputs. */
  textPlaceholder: '#6F7A68',
  /** Chevrons and inactive icons that should recede into a card. */
  iconMuted: '#5A6B52',
  /** Softer destructive tone for icon buttons (clear history, delete). */
  dangerMuted: '#D97B66',
  /** Caution/gold — the engine's "warn" status tone. */
  caution: '#E8B84A',
  /** Filled track behind an enabled Switch. */
  accentTrack: '#314420',
  /** Neutral grey where the olive-tinted greys read as wrong (switch thumbs, grabbers). */
  neutral: '#D0D0D0',
  /** Divider on the light-theme move list. */
  lightBorder: '#E0E0E0',
  /** Informational blue — the only non-olive accent, used for light-theme move numbers. */
  info: '#4A90E2',
  /** True black, for the safe-area fill behind notched screens. */
  black: '#000000',

  /** Scrim behind modals and the end-of-game overlay. */
  overlay: 'rgba(0, 0, 0, 0.6)',
  /** Heavier scrim where board detail must drop away behind a sheet. */
  overlayStrong: 'rgba(0, 0, 0, 0.7)',
  /** Light scrim for bottom sheets that should still show the board. */
  overlaySoft: 'rgba(0, 0, 0, 0.45)',
  /** Green-black scrim used by the end-of-game overlay. */
  overlayDeep: 'rgba(8, 10, 6, 0.78)',
  /** 10% danger wash behind inline error banners. */
  dangerTint: 'rgba(232, 72, 85, 0.1)',

  /** Chess board squares. Deliberately outside the UI palette: these are the
   *  conventional tournament green/cream that players expect, not brand colours. */
  boardDark: '#769656',
  boardLight: '#EEEED2',
  boardLastMove: 'rgba(255, 255, 0, 0.5)',
} as const;

/** 4pt rhythm. Screen gutters are `lg`; gaps inside a card are `sm`/`md`. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Corner radii. `card` matches the home screen's action rows. */
export const radius = {
  sm: 8,
  md: 10,
  card: 12,
  lg: 14,
  pill: 999,
} as const;

/** Type ramp. Weights are strings because RN types them that way. */
export const typography = {
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  caption: { fontSize: 11, fontWeight: '600' },
  small: { fontSize: 12, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800' },
  heading: { fontSize: 20, fontWeight: '800' },
  display: { fontSize: 26, fontWeight: '800' },
} as const;

export const theme = { colors, spacing, radius, typography } as const;

export default theme;
