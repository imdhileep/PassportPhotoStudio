import { motion } from "framer-motion";
import { Badge, Button } from "@/components/ui";
import BeforeAfterSlider from "./BeforeAfterSlider";

export default function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap gap-2">
          {["AI Background", "Country Sizes", "4x6 Print Sheet", "No Signup"].map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
        <div>
          <h1 className="font-display text-4xl text-white md:text-5xl">
            Perfect Passport Photos in 60 Seconds.
          </h1>
          <p className="mt-4 text-base text-slate-300">
            AI background removal, correct sizing, print-ready sheets — privacy-first.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="accent"
            onClick={() => document.getElementById("upload")?.scrollIntoView({ behavior: "smooth" })}
          >
            Upload or Capture
          </Button>
          <Button
            variant="ghost"
            onClick={() => document.getElementById("examples")?.scrollIntoView({ behavior: "smooth" })}
          >
            See Examples
          </Button>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <BeforeAfterSlider />
      </motion.div>
    </section>
  );
}
