import { Button, Card } from "@/components/ui";

export default function Pricing() {
  return (
    <div id="pricing" className="grid gap-4 md:grid-cols-2">
      <Card className="glass">
        <div className="space-y-4 p-6 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Free</p>
          <p className="text-3xl font-semibold text-slate-900">$0</p>
          <ul className="space-y-2">
            <li>Single photo export</li>
            <li>Background removal</li>
            <li>US + India sizes</li>
          </ul>
          <Button variant="ghost" className="w-full">
            Start Free
          </Button>
        </div>
      </Card>
      <Card className="glass border border-slate-200">
        <div className="space-y-4 p-6 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pro</p>
          <p className="text-3xl font-semibold text-slate-900">$4.99</p>
          <ul className="space-y-2">
            <li>Batch exports</li>
            <li>Premium retouching</li>
            <li>All country sizes</li>
            <li>Print-ready sheets</li>
          </ul>
          <Button variant="accent" className="w-full">
            Go Pro
          </Button>
        </div>
      </Card>
    </div>
  );
}
