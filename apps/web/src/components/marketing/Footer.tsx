export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-slate-300 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-white">Passport Photo Studio</p>
          <p className="text-xs text-slate-400">Privacy-first passport photos in minutes.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          <a href="/about" className="transition hover:text-white">
            About
          </a>
          <a href="/contact" className="transition hover:text-white">
            Contact
          </a>
          <a href="/privacy-policy" className="transition hover:text-white">
            Privacy Policy
          </a>
          <a href="/terms" className="transition hover:text-white">
            Terms
          </a>
          <a href="/faq" className="transition hover:text-white">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}
