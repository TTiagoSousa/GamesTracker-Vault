# 11 · Design system

The design is called **Ember**. The idea is simple: the games carry the colour. The
interface is a dark, neutral stage so that cover art and screenshots stand out, and a
single warm ember orange marks what you can do (buttons, links, the active tab, focus).
Red is reserved for errors. Game statuses keep their own colours because they carry
meaning.

Night is the main theme and the default (`ThemeContext.tsx` falls back to `'dark'` when
nothing is stored). Day is the same layout under the lights. There is also an `auto`
mode that uses night from 20:00 to 07:00.

The colours are in [12 · Palette](./12-color-palette.md). Everything else is here.

## Principles

1. **The art is the colour.** Home opens on a spotlight over the game's own artwork, the
   game page has the game's screenshot behind its header, and covers are shown face on.
   The surfaces around them stay neutral greys.
2. **One accent.** Ember orange (`--accent`) is for the primary action (`Solid_Button`),
   the active tab, focus outlines, links, selected chips and the avatar. There is no
   second accent and no brand gradient.
3. **Statuses have their own colours, and only statuses use them.** Playing is amber,
   finished is green, 100% is violet, dropped is slate, "to play" is blue
   (`--game-status-*`). They appear on shelf dividers, cover spines, status dots, the
   shelf panel markers and charts. The accent never stands in for a status.
4. **Sections, not cards.** A page section is a rule on top and air around it
   (`Panel_Surface`). Only things that really are containers get a frame
   (`Frame_Surface`): the assistant chat, the shelf form.
5. **Radii by hierarchy.** Frames 8px, controls 6px, covers and spines 3px.
6. **Flat by default, shadow only on what floats.** Menus, modals, the mobile shelf bar and
   the shelf arrows use `--float-shadow`. Covers lift with a local shadow on hover.
7. **Nothing jumps.** Things that appear and disappear reserve their space
   (`visibility: hidden`, fixed-height rows, two lines reserved for names), and `<html>`
   always shows its scrollbar.

## Typography

Loaded from Google Fonts in `Styles/Fonts.scss`:

| Family | Variable | Weights loaded | Role |
|---|---|---|---|
| **Jost** | `$font_family_display` | 500, 600, 700 | headings, brand, shelf labels, big numbers (ratings, counts) |
| **Rethink Sans** | `$font_family_sans` | 400–700 | everything else; the `body` font |
| **JetBrains Mono** | `$font_family_mono` | 400–700 | code only: versions, commits, tokens, paths, keys |

Rethink Sans turns `(0)` into a circled digit through its ligatures, so `body` turns
off `calt`, `liga` and `dlig`, and form controls inherit that setting.

Headings use weight 600 with `letter-spacing: 0`. There is no forced uppercase and no
eyebrow above headings.

### Common sizes

| Use | Family | Size | Weight |
|---|---|---|---|
| Page title (`Page_Header`) | Jost | `clamp(28px, 3vw, 40px)` | 600 |
| Home spotlight title | Jost | `clamp(28px, 3.4vw, 44px)` | 600 |
| Game page title | Jost | `clamp(28px, 3.4vw, 46px)` | 600 |
| Game page rating value | Jost | 35px (22px below 720px) | 600 |
| Home shelf count / label | Jost | 21px / 16px | 600 |
| Modal title (shared, `App.scss`) | Jost | 19px | 600 |
| Brand in the top bar | Jost | 17px (14px on mobile) | 600 |
| Section title (`Section_Title`) | Jost | 16px default | 600 |
| Top bar tab | Rethink Sans | 14px | 500 |
| Button (`Ghost_Button` / `Solid_Button`) | Rethink Sans | 14px | 600 |
| Caption (`Caption`) | Rethink Sans | 12px default | 600, `.01em` |

Modal titles are grouped at the end of `App.scss` (`.Admin_Create_User_Modal_Title`,
`.Update_Modal_Title`) so that they change together. A new modal adds its title there.

## Shapes

```scss
// Styles/Formats/Global.scss
$border-radius: 8px;   // framed areas and modals
$ctrl-radius:   6px;   // buttons, inputs, tabs
$spine-radius:  3px;   // spines and covers
```

Exposed as `--border-radius`, `--ctrl-radius` and `--spine-radius` (the same in both
themes). Round things (`50%`) are the avatar, status dots, the spotlight and shelf arrows,
the search score badge and the assistant's send button.

Borders and shadows are theme tokens in `Styles/Formats/Tokens.scss`: `--card-border`,
`--card-box-shadow` (`none` in both themes, kept so resting blocks can get a shadow back
from one place) and `--float-shadow`.

## Mixins (`Styles/Mixins.scss`)

