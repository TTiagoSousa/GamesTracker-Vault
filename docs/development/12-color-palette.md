# 12 · Colour palette

The **Ember** palette: a dark, neutral stage so the game art carries the colour, and one
warm ember orange as the accent. Night is the main theme and the default; day is the same
layout under the lights. The two are separate palettes, not one inverted from the other.

Game statuses have their own colours: **amber** (playing), **green** (finished),
**violet** (100%), **slate** (dropped) and **blue** (to play). Red is kept for errors.

## How it works

Three layers, in `apps/frontend/src/Styles/`:

1. `Colors/Global.scss` holds the base palette as SCSS variables (`$night-*`, `$day-*`,
   status and semantic colours). Only `Tokens.scss` reads it.
2. `Colors/Tokens.scss` maps each **role** to a pair `(night, day)` in `$theme`, and the
   few colours that are identical in both themes in `$fixed`.
3. `Colors/Theme.scss` writes the first value of each pair as a CSS variable under
   `.Dark_Mode`, the second under `.Light_Mode`, and `$fixed` under `:root`.

`ThemeContext.tsx` puts `Dark_Mode` or `Light_Mode` on `<body>`. The stored mode
(`localStorage.mode`) is `dark`, `light` or `auto`; with nothing stored it is `dark`.
`auto` uses night from 20:00 to 07:00.

Shapes (borders, shadows, radii) follow the same pattern in `Formats/Tokens.scss` and
`Formats/Theme.scss`.

## Base palette (`Colors/Global.scss`)

| Role | Night | Day |
|---|---|---|
| Background (`bg`) | `#0E0E12` | `#ECECEF` |
| Surface | `#17171D` | `#F8F8FA` |
| Surface 2 (inset: inputs, tracks) | `#1F1F27` | `#E1E1E6` |
| Surface 3 | `#2A2A33` | `#D4D4DB` |
| Line | `rgba(255, 255, 255, .08)` | `rgba(20, 20, 28, .10)` |
| Line 2 (strong) | `rgba(255, 255, 255, .16)` | `rgba(20, 20, 28, .20)` |
| Text | `#F2F0EC` | `#16161D` |
| Soft text | `#A9A7B0` | `#50505C` |
| Faint text | `#6E6C77` | `#85858F` |
| Accent (ember) | `#FF8A1F` | `#D45F00` |
| Accent bright (hover) | `#FFA54F` | `#B34E00` |
| Accent deep | `#4A2508` | `#F8D9C0` |

By day the accent is darker (`#D45F00`) so it holds contrast on a light background, and
"bright" means the hover step, which by day is darker still.

### Game statuses

| Status | Night | Day |
|---|---|---|
| Playing (`$playing-*`) | `#FFB020` | `#D99100` |
| Finished (`$finished-*`) | `#3DD68C` | `#149A5C` |
| 100% (`$beaten-*`) | `#A78BFA` | `#7653EE` |
| Dropped (`$dropped-*`) | `#8B8D9E` | `#6E7083` |

"To play" has no variable in `Global.scss`; its pair is written directly in the token
(`--game-status-later`: `#5AA9FF` night, `#2A78D6` day).

### Semantic

| | Night | Day |
|---|---|---|
| Success | `#3DD68C` | `#107A49` |
| Warning | `#FFB020` | `#A36B00` |
| Danger | `#FF6B6B` | `#C62828` |
| Info | `#A9A7B0` | `#50505C` |

## Tokens (CSS variables)

Theme tokens from `$theme` in `Colors/Tokens.scss`. Names describe the colour's role, not
where it is used.

