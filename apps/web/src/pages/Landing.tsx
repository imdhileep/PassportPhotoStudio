import { motion } from "framer-motion";
import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import UploadCard from "@/components/marketing/UploadCard";
import SocialProof from "@/components/marketing/SocialProof";
import HowItWorks from "@/components/marketing/HowItWorks";
import Pricing from "@/components/marketing/Pricing";
import Faq from "@/components/marketing/Faq";
import Footer from "@/components/marketing/Footer";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/ui";
import Examples from "@/components/marketing/Examples";

export default function Landing() {
  const handleGenerate = (settings: {
    country: string;
    docType: string;
    output: string;
    fileName?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("country", settings.country);
    params.set("doc", settings.docType);
    params.set("output", settings.output);
    if (settings.fileName) {
      params.set("file", settings.fileName);
    }
    window.location.href = `/app?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />

      <Section id="upload" eyebrow="Upload" title="Instant passport photo generator">
        <UploadCard onGenerate={handleGenerate} />
      </Section>

      <Section id="examples" eyebrow="Examples" title="Before / after results">
        <Examples />
      </Section>

      <Section eyebrow="Trusted" title="Loved by busy travelers">
        <SocialProof />
      </Section>

      <Section id="how" eyebrow="How it works" title="Get ready in three steps">
        <HowItWorks />
      </Section>

      <Section id="countries" eyebrow="Countries" title="Global sizing presets">
        <div className="grid gap-4 md:grid-cols-3">
          {["United States", "India", "Canada", "United Kingdom", "EU", "Australia"].map((country) => (
            <Card key={country} className="glass">
              <div className="p-5 text-sm text-slate-300">
                <p className="text-white">{country}</p>
                <p className="text-xs text-slate-400">Passport + ID sizes supported</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="Choose your plan">
        <Pricing />
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Questions answered">
        <Faq />
      </Section>

      <Section eyebrow="Integration" title="How to integrate with processing API later">
        <Card className="glass">
          <div className="space-y-2 p-5 text-sm text-slate-300">
            <p className="text-white">TODO hooks</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Swap the upload handler to POST to your processing API.</li>
              <li>Stream progress updates into the /app shell preview panel.</li>
              <li>Return processed image URLs and pipe them into downloads.</li>
            </ul>
          </div>
        </Card>
      </Section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <Footer />
      </motion.div>
    </div>
  );
}
