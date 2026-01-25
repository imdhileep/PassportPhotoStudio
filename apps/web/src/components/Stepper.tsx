import { cn } from "@/lib/utils";

const steps = ["Camera", "Capture/Crop", "Background", "Refine", "Color", "Export"];

export const Stepper = ({
  active = 1,
  maxStep = steps.length,
  onStepChange
}: {
  active?: number;
  maxStep?: number;
  onStepChange?: (step: number) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {steps.map((step, index) => {
      const stepIndex = index + 1;
      const activeStep = stepIndex === active;
      const enabled = stepIndex <= maxStep;
      return (
        <button
          key={step}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide transition",
            activeStep ? "border-white text-white" : "border-white/20 text-slate-400",
            enabled ? "hover:border-white/50" : "cursor-not-allowed opacity-50"
          )}
          type="button"
          onClick={() => enabled && onStepChange?.(stepIndex)}
        >
          <span className={cn("h-2 w-2 rounded-full", activeStep ? "bg-ocean" : "bg-white/30")} />
          {step}
        </button>
      );
    })}
  </div>
);