| Token | Night | Day | Use |
|---|---|---|---|
| `--bg` | `#0E0E12` | `#ECECEF` | page background |
| `--surface` | `#17171D` | `#F8F8FA` | frames, menus, modals, ghost buttons |
| `--surface-2` | `#1F1F27` | `#E1E1E6` | inputs, tracks, cover placeholders, hover rows |
| `--surface-3` | `#2A2A33` | `#D4D4DB` | most raised fill |
| `--line` | white .08 | ink .10 | rules between rows |
| `--line-strong` | white .16 | ink .20 | control borders, section rules, scrollbar thumb |
| `--text-main` | `#F2F0EC` | `#16161D` | main text |
| `--text-soft` | `#A9A7B0` | `#50505C` | secondary text |
| `--text-faint` | `#6E6C77` | `#85858F` | metadata, placeholders |
| `--accent` | `#FF8A1F` | `#D45F00` | primary action, active tab, links, focus |
| `--accent-bright` | `#FFA54F` | `#B34E00` | hover on accent |
| `--accent-deep` | `#4A2508` | `#F8D9C0` | border of the user's chat bubble |
| `--accent-soft` | `rgba(255, 138, 31, .14)` | `rgba(212, 95, 0, .10)` | tinted backgrounds, focus halos |
| `--on-accent` | `#1A0C00` | `#FFFFFF` | text and icons on the accent |
| `--bar-bg` | `#0E0E12` | `#16161D` | top bar (dark in both themes) |
| `--bar-text` | `#F2F0EC` | `#F2F0EC` | top bar text |
| `--bar-soft` | `#8F8D97` | `#A3A1AB` | inactive tabs and icons |
| `--bar-line` | white .08 | white .10 | top bar bottom border |
| `--stage-bg` | `#08080B` | `#16161D` | login stage |
| `--stage-text` | `#F2F0EC` | `#F2F0EC` | login stage text and shelf board |
| `--stage-soft` | `#A9A7B0` | `#A9A7B0` | login stage secondary text |
| `--stage-line` | white .08 | white .12 | login stage lines |
| `--hero-fade` | `#0E0E12` | `#ECECEF` | colour that game art fades into (game backdrop) |
| `--game-status-playing` | `#FFB020` | `#D99100` | playing |
| `--game-status-finished` | `#3DD68C` | `#149A5C` | finished (main or with extras) |
| `--game-status-beaten` | `#A78BFA` | `#7653EE` | 100% |
| `--game-status-dropped` | `#8B8D9E` | `#6E7083` | dropped |
| `--game-status-later` | `#5AA9FF` | `#2A78D6` | to play |
| `--success` | `#3DD68C` | `#107A49` | OK states (cards, update steps, release fixes) |
| `--danger-color` | `#FF6B6B` | `#C62828` | errors, destructive actions |
| `--danger-color-soft` | `rgba(255, 107, 107, .14)` | `rgba(198, 40, 40, .09)` | error backgrounds |
| `--alert-success-background` | success | success | toast colours (`Simple_Alert`) |
| `--alert-warning-background` | warning | warning | |
| `--alert-error-background` | danger | danger | |
| `--alert-info-background` | info | info | |

"white .08" means `rgba(255, 255, 255, .08)`; "ink .10" means `rgba(20, 20, 28, .10)`.

### Fixed tokens (`$fixed`, in `:root`)

| Token | Value | Use |
|---|---|---|
| `--overlay-scrim` | `rgba(6, 6, 9, .66)` | behind modals, sheets, the mobile filter panel |
| `--art-ink` | `#F6F4F0` | text over game art (spotlight, search peek and score) |
| `--art-soft` | `rgba(246, 244, 240, .74)` | secondary text over game art |
| `--art-scrim` | `rgba(8, 8, 11, .55)` | dark layer over art |
| `--spine-1` … `--spine-6` | `#E8590C`, `#FFB020`, `#149A5C`, `#7653EE`, `#5C5E70`, `#2A2A33` | decorative spine tones (`Spine`, login shelf) |
| `--spine-ink` / `--spine-ink-dark` | `#FFFFFF` / `#16161D` | text on spines (dark ink on tone 2) |
| `--status-ink` | `#16161D` | text on status colours |

### Shape tokens (`Formats/Tokens.scss`)

