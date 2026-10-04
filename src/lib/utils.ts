import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the custom type-scale utilities as font sizes so they don't
// get merged away with text-color classes (e.g. text-primary-foreground).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display-xl",
        "text-display",
        "text-h1",
        "text-h2",
        "text-h3",
        "text-h4",
        "text-body-lg",
        "text-body",
        "text-small",
        "text-eyebrow",
        "text-caption",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
