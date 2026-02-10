import { Card } from "@/components/ui";

const examples = [
  { label: "Studio white", tone: "from-slate-900 via-slate-800 to-slate-700" },
  { label: "Soft ivory", tone: "from-amber-100 via-amber-50 to-white" },
  { label: "Light blue", tone: "from-sky-200 via-sky-100 to-white" },
  { label: "Print-ready crop", tone: "from-emerald-100 via-emerald-50 to-white" }
];

export default function Examples() {
  return (
    <div id="examples" className="grid gap-4 md:grid-cols-2">
      {examples.map((example) => (
        <Card key={example.label} className="glass">
          <div className="space-y-4 p-5">
            <div className={`h-40 w-full rounded-2xl bg-gradient-to-br ${example.tone}`} />
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span className="text-white">{example.label}</span>
              <span className="text-xs text-slate-400">Before → After</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
