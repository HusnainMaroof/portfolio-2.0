"use client";

// ExpandTabs from Devigner UI, adapted to this project:
// - `motion/react` is `framer-motion` here (same library, v12).
// - `cn` comes from @/lib/utils.
// - The devignerui motion presets and reduced-motion hook are defined below,
//   so the component needs no extra package.
// - No `cursor-pointer`: the site hides the native cursor for its custom one,
//   and a cursor utility would bring the native one back over the tiles.
// - The tile fill uses hsl(var(--…)): this project's colour variables hold
//   bare HSL channels, not colours.

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
} from "framer-motion";
import { cn } from "@/lib/utils";

const SPRING_LAYOUT: Transition = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 };
const SPRING_SWAP: Transition = { type: "spring", stiffness: 520, damping: 34 };
const TWEEN_SWAP_ENTER: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };
const TWEEN_SWAP_LEAVE: Transition = { duration: 0.14, ease: [0.4, 0, 1, 1] };

const useReducedMotionPreference = () => useReducedMotion() ?? false;

/** Resting tile side, px. Local: 56 (upstream 72), a lighter top bar that
 *  fits five tiles on a 375px phone unscaled. */
const TILE = 56;
/** Room either side of the label in an open tile, px. */
const PAD = 28;
/** Badge dot diameter and how far it hangs past the tile's corner, px. */
const DOT = 14;
const DOT_OVERHANG = 2;
/** Clear ring cut out of the tile around the dot, px. */
const DOT_GAP = 5;
/** Radius of the hole cut in the tile under the dot plus its gap, px. */
const DOT_CUT = DOT / 2 + DOT_GAP;
/** Rounding where the hole meets the tile's top and right edges, px. */
const DOT_FILLET = 4;
/** Distance of the dot's center in from the tile's top and right edges. */
const DOT_INSET = DOT / 2 - DOT_OVERHANG;
/** Side of the mask tile drawn at the tile's top-right corner, px: room for
 *  the hole and both fillets. */
const MASK_BOX = 40;
/** How far the mask tile reaches past the tile's top and right edges, px.
 *  The notch runs on into it, so the image's edges, which the browser
 *  blends whenever the tile's animated width lands on a fractional pixel,
 *  fall outside the tile. Ending the notch flush with the tile's edge left
 *  a one-pixel line of tile flickering along it. */
const MASK_BLEED = 4;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The tile's mask with the dot's hole cut out at radius r: a circle while
 *  it is clear of the edges, then a notch whose corners on the top and right
 *  edges are rounded. The rounding grows from nothing as the circle passes
 *  the edges, so the shape changes smoothly as the dot scales. */
