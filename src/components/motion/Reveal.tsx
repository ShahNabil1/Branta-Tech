import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReveal } from "@/hooks/use-reveal";

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
};

/** Fade-up reveal on scroll. */
export function Reveal({ children, as: Tag = "div", delay = 0, className }: RevealProps) {
  const ref = useReveal<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Masked line reveal — wrap a single line of heading text. */
export function MaskReveal({ children, delay = 0, className }: Omit<RevealProps, "as">) {
  const ref = useReveal<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      className={cn("reveal-mask", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      <span>{children}</span>
    </span>
  );
}
