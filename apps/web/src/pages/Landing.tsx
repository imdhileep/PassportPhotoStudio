import { motion } from "framer-motion";
import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import UploadCard from "@/components/marketing/UploadCard";
import HowItWorks from "@/components/marketing/HowItWorks";
import Faq from "@/components/marketing/Faq";
import Footer from "@/components/marketing/Footer";
import { Section } from "@/components/marketing/Section";
import { Card } from "@/components/ui";
import Examples from "@/components/marketing/Examples";
import { appConfig } from "@/config";
import { savePendingUpload } from "@/lib/pendingUpload";

export default function Landing() {
  const handleGenerate = async (settings: {
    country: string;
    docType: string;
    output: string;
    templateId?: string;
    prioritySkipQueue?: boolean;
    humanVerificationAddon?: boolean;
    clothingAdjustmentAddon?: boolean;
    fileDataUrl?: string;
    fileName?: string;
  }) => {
    const params = new URLSearchParams();
    params.set("country", settings.country);
    params.set("doc", settings.docType);
    params.set("output", settings.output);
    if (settings.fileDataUrl) {
      try {
        const pending = await savePendingUpload(settings.fileDataUrl, settings.fileName);
        localStorage.setItem(
          "pps_pending_upload",
          JSON.stringify({
            id: pending.id,
            name: pending.name
          })
        );
      } catch (error) {
        console.warn("IndexedDB pending upload unavailable, falling back to data URL", error);
        localStorage.setItem(
          "pps_pending_upload",
          JSON.stringify({
            dataUrl: settings.fileDataUrl,
            name: settings.fileName ?? "upload-image"
          })
        );
      }
    }
    if (settings.templateId) {
      params.set("templateId", settings.templateId);
    }
    if (appConfig.serverEnabled && settings.fileDataUrl && settings.templateId) {
      try {
        const blob = await fetch(settings.fileDataUrl).then((response) => response.blob());
        const form = new FormData();
        form.append("templateId", settings.templateId);
        form.append("prioritySkipQueue", String(!!settings.prioritySkipQueue));
        form.append("humanVerificationAddon", String(!!settings.humanVerificationAddon));
        form.append("clothingAdjustmentAddon", String(!!settings.clothingAdjustmentAddon));
        form.append("file", blob, settings.fileName ?? "upload-image.png");
        const response = await fetch(`${appConfig.serverUrl}/api/orders`, {
          method: "POST",
          body: form
        });
        if (response.ok) {
          const payload = await response.json();
          params.set("orderId", payload.order.id);
          localStorage.setItem("pps_pending_order", JSON.stringify(payload.order));
        }
      } catch (error) {
        console.error("Order creation failed from landing", error);
      }
    }
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
        <div className="grid gap-4 text-sm text-slate-600">
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

      <Section id="how" eyebrow="How it works" title="Get ready in three steps">
        <HowItWorks />
      </Section>

      <Section id="countries" eyebrow="Countries" title="Global sizing presets">
        <div className="grid gap-4 md:grid-cols-3">
          {["United States", "India", "Canada", "United Kingdom", "EU", "Australia"].map((country) => (
            <Card key={country} className="glass">
              <div className="p-5 text-sm text-slate-600">
                <p className="text-slate-900">{country}</p>
                <p className="text-xs text-slate-500">Passport + ID sizes supported</p>
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
        <div className="grid gap-4 text-sm text-slate-600">
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

      <Section
        id="faq"
        eyebrow="FAQ"
        title="Questions answered"
        description="Here are the most common questions about passport photo compliance, printing, and acceptance."
      >
        <Faq />
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