| Token | Night | Day |
|---|---|---|
| `--card-border` | `1px solid rgba(200, 208, 255, .12)` | `1px solid rgba(15, 26, 60, .12)` |
| `--card-box-shadow` | `none` | `none` |
| `--float-shadow` | `0 8px 24px rgba(4, 7, 26, .5)` | `0 8px 24px rgba(15, 26, 60, .14)` |

Fixed: `--border-radius` 8px, `--ctrl-radius` 6px, `--spine-radius` 3px.

### Currently unused

No component reads `--stage-line`, `--art-scrim` or `--card-box-shadow`.

## Status colours in components

Components set a local `--status-color` from a `status-<STATUS>` class (Library_Panel,
Stats, the Home spotlight) so one rule can paint dots, markers and strips:

| Status | Colour |
|---|---|
| `PLAYING` | `--game-status-playing` |
| `FINISHED_MAIN`, `FINISHED_EXTRAS` | `--game-status-finished` |
| `COMPLETED_100` | `--game-status-beaten` |
| `PLAN_TO_PLAY` | `--game-status-later` |
| `DROPPED` | `--game-status-dropped` |
| `PAUSED` | `--text-soft` (`--art-soft` in the spotlight) |

Home shelves use `--shelf-color` per group: `playing` amber, `done` green, `later` blue,
`dropped` slate. Within a shelf, `PAUSED` covers get a `--text-soft` spine and
`COMPLETED_100` covers a violet one. Text on the amber and green dividers is
`--status-ink`; on blue and slate it is white.

Search scores reuse the status colours as a rating scale (85+ finished green, 70+ playing
amber, below that dropped slate). That is the only place a status colour means something
other than a status.

## Usage rules

1. **No hex outside `Colors/Tokens.scss`.** Components use `var(--token)`. If no token
   fits, add one to `$theme` with a value for **both** themes, or to `$fixed` if it is
   really the same in both.
2. **Never set a colour for one theme only.** Each `$theme` entry is a pair; a missing value
   breaks the other theme.
3. **Ember is for action, focus and selection.** Interface states use `--success`,
   `--danger-color` and `--alert-*`; game statuses use `--game-status-*`. The accent never
   stands in for a status.
4. **Text on colour:** `--on-accent` on the accent, `--status-ink` on status colours,
   `--spine-ink` / `--spine-ink-dark` on spines, `--stage-text` on the login stage,
   `--art-ink` / `--art-soft` over game art.
5. **The top bar is dark in both themes.** Inside it use `--bar-*`, not the page text tokens.
6. **Name by role.** A new token says what the colour does, not where it appears.

## Exceptions

Literal colours outside `Colors/Global.scss`, on purpose:

| Where | Why |
|---|---|
| `Colors/Tokens.scss` (`--accent-soft`, `--on-accent`, `--bar-*`, `--stage-*`, `--hero-fade`, `--game-status-later`, `--danger-color-soft`, `$fixed`) | literals inside the token file, which is the right place |
| `Formats/Tokens.scss` (`--card-border`, `--float-shadow`) | borders and shadows live with the shapes |
| `Home.scss` spotlight (`#08080B` background, `rgba(8, 8, 11, …)` gradients and arrow fills, translucent white thumbs and borders) and cover peek gradient | dark layers over game art, the same in both themes |
| `Search.scss` result peek, score badge and hover shadow (`rgba(8, 8, 11, …)`, `rgba(0, 0, 0, .45)`) | same reason |
| `Game.scss` cover shadow (`rgba(0, 0, 0, .5)`); `Home.scss` cover hover shadow | local lift shadows over art |
| `Home.scss` `--shelf-ink: #FFFFFF` on the `later` and `dropped` shelves | white text on blue and slate dividers |
| `Settings.scss` theme swatches (`.Settings_Swatch`) | they must show the other theme, not the current one. They still hold the previous palette's backgrounds (`#E9EBEF`, `#0D1230`), not the current `$day-bg` / `$night-bg` (`#ECECEF`, `#0E0E12`); update them when touching that file |
