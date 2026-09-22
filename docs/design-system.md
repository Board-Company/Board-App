# Nimbus design system

Every colour, spacing step and type size in the app resolves through
[`nimbus/src/theme.ts`](../nimbus/src/theme.ts). Screens import tokens; they do not write
hex literals.

## Why

The theme was originally re-typed by hand in each screen's `StyleSheet.create` block.
Across 19 screens and 8 components that produced ~350 colour literals and a lot of drift:
`#fff` next to `#ffffff`, `#333` next to `#333333`, three reds (`#E84855`, `#E63946`,
`#D96C6C`) meaning "danger", and a dozen greys separated by a few points of luminance
that no one had chosen deliberately.

Consolidating them into named tokens makes the intent readable (`colors.textMuted` rather
than `#AEB8A8`), makes a palette change one edit, and makes accidental drift visible in
review.

## The palette

A single dark theme built around a muted olive accent.

### Backgrounds and surfaces

| Token | Value | Use |
|---|---|---|
| `background` | `#2A2A2A` | App background behind every screen |
| `backgroundDeep` | `#202020` | Recessed areas: board trays, list backdrops |
| `backgroundSunken` | `#151515` | Deepest neutral; sunken panels |
| `backgroundBlack` | `#111111` | Full-bleed overlays, darkest wells |
| `surface` | `#333333` | Default card / row surface |
| `surfaceRaised` | `#3A3A3A` | Raised or pressed state |
| `surfaceMuted` | `#292929` | Secondary rows, disabled chips |

### Accent and borders

| Token | Value | Use |
|---|---|---|
| `accent` | `#8CB369` | Buttons, icons, active states, eval bar (white side) |
| `accentDark` | `#24351B` | Filled backgrounds behind accent text |
| `accentDeep` | `#081005` | Eval bar (black side), deep fills |
| `accentTrack` | `#314420` | Track behind an enabled `Switch` |
| `border` | `#435C33` | The olive hairline that outlines cards — the signature edge |
| `borderMuted` | `#3C3C3C` | Neutral divider where olive is too loud |

### Text

| Token | Value | Use |
|---|---|---|
| `textPrimary` | `#FFFFFF` | Headings and primary copy |
| `textSecondary` | `#C8D5B9` | Supporting copy; the pale green that pairs with the accent |
| `textMuted` | `#AEB8A8` | De-emphasised labels and metadata |
| `textFaint` | `#8A8A8A` | Timestamps, counts |
| `textDisabled` | `#5D5D5D` | Disabled controls, inactive icons |
| `textPlaceholder` | `#6F7A68` | `TextInput` placeholders |
| `iconMuted` | `#5A6B52` | Chevrons and icons that should recede into a card |

### Status

| Token | Value | Use |
|---|---|---|
| `danger` | `#E84855` | Errors, resign/abort, losing eval |
| `dangerMuted` | `#D97B66` | Softer destructive icon buttons (clear history) |
| `dangerTint` | `rgba(232,72,85,.1)` | Wash behind inline error banners |
| `warning` | `#FF9B71` | Warnings, reconnecting states |
| `caution` | `#E8B84A` | The engine's "warn" status tone |
| `success` | `#8CB369` | Success — intentionally the same olive as the accent |
| `info` | `#4A90E2` | The only non-olive accent; light-theme move numbers |

### Scrims

`overlay` (`.6`), `overlayStrong` (`.7`), `overlaySoft` (`.45`) and `overlayDeep`
(a green-black `rgba(8,10,6,.78)` used by the end-of-game overlay).

### Board

Board squares sit deliberately **outside** the UI palette — `boardDark` `#769656` and
`boardLight` `#EEEED2` are the conventional tournament green and cream that players
expect, not brand colours. `boardLastMove` is the yellow highlight.

## Scales

```ts
spacing  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }   // 4pt rhythm
radius   = { sm: 8, md: 10, card: 12, lg: 14, pill: 999 }
typography = { eyebrow, caption, small, body, title, heading, display }
```

Screen gutters use `lg`; gaps inside a card use `sm`/`md`. `radius.card` matches the home
screen's action rows, which are the reference for how the tokens compose.

## Using it

```tsx
import { colors, spacing, radius } from '../theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  title: { color: colors.textPrimary },
  subtitle: { color: colors.textSecondary },
});
```

In JSX, pass tokens as expressions rather than strings:

```tsx
<Icon name="chevron-right" size={22} color={colors.iconMuted} />
```

## Rules

1. **No hex literals in screens or components.** If a colour has no token, add one with a
   comment saying what role it plays.
2. **One deliberate exception:** Google's brand blue on the Sign-In button, which must
   match Google's branding guidelines. It is commented in place.
3. **Name by role, not by appearance** — `textMuted`, not `lightGreen`. The value can
   change; the role shouldn't.

Check for regressions with:

```bash
cd nimbus
grep -rnE "#[0-9a-fA-F]{3,8}" src/screens src/components | grep -v theme.ts
npx tsc --noEmit
```
