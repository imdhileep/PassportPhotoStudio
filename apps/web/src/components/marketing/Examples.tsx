import { Card } from "@/components/ui";

const examples = [
  { label: "Studio white", tone: "from-slate-800 via-slate-700 to-slate-600" },
  { label: "Soft ivory", tone: "from-amber-100 via-amber-50 to-white" },
  { label: "Light blue", tone: "from-sky-200 via-sky-100 to-white" },
  { label: "Print-ready crop", tone: "from-emerald-100 via-emerald-50 to-white" }
];

const ExampleSvg = ({ tone, label }: { tone: string; label: string }) => (
  <svg viewBox="0 0 480 280" role="img" aria-label={`${label} preview`} className="h-full w-full">
    <defs>
      <linearGradient id={`bg-${label}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="50%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <linearGradient id={`card-${label}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#ffffff" />
      </linearGradient>
    </defs>
    <rect width="480" height="280" rx="24" fill="url(#bg-${label})" />
    <rect x="36" y="32" width="170" height="216" rx="18" fill="url(#card-${label})" opacity="0.6" />
    <rect x="230" y="32" width="214" height="216" rx="18" fill="url(#card-${label})" />
    <rect x="260" y="58" width="154" height="130" rx="18" fill="#dbeafe" />
    <circle cx="337" cy="114" r="44" fill="#94a3b8" />
    <rect x="292" y="170" width="90" height="48" rx="18" fill="#94a3b8" />
    <rect x="56" y="64" width="120" height="150" rx="18" fill="#334155" opacity="0.6" />
    <text x="60" y="254" fill="#f8fafc" fontSize="14" fontFamily="Space Grotesk">
      Before
    </text>
    <text x="230" y="254" fill="#f8fafc" fontSize="14" fontFamily="Space Grotesk">
      After
    </text>
  </svg>
);

export default function Examples() {
  return (
    <div id="examples" className="grid gap-4 md:grid-cols-2">
      {examples.map((example) => (
        <Card key={example.label} className="glass">
          <div className="space-y-4 p-5">
            <div className={`h-44 w-full rounded-2xl bg-gradient-to-br ${example.tone} p-3`}>
              <ExampleSvg tone={example.tone} label={example.label} />
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
