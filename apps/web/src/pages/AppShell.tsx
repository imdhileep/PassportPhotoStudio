import { Button } from "@/components/ui";
import ToolApp from "../ToolApp";

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Passport Photo Studio</p>
            <p className="text-sm text-white">Passport Photo Maker</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => (window.location.href = "/")}>
              Back to Home
            </Button>
            <Button variant="accent" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              New Upload
            </Button>
          </div>
        </div>
      </div>
      <ToolApp />
    </div>
  );
}
