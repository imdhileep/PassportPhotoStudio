import { cn } from "@/lib/utils";

const steps = ["Camera", "Capture/Crop", "Background", "Refine", "Export"];

export const Stepper = ({ active = 1 }: { active?: number }) => (
  <div className="flex flex-wrap gap-2">
    {steps.map((step, index) => {
      const stepIndex = index + 1;
      const activeStep = stepIndex === active;
      return (
        <div
          key={step}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide",
            activeStep ? "border-white text-white" : "border-white/20 text-slate-400"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", activeStep ? "bg-ocean" : "bg-white/30")} />
          {step}
        </div>
      );
    })}
  </div>
);
