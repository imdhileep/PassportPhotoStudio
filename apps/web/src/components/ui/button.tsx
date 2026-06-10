import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-40 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        /* Primary: solid amber CTA */
        default:
          "bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:scale-[0.98]",
        /* Accent: same amber CTA */
        accent:
          "bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:scale-[0.98]",
        /* Ghost: transparent with subtle neutral hover */
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]",
        /* Outline: neutral light border */
        outline:
          "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98]",
        /* Destructive */
        destructive:
          "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]"
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
