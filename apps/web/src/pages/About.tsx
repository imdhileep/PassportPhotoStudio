import PageLayout from "@/components/marketing/PageLayout";

export default function About() {
  return (
    <PageLayout title="About Passport Photo Studio">
      <p>
        Passport Photo Studio was built to make official photo preparation simple, fast, and privacy-first. Many people
        still rely on photo studios or confusing apps that require account creation, subscriptions, or multiple uploads
        just to get a compliant image. We designed a cleaner alternative: a focused, browser-based tool that guides you
        through capturing, cropping, and exporting passport photos that follow common country requirements.
      </p>
      <p>
        Our product combines face landmarking, background segmentation, and smart cropping rules to help you align eyes,
        keep the head fully visible, and generate the correct aspect ratio. You can switch between size standards, tune
        background colors, and export both digital files and print-ready 4x6 sheets. We emphasize clarity and transparency
        so you always understand what the tool is doing and why a warning appears.
      </p>
      <p>
        We built this platform for travelers, students, and professionals who need fast results without compromising
        accuracy. The interface highlights essential steps so you do not miss common rejection causes like head size,
        tilt, or uneven lighting. Every control has a clear purpose, and the workflow is structured to help you move from
        capture to export with minimal confusion.
      </p>
      <p>
        Quality is a priority. The app includes real-time guidance that checks sharpness, lighting balance, and framing.
        We also provide edge refinement and background adjustments so hair and shoulder edges remain clean. These details
        save you time and reduce the need for reshoots, especially when you are submitting for strict official standards.
      </p>
      <p>
        Privacy is a core promise. Your images are processed in the browser whenever possible, which means your photo does
        not leave your device during the core workflow. If you opt into optional sharing or server-side exports, you’ll see
        clear prompts and can decide whether to proceed. The goal is to give you studio-quality results without invasive
        data collection or unnecessary storage.
      </p>
      <p>
        Passport Photo Studio is continually refined based on user feedback and the latest guidance from passport
        authorities. We prioritize a fast user experience, accessible design, and reliable output so you can focus on your
        application rather than troubleshooting technical steps. If you have suggestions or need help, reach out anytime.
      </p>
    </PageLayout>
  );
}