| Mixin | What it does |
|---|---|
| `Pages_Configs` | page base: full width, flex column, `gap: 28px`, sans font |
| `Page_Header` | title on the left (`.Right_Side`, Jost `clamp(28px, 3vw, 40px)` 600) and actions on the right (`.Left_Side`); wraps when space runs out. The side names are swapped, a legacy kept to avoid touching every page |
| `Caption($size: 12px)` | sans 600, `.01em`: column headers, keys, metadata |
| `Section_Title($size: 16px)` | Jost 600: a section title |
| `Panel_Surface` | a page section with no box: transparent, only `border-top: 1px solid var(--line-strong)`, no radius |
| `Frame_Surface` | a real container: `--surface`, `--card-border`, `--border-radius` |
| `Control_Surface` | inputs, textareas, selects: `--surface-2`, `--line-strong` border, `--ctrl-radius`; on focus an `--accent` border plus a 1px `--accent` ring; disabled at 45% |
| `Ghost_Button` | secondary button: `--surface`, `--line-strong` border, main text, 14px 600; hover turns the border `--text-main`; focus ring in `--accent` |
| `Solid_Button` | primary button: `Ghost_Button` with `--accent` background and `--on-accent` text; hover `--accent-bright` |
| `Modal_Overlay` | fixed `--overlay-scrim` backdrop, centred, `z-index: 1000`, 16px padding |
| `Modal_Panel` | `--surface`, `--card-border`, `--border-radius`, `--float-shadow`, `vaultPop` entrance |

Use the mixins instead of repeating the declarations.

## The logo

`Assets/Icons/Logo/Logo.tsx` is a vault dial with a play triangle in the middle: a ring,
four short notches at the cardinal points (they also read as a crosshair) and a filled
triangle. It draws in a single colour (`color` prop, `currentColor` by default). The top
bar and the login draw it in `--accent`; the Android download card draws it in
`--on-accent` on an accent tile; the assistant uses it as its avatar and its intro mark.

## Main screens

### Layout

`Pages/Private/Main/Main.scss` stacks the top bar and the content. `.Vault_Content` is
up to 1600px wide with `32px 24px 64px` padding (`16px 16px 48px` below 760px). `.Vault`
has `overflow-x: clip` so full-width art never causes a sideways scroll. Below 760px it
also reserves `--bottom-nav-height` (`62px + env(safe-area-inset-bottom)`, 0 on
desktop) for the bottom bar; anything fixed to the bottom of the screen uses that
variable.

### Top bar (`Containers/Navigation/Top_Nav`)

Dark in both themes, like a game's menu bar: `--bar-bg` with a 1px `--bar-line` at the
bottom, `position: sticky`, `z-index: 50`. The inside is 64px tall, the same width and
margins as the content, laid out as a `1fr auto 1fr` grid:

- **Brand** on the left: the 30px logo in `--accent` and the name in Jost 17px.
- **Tabs** in the centre (Home, Stats, Assistant, Settings, and Admin for admins): plain
  text in `--bar-soft`, `--bar-text` on hover. The active tab is `--bar-text` with a 2px
  `--accent` line along the bottom edge of the bar.
- **Actions** on the right: search and theme icon buttons (40px, transparent,
  `--bar-soft`; search turns `--accent` on `/Vault/Search`; the theme button shows sun or
  moon) and a round 34px avatar in `--accent` with the initial in Jost. The avatar opens
  the account menu: a `--surface` panel with `--float-shadow`; "Log out" turns
  `--danger-color` on hover.

Below 760px the bar is 56px with only the brand, theme button and avatar (36px); tabs and
search move to `Bottom_Nav`, a fixed bar in `--surface` whose active item is `--accent`.

### Home (`Pages/Private/Home`)

Top to bottom: a short greeting (20px, `--text-soft`), the spotlight, four shelves and the
random pick.

**Spotlight** (`Home_Spotlight.tsx`) shows up to five games, one at a time: playing and
paused games first, then the most recently updated. It fills a 420px block (360px on
mobile) with the game's first screenshot at 1080p, or, if there is none, the cover blown up
and blurred. A left-to-right and bottom-up dark gradient keeps the text readable. Text
uses the fixed `--art-ink` / `--art-soft` tokens: a status line with a dot in the status
colour, the title, year / hours / platform / rating, three lines of summary and a
`Solid_Button` to open the game. Covers of the other slides sit bottom right (the active
one raised with an `--accent` border), round arrows top right, and a 2px `--accent` timer
line fills along the bottom. It advances every 9 seconds and pauses on hover or focus;
arrow keys also move it. With reduced motion it does not advance and the timer is hidden.

**Shelves** are one per group: playing, done, later, dropped. Each shelf is a
`48px | 1fr` grid. On the left a **divider**, a coloured spine the height of a cover, in
the shelf colour (`--shelf-color`) with the count and the shelf name written bottom to
top. On the right a row of covers (`--case-width: 136px`, 116px below 720px) that scrolls
horizontally with snap points and a hidden scrollbar; round arrows appear at the ends on
hover (not on touch screens). Each cover is 3:4 with `--spine-radius` and a 6px spine strip
in the status colour on its left edge. On hover the cover lifts 4px and a gradient
"peek" shows the status and what was logged. Below the cover: the name (two lines
reserved) and a meta line. An empty shelf is a short divider with a sentence beside it.

**Random pick** is a `Panel_Surface` with text and buttons on the left and a 128px result
space on the right (96px on mobile).

