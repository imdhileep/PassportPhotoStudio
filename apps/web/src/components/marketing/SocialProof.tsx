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
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-900">
          4.8/5 rating
        </span>
        <span>Trusted by thousands of users worldwide</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((review) => (
          <Card key={review.name} className="glass">
            <div className="space-y-3 p-5 text-sm text-slate-600">
              <p className="text-slate-900">“{review.quote}”</p>
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-900">{review.name}</span> · {review.role}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
