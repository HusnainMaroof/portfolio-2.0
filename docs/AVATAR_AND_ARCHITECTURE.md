# Portfolio Avatar and Project Architecture

## 1. How the avatar works

The avatar ("Onee") is one fixed-position element, rendered once in `src/app/layout.tsx`
through `src/components/AvatarInteractions.tsx`. It never re-mounts and there is only one
instance on the page.

### Where it is

| State | Position |
| --- | --- |
| Initial load | Home: bottom-right corner, 16px from the viewport edges (112px desktop, 84px below 768px wide) |
| After hovering a target | Beside the target (see rules below) |
| After the pointer leaves | Stays at the last target |
| Explicit reset (Escape, panel closed) | Returns to home |

### Where it moves to

Real page elements opt in with `data-avatar="<kind>"`:

| Kind | Where it is in the page |
| --- | --- |
| `name` | Your name in the banner (`src/app/_components/Banner.tsx`) |
| `bio` | Bio text in the banner |
| `action` | Banner action button |
| `project` | Project cards in `SelectedWorkList.tsx` and `SelectedWorkCarousel.tsx` |
| `skill` | Skill tags in `Skills.tsx` |
| `nav` | Section pills in `src/components/SectionPills.tsx` |
| `contact` | Contact links in `StickyEmail.tsx` and `src/components/Footer.tsx` |

Placement rule (`destinationFor`): the avatar tries four spots around the target's visible
part, in this order: right, left, below, above. It takes the first one that fits inside the
viewport, clamped to the viewport edges. It never overlaps the target.

### Movement rules

- **Hover (mouse) or focus (keyboard) a target**: the avatar glides to that target over 0.9s
  (`power3.inOut`). Re-hovering the same target does nothing.
- **Pointer leaves a target**: nothing moves. The avatar stays at its last destination.
- **Hover another target**: the same avatar glides to the new one.
- **Scroll or resize while anchored to a target**: the avatar follows the target (0.25s).
  If the target is off-screen, the avatar holds its last position, clamped inside the viewport.
- **Resize while at home**: the avatar recalculates home for the new size.
- **Escape** (with the panel closed): the explicit reset. The avatar returns home.
- **Touch**: tapping a target moves the avatar to it. Tapping empty space does nothing.
- **Gaze**: the head and eyes follow the pointer, except under reduced-motion settings.

### Hover text

- Hovering a registered target shows a short contextual message in a plain, compact text box
  beside the avatar (no cloud shape). The message is chosen from `src/lib/avatar-interactions.ts`
  and uses real portfolio data, such as the project title as a label.
- The text reveals character by character (GSAP SplitText, the same reveal used by `HoverText`).
- Hovering a different target replaces the message. Re-hovering the same target within
  2.5s shows no new message.
- Hover text is hidden while the click panel is open and returns when it closes.

### Click panel

- Clicking the avatar opens a compact panel with the greeting and quick actions.
  The avatar plays the `happy` animation while the panel is open and returns to its
  previous animation on close.
- Quick actions scroll smoothly with Lenis to real sections:

  | Action | Target |
  | --- | --- |
  | Show my projects | `#my-projects` |
  | Tell me about my experience | `#my-experience` |
  | Show my skills | `#my-stack` |
  | Let's get in touch | `#contact` |
  | Show client reviews | `#client-reviews` (omitted while no such section exists) |

- The panel closes on: the close button, a second click on the avatar, Escape, or a click
  outside the panel. Moving the pointer away or hovering other elements does not close it.
- Opening or closing the panel never moves the avatar.

### Animation source

- `src/Onee_avatar/` holds the avatar runtime and data (`avatar-runtime.ts`, `onee.avatar.ts`,
  `Onee.tsx`, `onee.index.ts`). The runtime draws the avatar as SVG and runs named animations.
- `src/lib/avatar-interactions.ts` maps trigger kinds to animations and reads `data-avatar` attributes.
- Movement is done with GSAP on the avatar's root element, using `overwrite: true` so each
  new move starts from the live position, with no snapping.

## 2. Project architecture

| Path | Purpose |
| --- | --- |
| `src/app/layout.tsx` | Root layout. Mounts the smooth-scroll provider (Lenis), cursor, avatar, preloader, particle background, sticky email, footer, and section pills. |
| `src/app/page.tsx` | Home page: Banner, SelectedWork (projects), Skills, Experiences. |
| `src/app/_components/` | Page sections: `Banner`, `SelectedWork*`, `Skills`, `Experiences`, `Project`, `AboutMe`, `StickyEmail`. |
| `src/app/projects/[slug]/` | Project detail page and `ProjectDetails` component. |
| `src/app/globals.css`, `tailwind.config.ts` | Styling. Colors are CSS variables (for example `background-light`, `primary`). |
| `src/components/` | Shared UI: `AvatarInteractions`, `SectionPills`, `Footer`, `Navbar`, `Button`, `HoverText`, `Scrollreveal`, `ThemeProvider`, and others. |
| `src/Onee_avatar/` | Avatar runtime and data (see above). |
| `src/lib/data.ts` | Site content: general info, projects, skills, and experience data. |
| `src/lib/projects.ts` | Helpers for project text and slide counters. Does not invent copy. |
| `src/lib/avatar-interactions.ts` | Avatar trigger kinds, reaction animations, and `data-avatar` parsing. |
| `src/types/index.ts` | Shared TypeScript types (for example `IProject`). |
| `public/` | Static assets and fonts. |

### Stack

- Next.js (App Router, static prerendering) with React and TypeScript
- Tailwind CSS
- GSAP (including SplitText) for animation
- Lenis for smooth scrolling (`lenis/react`)
- lucide-react for icons

### Adding a new avatar target

1. Add `data-avatar="<kind>"` to a real element. Add `data-avatar-label` for a real name or title.
2. Use only kinds defined in `src/lib/avatar-interactions.ts`.
3. Do not add copy the site does not already contain. The avatar only moves and animates.

### Adding a new quick-action section

Add an entry to `QUICK_ACTIONS` in `src/components/AvatarInteractions.tsx`, with the target
section's real `id`. It appears only when that element exists on the page.

## 3. Verification

- `tsc --noEmit`: passed
- `eslint components/AvatarInteractions.tsx`: passed
- `next build`: passed
- Browser checks (Chrome, production build): 25/25 passed. Covered home position, hover moves,
  persistence after leaving, moving to another target, panel open/close/toggle, outside click,
  keyboard Enter/Escape, each quick action scrolling to its section, and the mobile panel
  staying inside the viewport.
- Extra checks: the panel stays open when the pointer moves away and when hovering the name;
  a mobile tap on a project moves the avatar; no page errors.
- Limitations: visual design was checked by geometry and computed styles, not by eye.
  Reduced-motion behavior and frame-level smoothness were not measured.
