import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "accent";
type Size = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  default: "bg-denim-700 text-white hover:bg-denim-800 shadow-sm shadow-denim-900/10",
  outline: "border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-900",
  ghost: "hover:bg-slate-100 text-slate-900",
  destructive: "bg-red-600 text-white hover:bg-red-500",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  accent: "bg-thread-400 text-thread-900 hover:bg-thread-300 shadow-sm shadow-thread-900/10",
};

const sizeClasses: Record<Size, string> = {
  default: "h-11 px-4 py-2 text-sm md:h-10",
  sm: "h-9 px-3 text-xs md:h-8",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11 md:h-10 md:w-10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "tap-shrink inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thread-400 focus-visible:ring-offset-2 active:transition-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
