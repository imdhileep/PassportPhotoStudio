const faqs = [
  {
    q: "Is it really free?",
    a: "Yes. You can generate digital passport photos for free without signing up."
  },
  {
    q: "Are my photos stored?",
    a: "Your images stay in your browser unless you explicitly share or export via the optional server."
  },
  {
    q: "Will this pass official checks?",
    a: "We follow size guidance, but always verify local requirements for your country."
  }
];

export default function Faq() {
  return (
    <div id="faq" className="space-y-3">
      {faqs.map((faq) => (
        <details
          key={faq.q}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300"
        >
          <summary className="cursor-pointer text-white">{faq.q}</summary>
          <p className="mt-2">{faq.a}</p>
        </details>
      ))}
    </div>
  );
}
