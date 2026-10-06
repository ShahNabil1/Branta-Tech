# Smooth mobile menu without layout shift

## What will change
- Keep the menu in a fixed full-screen layer so it never changes page or header dimensions.
- Lock background scrolling without removing the scrollbar width, preventing horizontal jumps.
- Animate the menu layer, header controls, navigation rows, expandable groups, and bottom actions with Framer Motion.
- Keep open and close animations mounted until the exit transition finishes.
- Respect reduced-motion preferences and preserve focus, Escape-to-close, navigation close, and touch scrolling.

## Technical details
- Add the lightweight `motion` React package.
- Use `AnimatePresence` at the portal boundary and transform/opacity-only transitions for stable, GPU-friendly animation.
- Compensate body scrollbar width while locked, then restore every changed body style exactly on close.
- Animate accordion height with clipped overflow while keeping the outer full-screen layer dimensionally fixed.
- Verify repeated open/close cycles at the current 393×489 viewport by measuring the header, page content, and horizontal scroll position before, during, and after animation.
