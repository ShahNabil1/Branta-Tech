import { cva, type VariantProps } from "class-variance-authority";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]",
        accent: "bg-accent text-accent-foreground hover:bg-[var(--accent-hover)]",
        secondary: "border border-input bg-surface/60 text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-9 px-4 text-small",
        md: "h-11 px-6 text-small",
        lg: "h-14 px-8 text-body",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  arrow,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & Variants & { arrow?: boolean }) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export const PrimaryButton = (p: ComponentPropsWithoutRef<typeof Button>) => <Button variant="primary" {...p} />;
export const SecondaryButton = (p: ComponentPropsWithoutRef<typeof Button>) => <Button variant="secondary" {...p} />;

export function ButtonLink({
  className,
  variant,
  size,
  arrow,
  children,
  ...props
}: LinkProps & Variants & { arrow?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

export function TextLink({ className, children, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      className={cn(
        "group inline-flex items-center gap-1 font-medium underline decoration-border decoration-1 underline-offset-[6px] transition-colors duration-200 hover:decoration-accent",
        className,
      )}
      {...props}
    >
      {children}
      <Arrow />
    </a>
  );
}

function Arrow() {
  return (
    <ArrowUpRight
      aria-hidden
      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    />
  );
}
