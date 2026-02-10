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

      <Section
        eyebrow="What this tool does"
        title="Passport photos without the studio hassle"
        description="Passport Photo Studio helps you create compliant ID and passport images at home. The workflow is built for clarity: you upload or capture a photo, the AI aligns your face to official proportions, removes the background, and prepares exports for digital submissions or print-ready sheets."
      >
        <div className="grid gap-4 text-sm text-slate-300">
          <p>
            Instead of guessing photo size or paying for reprints, you can follow a guided process that checks the most
            common rejection reasons. The tool highlights head size, tilt, framing, and lighting issues so you can fix
            them before submission. This is especially useful for visa applications, student IDs, and travel documents
            that require exact dimensions.
          </p>
          <p>
            The app runs in your browser to keep photos private. You can export PNG or JPG files, generate a 4x6 print
            sheet, and save custom size profiles for future use. Each step is designed to reduce friction and keep the
            experience fast on mobile and desktop.
          </p>
        </div>
      </Section>

      <Section eyebrow="Trusted" title="Loved by busy travelers">
        <SocialProof />
      </Section>

      <Section id="how" eyebrow="How it works" title="Get ready in three steps">
        <HowItWorks />
      </Section>

      <Section
        eyebrow="Supported countries"
        title="US, India, and more presets"
        description="We include popular passport sizes plus custom profiles. For any country not listed, you can enter the exact dimensions."
      >
        <div className="grid gap-4 text-sm text-slate-300">
          <p>
            Current presets include United States (2x2 in), India (35x45 mm), Canada (50x70 mm), UK (35x45 mm), EU
            standards, and Australia (35x45 mm). If your authority requests a unique size, switch to Custom and save the
            profile for repeat use.
          </p>
          <p>
            Review the FAQ for common size questions and printing tips. If you are unsure, compare the requirements on
            your government’s official site and select the closest match in the tool.
          </p>
        </div>
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

      <Section
        eyebrow="Common rejection reasons"
        title="Avoid the most frequent issues"
        description="Most rejections happen because of framing, lighting, or background errors. Our warning system makes those problems easy to spot."
      >
        <div className="grid gap-4 text-sm text-slate-300">
          <ul className="list-disc space-y-2 pl-5">
            <li>Head size too small or too large relative to the frame.</li>
            <li>Uneven lighting or strong shadows on the face.</li>
            <li>Background color not compliant or too textured.</li>
            <li>Head tilt or off-center alignment.</li>
            <li>Low contrast or blurry focus from camera shake.</li>
          </ul>
          <p>
            Use the quality meter in the app to see a score and step-by-step guidance. For best results, stand facing a
            window, remove harsh backlight, and keep your shoulders square to the camera.
          </p>
        </div>
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="Choose your plan">
        <Pricing />
      </Section>

      <Section
        id="faq"
        eyebrow="FAQ"
        title="Questions answered"
        description="Here are the most common questions about passport photo compliance, printing, and acceptance."
      >
        <Faq />
        <div className="mt-6 grid gap-3 text-sm text-slate-300">
          <p>
            <strong>Can I submit a digital photo?</strong> Most online applications accept a digital file as long as the
            size and background match their rules.
          </p>
          <p>
            <strong>How do I print?</strong> Use the 4x6 print sheet and print at 100% scale with no resizing enabled.
          </p>
          <p>
            <strong>Does the tool work on mobile?</strong> Yes, the layout and camera flow are optimized for phones and
            tablets.
          </p>
        </div>
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
