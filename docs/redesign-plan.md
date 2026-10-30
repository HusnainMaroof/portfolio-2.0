# Redesign plan

Research: `docs/research/` (screenshots, 30 Oct 2026). Awwwards portfolio nominees and winners:
dennissnellenberg.com, dakshgajjar.com, mananthakkar.dev, devinthehood.com, bruno-simon.com.

## What the best ones do

- One idea per screen. Big type carries it; nothing explains it underneath.
- Few sections: hero, work, about/stack, contact. Snellenberg's whole home page is four.
- Work is a list of names. Title, role, year. The image shows on hover or on the case page.
- Contact is one huge line, the email, local time. No paragraph.
- The mini avatar (Thakkar) is a guide: it sits in one fixed spot, says one short line per
  section, and comes forward at contact. It does not chase the pointer.

## Rules for every change

- No small supporting line under a heading. No eyebrow labels. No icons (logos, lucide, emoji).
- No jargon or filler: "seamless", "cutting-edge", "passionate", "scalable", "pixel-perfect".
- No new facts. Every word comes from `src/lib/data.ts`, `src/content/hero.ts` or existing copy.
- Keep the identity: near-black, off-white `#f2efe8`, one green `#00F050`, Instrument Serif for
  the name, Anton for headings, Roboto Flex for body.
- Keep reduced-motion support, keyboard focus states and the `data-avatar` attributes.

## Tasks

1. Hero (`Banner.tsx`, `content/hero.ts`): portrait, name, one plain sentence. Remove the stats,
   the Top 5% note and the icon socials. Socials become plain text links. Add "Islamabad" and
   the live local time as small corner text.
2. Projects (`SelectedWork*.tsx`): drop the intro paragraph and the view switcher. One list:
   number, title in Anton, role and year. Hovering a row shows its first screenshot following
   the pointer. Rows link to the case page.
3. Stack (`Skills.tsx`): no logos. Category in muted Anton, the tools as one line of plain text.
4. Experience (`Experiences.tsx`): one row per role, company / title / years aligned, thin rules.
5. Contact (`Footer.tsx`): "Let's talk" stays. Remove the green dot label and the long paragraph.
   The email in large type as the link, local time, plain text socials. No star/fork icons.
6. Navigation (new `SiteMenu.tsx` replaces `portfolio-sidebar.tsx`; no sidebar at all): plain
   text links top-right (Work, Stack, Experience, Contact). After scrolling past the hero they
   collapse into one round green button fixed top-right. It opens a dark panel from the right:
   huge text links, a dot beside the current section, plain text socials. Same on phones (replaces
   the bottom bar). Escape and outside click close it; focus stays inside while open.
   Research: `11-snellenberg-work-list-menu-button.jpg`, `12-snellenberg-menu-open.jpg`.
7. Preloader (`Preloader.tsx`): lock scrolling until it has finished (the live site can scroll
   underneath it and shows the bars over the projects).
8. Onee (`AvatarInteractions.tsx`, `lib/avatar-interactions.ts`): guide mode. Docked
   bottom-right, one short line when a section enters view, larger at contact. Hover moves only
   for projects. Rewrite the messages: short, first person, plain, no jokes about bugs or coffee.
