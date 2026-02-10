import { Card } from "@/components/ui";

const reviews = [
  {
    name: "Riya M.",
    role: "Student",
    quote: "Fast, clean, and the size was accepted on the first try."
  },
  {
    name: "Jordan P.",
    role: "Consultant",
    quote: "Better than any local studio. The 4x6 sheet saved time."
  },
  {
    name: "Lea K.",
    role: "Traveler",
    quote: "Upload, adjust, done. The guidance makes it foolproof."
  }
];

export default function SocialProof() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white">
          4.8/5 rating
        </span>
        <span>Trusted by thousands of users worldwide</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((review) => (
          <Card key={review.name} className="glass">
            <div className="space-y-3 p-5 text-sm text-slate-300">
              <p className="text-white">“{review.quote}”</p>
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-white">{review.name}</span> · {review.role}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
