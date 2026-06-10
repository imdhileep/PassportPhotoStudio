import { Button } from "@/components/ui";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-night/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <a href="/" className="flex items-center gap-2.5" aria-label="Passport Photo Studio home">
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_16px_rgba(245,158,11,0.35)]" />
          <span className="font-display text-lg font-bold tracking-tight">
            <span className="text-white">Passport</span>
            <span className="text-amber-400">Photo</span>
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="/#how" className="transition hover:text-white">
            How it Works
          </a>
          <a href="/about" className="transition hover:text-white">
            About
          </a>
          <a href="/#pricing" className="transition hover:text-white">
            Pricing
          </a>
          <a href="/#countries" className="transition hover:text-white">
            Countries
          </a>
          <a href="/faq" className="transition hover:text-white">
            FAQ
          </a>
          <a href="/contact" className="transition hover:text-white">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="accent"
            onClick={() => {
              if (window.location.pathname !== "/") {
                window.location.href = "/#upload";
                return;
              }
              document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Try Free
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/login")}>
            Login
          </Button>
        </div>
      </div>
    </header>
  );
}
