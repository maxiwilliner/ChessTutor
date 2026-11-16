import React from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brass-400 text-ink-950 hover:bg-brass-300 shadow-brass disabled:bg-brass-700 disabled:text-ink-900 disabled:shadow-none",
  secondary: "border border-ink-500 bg-ink-750 text-ivory hover:border-ink-500 hover:bg-ink-700",
  ghost: "text-ivory-muted hover:bg-ink-750 hover:text-ivory",
  success: "bg-emerald-500 text-ink-950 hover:bg-emerald-400 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)]",
  danger: "border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
};

/** Clases de botón reutilizables también en `<Link>`. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition-[background-color,color,box-shadow,transform,border-color] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...props} />;
});

/** Tecla visual para mostrar atajos de teclado. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "num inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-ink-500 bg-ink-800 px-1 text-[10px] font-semibold text-ivory-muted",
        className
      )}
    >
      {children}
    </kbd>
  );
}