### Game page (`Pages/Private/Game`)

A `1fr 360px` grid: content on the left, the "My shelf" panel (`Library_Panel`) on the
right, sticky while scrolling. Below 1080px the panel moves into a bottom sheet opened
from a floating bar above the bottom navigation.

**Backdrop.** `.Game_Backdrop` puts the game's art behind the top of the page, edge to
edge (`100vw`, 620px tall, 420px on mobile), at 50% opacity at night and 28% by day. Two
gradients into `--hero-fade` (the page colour) blend it into the page at the bottom and
behind the text on the left. The content sits above it (`z-index: 1`).

**Top.** A `260px | 1fr` grid: the 3:4 cover with a 10px `--text-main` spine strip and a
large shadow, then the title, subtitle, three ratings side by side (Jost 35px values
separated by `--line-strong` rules) and a `dl` of facts. Below 720px the cover shrinks to
104px beside the title and the ratings and facts go full width.

**Body.** The summary (`1.5fr`) next to a column with play times and details; one column
below 860px. Then images and videos in a horizontal row, and related games as cover
shelves (`Components/Game_Shelf`). Section titles are Jost 17px.

### Search (`Pages/Private/Search`)

A fixed workspace: the search bar sticks under the top bar, the 300px filter column
sticks under it with its own scroll, and only the results grid scrolls. Filters are
collapsible groups; chips and counts use `--accent` when active. Below 900px the filters
open in a side panel over `--overlay-scrim`.

Results (`Game_Result`) are a grid of covers (`minmax(150px, 1fr)`, 120px on narrow
screens). They have **no** spine strip, since these games are not on the user's shelf. On
hover a cover lifts and a gradient shows its genres. The score sits in a round dark badge
whose ring is coloured like review sites: 85 and up `--game-status-finished`, 70 and up
`--game-status-playing`, below that `--game-status-dropped`.

### Assistant (`Pages/Private/Assistant`)

Exactly the height of the screen and never scrolls as a page. A `1fr 300px` grid (one
column below 980px): the chat as a `Frame_Surface` on `--surface`, and a side column with
suggestions and links. The empty chat shows the logo in `--accent` with a slow glow
(`assistantGlow`, off under reduced motion). The user's messages are bubbles on the right
in `--accent-soft` with an `--accent-deep` border; the assistant's replies sit on the left
with no box, next to a round avatar holding the logo. The input is a rounded textarea
(26px radius) on `--surface-2`, with a round send button.

### Other screens

The login (`Pages/Public/Index`) is a dark stage (`--stage-*`) with a decorative shelf of
`Spine` components (`Components/Spine`), which take one of six fixed tones. Stats uses
spines as a chart (`.Stats_Spines`, one per status, width by count). Settings, Admin and
Help are built from `Page_Header`, `Panel_Surface` sections and the button and control
mixins.

## Animations

| Keyframe | Defined in | Used for |
|---|---|---|
| `vaultPop` | `App.scss` | modals, account menu, dropdowns |
| `spotlightIn`, `spotlightText`, `spotlightTimer` | `Home.scss` | spotlight art, text and timer line |
| `backdropIn` | `Game.scss` | game backdrop fade-in |
| `assistantGlow` | `Assistant.scss` | assistant intro mark |
| `sa-fade-in`, `sa-fade-out` | `Simple_Alert.scss` | toasts |
| `Update_Modal_pulse` | `Update_Modal.scss` | update step in progress |

A global rule at the end of `App.scss` cuts every animation and transition to ~0 under
`prefers-reduced-motion`, and the spotlight, cover lift and assistant glow also switch
themselves off.

## Global details

- Scrollbars: thin, thumb in `--line-strong`, `--accent` on hover.
- Text selection: `--accent` background, `--on-accent` text.
- `color-scheme` follows the theme class (`.Dark_Mode` / `.Light_Mode`), and checkboxes
  and radios use `accent-color: var(--accent)`.

## SCSS naming

Classes in `Pascal_Snake_Case` with the component name as prefix (`.Home_Shelf_Divider`,
`.Game_Backdrop`, `.Top_Nav_Avatar`). Each component imports its sibling `.scss`. There
are no CSS Modules.

## Rules for new code

1. No hex or `rgba()` in a component; use a token, and add one to `Colors/Tokens.scss`
   with values for both themes if none fits (exceptions in
   [12](./12-color-palette.md#exceptions)).
2. Use the mixins; radii only through `--border-radius`, `--ctrl-radius` or
   `--spine-radius`.
3. Sections are `Panel_Surface`; frame only real containers. Shadows only on what floats.
4. Statuses only with `--game-status-*`; the accent is for action, focus and selection.
5. Text over game art uses `--art-ink` / `--art-soft`, whatever the theme.
6. Jost for headings and numbers, Rethink Sans for text, JetBrains Mono only for code.
7. Anything that moves needs a `prefers-reduced-motion` fallback.
8. Mobile adjustments go in a `@media (max-width: 760px)` block at the end of the
   component's `.scss`; anything fixed to the bottom subtracts `--bottom-nav-height`.
