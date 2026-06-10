import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-indigo-600 to-indigo-400" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-indigo-400/60 bg-white shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-shadow focus-visible:outline-none focus-visible:shadow-[0_0_12px_rgba(99,102,241,0.7)] hover:shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
  </SliderPrimitive.Root>
));

Slider.displayName = "Slider";
