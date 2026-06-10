import { cn } from "@/lib/utils";

const steps = ["Camera", "Capture", "Background", "Refine", "Color", "Export"];

export const Stepper = ({
  active = 1,
  maxStep = steps.length,
  onStepChange
}: {
  active?: number;
  maxStep?: number;
  onStepChange?: (step: number) => void;
}) => (
  <div className="flex items-center gap-0">
    {steps.map((step, index) => {
      const stepIndex = index + 1;
      const isActive = stepIndex === active;
      const isCompleted = stepIndex < active;
      const isEnabled = stepIndex <= maxStep;
      const isLast = stepIndex === steps.length;

      return (
        <div key={step} className="flex items-center">
          <button
            type="button"
            disabled={!isEnabled}
            onClick={() => isEnabled && onStepChange?.(stepIndex)}
            className={cn(
              "group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200",
              isActive
                ? "bg-indigo-500/15 text-amber-700"
                : isCompleted
                  ? "text-amber-700/70 hover:bg-indigo-500/8 hover:text-amber-700"
                  : isEnabled
                    ? "text-slate-500 hover:bg-white hover:text-slate-500"
                    : "cursor-not-allowed text-slate-600"
            )}
          >
            {/* Step number circle */}
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200",
                isActive
                  ? "bg-indigo-500 text-slate-900 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  : isCompleted
                    ? "bg-indigo-600/60 text-amber-700"
                    : isEnabled
                      ? "border border-slate-200 bg-white text-slate-500"
                      : "border border-slate-200 text-slate-700"
              )}
            >
              {isCompleted ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                stepIndex
              )}
            </span>
            <span className="hidden sm:block">{step}</span>
          </button>

          {/* Connector line between steps */}
          {!isLast && (
            <div
              className={cn(
                "mx-0.5 h-px w-4 transition-colors duration-300",
                stepIndex < active ? "bg-indigo-500/40" : "bg-white"
              )}
            />
          )}
        </div>
      );
    })}
  </div>
);
