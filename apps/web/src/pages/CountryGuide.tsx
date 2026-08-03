import { useEffect } from "react";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import { countryGuides, getCountryGuide, type CountryGuide as CountryGuideData } from "@/lib/countryGuides";

type CountryGuideProps = {
  slug: string;
};

// Set the document <title> and meta description for this guide so the SEO landing pages have
// distinct, crawlable metadata (restored on unmount for SPA navigation).
function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevTitle = document.title;
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
      created = true;
    }
    const prevDescription = meta.getAttribute("content");
    meta.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (created) meta?.remove();
      else if (prevDescription !== null) meta?.setAttribute("content", prevDescription);
    };
  }, [title, description]);
}

// Inject FAQPage + HowTo structured data for Google rich results (removed on unmount for SPA nav).
function useStructuredData(guide: CountryGuideData | undefined) {
  useEffect(() => {
    if (!guide || typeof document === "undefined") return;
    const payload = [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: guide.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a }
        }))
      },
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to make a ${guide.country} passport photo online`,
        totalTime: "PT2M",
        estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
        step: [
          {
            "@type": "HowToStep",
            name: "Take or upload a photo",
            text: "Use your phone or webcam in even lighting, facing the camera, or upload an existing photo."
          },
          {
            "@type": "HowToStep",
            name: "Automatic crop and background",
            text: `The tool aligns your face to the ${guide.sizeText} proportions, straightens the head, and replaces the background (${guide.background.toLowerCase()}).`
          },
          {
            "@type": "HowToStep",
            name: "Check compliance and export",
            text: "Review the automated requirement checks, then download a digital file, a portal-ready JPG, or a print sheet."
          }
        ]
      }
    ];
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "country-guide-jsonld";
    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [guide]);
}

export default function CountryGuide({ slug }: CountryGuideProps) {
  const guide = getCountryGuide(slug);

  useDocumentMeta(
    guide?.title ?? "Passport Photo Maker | Passport Photo Studio",
    guide?.description ?? "Create compliant passport and visa photos free in your browser."
  );
  useStructuredData(guide);

  if (!guide) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto w-full max-w-4xl px-6 py-16 text-slate-800">
          <h1 className="font-display text-4xl text-slate-900">Passport photo guides</h1>
          <p className="mt-4 text-sm text-slate-600">
            We don&apos;t have a guide for that country yet. Browse the ones we do have:
          </p>
          <ul className="mt-4 grid gap-2 text-sm">
            {countryGuides.map((item) => (
              <li key={item.slug}>
                <a className="text-amber-700 hover:underline" href={`/passport-photo/${item.slug}`}>
                  {item.country} passport photo
                </a>
              </li>
            ))}
          </ul>
        </main>
        <Footer />
      </div>
    );
  }

  const ctaHref = guide.ctaHref ?? `/app?country=${encodeURIComponent(guide.standardLabel)}`;
  const specs = [
    { label: "Photo size", value: guide.sizeText },
    { label: "Background", value: guide.background },
    { label: "Head height", value: guide.headHeight },
    { label: "Resolution", value: guide.resolution }
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-6 py-12 text-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Passport photo guide</p>
        <h1 className="mt-2 font-display text-4xl text-slate-900">
          {guide.country} passport photo — size &amp; requirements
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-slate-600">{guide.intro}</p>

        <a
          href={ctaHref}
          className="mt-7 inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
        >
          Create your {guide.country} passport photo →
        </a>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">At a glance</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {specs.map((spec) => (
              <div key={spec.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{spec.label}</p>
                <p className="mt-1 text-sm text-slate-900">{spec.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Key requirements</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {guide.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Requirements can change — always confirm the latest rules with the official passport or visa authority
            before submitting.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Frequently asked questions</h2>
          <div className="mt-4 grid gap-4">
            {guide.faq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">{item.q}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Make your {guide.country} photo now</h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload or take a photo and the tool aligns your face, removes the background, and exports a compliant
            {" "}
            {guide.sizeText} image — all in your browser.
          </p>
          <a
            href={ctaHref}
            className="mt-4 inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Open the editor →
          </a>
        </section>

        <section className="mt-12 border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-900">Other countries</h2>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {countryGuides
              .filter((item) => item.slug !== guide.slug)
              .map((item) => (
                <a key={item.slug} className="text-amber-700 hover:underline" href={`/passport-photo/${item.slug}`}>
                  {item.country}
                </a>
              ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
