export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-slate-900">Passport Photo Studio</p>
          <p className="text-xs text-slate-500">Privacy-first passport photos in minutes.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <a href="/about" className="transition hover:text-slate-900">
            About
          </a>
          <a href="/contact" className="transition hover:text-slate-900">
            Contact
          </a>
          <a href="/privacy-policy" className="transition hover:text-slate-900">
            Privacy Policy
          </a>
          <a href="/terms" className="transition hover:text-slate-900">
            Terms
          </a>
          <a href="/faq" className="transition hover:text-slate-900">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}
