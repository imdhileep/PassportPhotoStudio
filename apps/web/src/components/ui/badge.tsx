import * as React from "react";
import { cn } from "@/lib/utils";

export const Badge = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700",
      className
    )}
    {...props}
  />
);
