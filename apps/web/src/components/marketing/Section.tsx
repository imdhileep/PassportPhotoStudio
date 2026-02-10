import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

export function Section({ id, eyebrow, title, description, className, children }: SectionProps) {
  return (
    <section id={id} className={cn("mx-auto w-full max-w-6xl px-6 py-12", className)}>
      {(eyebrow || title || description) && (
        <div className="max-w-2xl">
          {eyebrow && <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{eyebrow}</p>}
          {title && <h2 className="mt-3 font-display text-3xl text-white">{title}</h2>}
          {description && <p className="mt-3 text-sm text-slate-300">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