function dotMask(r: number) {
  const B = MASK_BOX;
  const c = DOT_INSET;
  const hx = B - c;
  const hy = c;
  let d = "";
  if (r > c) {
    const f = DOT_FILLET * Math.min(1, (r - c) / (DOT_CUT - c));
    // Fillet centers sit f in from an edge and r + f from the hole's center.
    const off = Math.sqrt((r + f) ** 2 - (c - f) ** 2);
    const f1 = { x: hx - off, y: f };
    const f2 = { x: B - f, y: hy + off };
    const toHole = (p: { x: number; y: number }) => ({
      x: p.x + ((hx - p.x) * f) / (r + f),
      y: p.y + ((hy - p.y) * f) / (r + f),
    });
    const p1 = toHole(f1);
    const p2 = toHole(f2);
    // The hole's arc runs the long way round, away from the corner.
    const a1 = Math.atan2(p1.y - hy, p1.x - hx);
    const a2 = Math.atan2(p2.y - hy, p2.x - hx);
    const sweep = (((a1 - a2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    d =
      `M${r2(f1.x)} 0` +
      `A${r2(f)} ${r2(f)} 0 0 1 ${r2(p1.x)} ${r2(p1.y)}` +
      `A${r2(r)} ${r2(r)} 0 ${sweep > Math.PI ? 1 : 0} 0 ${r2(p2.x)} ${r2(p2.y)}` +
      `A${r2(f)} ${r2(f)} 0 0 1 ${B} ${r2(f2.y)}` +
      `H${B + MASK_BLEED}V${-MASK_BLEED}H${r2(f1.x)}Z`;
  } else if (r > 0.01) {
    d = `M${r2(hx - r)} ${hy}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
  }
  // The view box starts MASK_BLEED above the tile so the path keeps the
  // tile corner at (B, 0).
  const side = B + MASK_BLEED;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${side}' height='${side}' viewBox='0 ${-MASK_BLEED} ${side} ${side}'><path d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}"), linear-gradient(#000, #000)`;
}

export interface ExpandTabsItem {
  label: string;
  /** Shown while the tile is closed. */
  icon: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  /** Shows a dot on the tile's corner; the text is read by screen readers,
   *  such as "New" or "3 unread". Once a tab is selected the dot moves to
   *  the selected tile, shrinking off one and growing on the other. */
  badge?: string;
}

export interface ExpandTabsClassNames {
  tab?: string;
  /** The open tile's fill. */
  active?: string;
  label?: string;
  badge?: string;
}

export interface ExpandTabsProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "defaultValue"
> {
  items: ExpandTabsItem[];
  /** Accessible name for the nav landmark. */
  label?: string;
  /** Fill of the open tile and the badge dot, any CSS color. The open tile's
   *  text is white, so pick a color dark enough to carry it. */
  color?: string;
  classNames?: ExpandTabsClassNames;
  /** Index of the selected tab, marked by the badge dot. Pass with
   *  onValueChange to control it. */
  value?: number | null;
  /** Selected tab on first render when uncontrolled. */
  defaultValue?: number | null;
  /** Called with the tab's index when it is clicked. */
  onValueChange?: (index: number) => void;
  /** Local addition: every tile shows its icon and label side by side at all
   *  times, and the selected tile is filled like a hovered one (no swap, no
   *  badge dot needed). */
  showLabels?: boolean;
}

function Tab({
  item,
  open,
  selected,
  dot,
  hasDot,
  reduced,
  color,
  classNames,
  onOpen,
  onClose,
  onActivate,
  showLabels,
}: {
  showLabels?: boolean;
  item: ExpandTabsItem;
  open: boolean;
  selected: boolean;
  /** Whether the badge dot shows on this tile. */
  dot: boolean;
  /** Whether the row has a dot at all, so every tile carries one to grow. */
  hasDot: boolean;
  reduced: boolean;
  color: string;
  classNames?: ExpandTabsClassNames;
  onOpen: () => void;
  onClose: () => void;
  onActivate: () => void;
}) {
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = React.useState(0);
  // Measured rather than animated to "auto": the label sits out of flow on
  // top of the icon, so the tile's own auto width would never include it.
  React.useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const measure = () => setLabelWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // showLabels swaps the label element, so the observer must re-attach.
  }, [showLabels]);

  // Width and fill share one spring, so they move as one and an interrupted
  // hover keeps its momentum instead of restarting.
  const box = reduced ? { duration: 0 } : SPRING_LAYOUT;
  // Both slots start together: a tile under a passing pointer for a frame or
  // three never has time to empty, so a quick sweep shows no blank tiles.
  // The outgoing slot is the faster one, so the overlap stays short and
  // blurred.
  const enter = reduced ? { duration: 0 } : TWEEN_SWAP_ENTER;
  // The dot and its hole share one spring, so the gap stays even while the
  // dot shrinks off one tile and grows on another.
  const cut = useMotionValue(dot ? DOT_CUT : 0);
  React.useEffect(() => {
    const anim = animate(
      cut,
      dot ? DOT_CUT : 0,
      reduced ? { duration: 0 } : SPRING_SWAP,
    );
    return () => anim.stop();
  }, [dot, reduced, cut]);
  const mask = useTransform(cut, dotMask);
  const dotScale = useTransform(cut, (r) => r / DOT_CUT);
  const leave = reduced ? { duration: 0 } : TWEEN_SWAP_LEAVE;
  const Tag = item.href ? "a" : "button";

  return (
    <li className="relative">
      <motion.div
        initial={false}
        animate={{
          width: showLabels
            ? labelWidth + PAD * 2
            : open
              ? Math.max(TILE, labelWidth + PAD * 2)
              : TILE,
        }}
        transition={box}
        style={{
          height: TILE,
          ...(hasDot && {
            maskImage: mask,
            WebkitMaskImage: mask,
            maskPosition: `right ${-MASK_BLEED}px top ${-MASK_BLEED}px, 0 0`,
            maskSize: `${MASK_BOX + MASK_BLEED}px ${MASK_BOX + MASK_BLEED}px, 100% 100%`,
            maskRepeat: "no-repeat",
            // The corner shape is what to remove, so it is excluded from
            // the full layer under it.
            maskComposite: "exclude",
          }),
        }}
        className={cn(
          "relative overflow-hidden rounded-[10px] bg-[color-mix(in_oklab,hsl(var(--foreground))_8%,hsl(var(--background)))] text-foreground transition-colors duration-200",
          classNames?.tab,
          // Local: the selected tile is filled too, so its icon must read on the fill.
          selected && "text-primary-foreground",
        )}
      >
        <motion.span
          aria-hidden
          initial={false}
          animate={{ opacity: open || selected ? 1 : 0 }}
          transition={box}
          style={{ backgroundColor: color }}
          className={cn("absolute inset-0", classNames?.active)}
        />
        <Tag
          {...(item.href ? { href: item.href } : { type: "button" as const })}
          // Movement, not enter: opening a tile reflows the row, which slides
          // another tile under a still pointer and fires its pointerenter.
          // Opening on enter flips the two back and forth for as long as the
          // pointer rests near their edge.
          onPointerMove={onOpen}
          onFocus={(e: React.FocusEvent<HTMLElement>) => {
            // A click focuses the tile too; only keyboard focus holds it open.
            if (e.currentTarget.matches(":focus-visible")) onOpen();
          }}
          onBlur={onClose}
          onClick={() => {
            onActivate();
            item.onSelect?.();
          }}
          aria-current={selected ? (item.href ? "page" : true) : undefined}
          className="absolute inset-0 grid place-items-center rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {showLabels ? (
            <span
              ref={labelRef}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap text-[13px] uppercase tracking-wider transition-colors duration-200 [&>svg]:size-[18px]",
                classNames?.label,
                open || selected ? "" : "text-muted-foreground",
              )}
            >
              <span aria-hidden className="grid place-items-center">
                {item.icon}
              </span>
              {item.label}
            </span>
          ) : (
          <>
          <AnimatePresence initial={false}>
            {!open && (
              <motion.span
                key="icon"
                aria-hidden
                initial={{ opacity: 0, scale: 0.6, filter: "blur(4px)" }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: enter,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.6,
                  filter: "blur(4px)",
                  transition: leave,
                }}
                className="absolute grid place-items-center [&>svg:not([class*='size-'])]:size-5"
              >
                {item.icon}
              </motion.span>
            )}
          </AnimatePresence>
          {/* Always in the DOM, so it names the link while hidden. */}
          <motion.span
            ref={labelRef}
            initial={false}
            animate={{
              opacity: open ? 1 : 0,
              filter: open ? "blur(0px)" : "blur(4px)",
            }}
            transition={open ? enter : leave}
            className={cn(
              "absolute font-mono text-[13px] font-normal tracking-wider whitespace-nowrap text-white uppercase",
              classNames?.label,
            )}
          >
            {item.label}
          </motion.span>
          </>
          )}
          {item.badge && <span className="sr-only">, {item.badge}</span>}
        </Tag>
      </motion.div>
      {hasDot && (
        <motion.span
          aria-hidden
          style={{
            backgroundColor: color,
            scale: dotScale,
            width: DOT,
            height: DOT,
            top: -DOT_OVERHANG,
            right: -DOT_OVERHANG,
          }}
          className={cn(
            "pointer-events-none absolute rounded-full",
            classNames?.badge,
          )}
        />
      )}
    </li>
  );
}

