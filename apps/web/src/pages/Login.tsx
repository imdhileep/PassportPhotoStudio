import PageLayout from "@/components/marketing/PageLayout";
import { Button, Card } from "@/components/ui";

export default function Login() {
  return (
    <PageLayout title="Login">
      <Card className="glass">
        <div className="space-y-4 p-6 text-sm text-slate-300">
          <p>
            Login is optional. This placeholder will connect to authentication later if you decide to add accounts.
          </p>
          <div className="grid gap-3">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white"
            />
          </div>
          <div className="grid gap-3">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent">Continue</Button>
            <Button variant="ghost">Forgot password</Button>
          </div>
          <p className="text-xs text-slate-400">
            TODO: Integrate with your auth provider and replace this placeholder form.
          </p>
        </div>
      </Card>
    </PageLayout>
  );
}
