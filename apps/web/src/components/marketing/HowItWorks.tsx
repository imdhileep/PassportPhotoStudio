import { Card } from "@/components/ui";
import { Camera, Crop, Download } from "lucide-react";

const steps = [
  {
    title: "Upload or capture",
    detail: "Use your camera or upload a photo in seconds.",
    icon: Camera
  },
  {
    title: "Auto-crop + refine",
    detail: "AI aligns your face and removes the background.",
    icon: Crop
  },
  {
    title: "Download files",
    detail: "Export digital photos or a 4x6 print sheet.",
    icon: Download
  }
];

export default function HowItWorks() {
  return (
    <div id="how" className="grid gap-4 md:grid-cols-3">
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <Card key={step.title} className="glass">
            <div className="space-y-3 p-5 text-sm text-slate-300">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-base font-semibold text-white">{step.title}</p>
              <p>{step.detail}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