export const ExpandTabs = React.forwardRef<HTMLElement, ExpandTabsProps>(
  (
    {
      items,
      label = "Navigation",
      color = "#2152ff",
      className,
      classNames,
      value,
      defaultValue = null,
      onValueChange,
      showLabels = false,
      ...props
    },
    ref,
  ) => {
    const reduced = useReducedMotionPreference();
    const [hovered, setHovered] = React.useState<number | null>(null);
    const [internal, setInternal] = React.useState(defaultValue);
    const selected = value !== undefined ? value : internal;
    const badged = items.findIndex((item) => item.badge);
    // One dot: on the selected tile once there is one, else on the first
    // badged item.
    const dotAt = badged === -1 ? -1 : (selected ?? badged);

    return (
      <nav
        ref={ref}
        aria-label={label}
        className={cn("inline-flex", className)}
        {...props}
      >
        <ul
          className="flex items-center gap-1.5"
          // The row, not each tile: a reflow can pull a tile out from under
          // a still pointer, and that must not count as leaving.
          onPointerLeave={() => setHovered(null)}
        >
          {items.map((item, i) => (
            <Tab
              key={item.href ?? item.label}
              item={item}
              open={hovered === i}
              selected={selected === i}
              dot={dotAt === i}
              hasDot={dotAt !== -1}
              reduced={reduced}
              color={color}
              classNames={classNames}
              showLabels={showLabels}
              onOpen={() => setHovered(i)}
              onClose={() => setHovered((h) => (h === i ? null : h))}
              onActivate={() => {
                if (value === undefined) setInternal(i);
                onValueChange?.(i);
              }}
            />
          ))}
        </ul>
      </nav>
    );
  },
);
ExpandTabs.displayName = "ExpandTabs";
