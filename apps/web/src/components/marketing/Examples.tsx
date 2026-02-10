import { Card } from "@/components/ui";

const examples = [
  {
    label: "White background",
    before: "/examples/before-1.png",
    after: "/examples/after-1.png"
  },
  {
    label: "Transparent export",
    before: "/examples/before-1.png",
    after: "/examples/after-2.png"
  }
];

export default function Examples() {
  return (
    <div id="examples" className="grid gap-4 md:grid-cols-2">
      {examples.map((example) => (
        <Card key={example.label} className="glass">
          <div className="space-y-4 p-5">
            <div className="grid gap-3 rounded-2xl bg-white/5 p-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Before</p>
                <img
                  src={example.before}
                  alt={`${example.label} before`}
                  className="mt-2 h-44 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">After</p>
                <img
                  src={example.after}
                  alt={`${example.label} after`}
                  className="mt-2 h-44 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              </div>
            </div>
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
