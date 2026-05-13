import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07070f] disabled:opacity-40 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        /* Primary: indigo gradient with glow */
        default:
          "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.35)] hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_22px_rgba(99,102,241,0.5)] active:scale-[0.97]",
        /* Accent: amber gradient for CTAs */
        accent:
          "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-[0_0_14px_rgba(245,158,11,0.3)] hover:from-amber-500 hover:to-yellow-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.45)] active:scale-[0.97]",
        /* Ghost: transparent with subtle hover */
        ghost:
          "text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-[0.97]",
        /* Outline: indigo-tinted border */
        outline:
          "border border-indigo-500/25 bg-indigo-500/5 text-slate-200 hover:border-indigo-400/50 hover:bg-indigo-500/12 hover:text-white active:scale-[0.97]",
        /* Destructive */
        destructive:
          "bg-red-600/90 text-white hover:bg-red-500 active:scale-[0.97]"
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);

Button.displayName = "Button";
