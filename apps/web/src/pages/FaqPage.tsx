import PageLayout from "@/components/marketing/PageLayout";

export default function FaqPage() {
  return (
    <PageLayout title="Frequently Asked Questions">
      <p>
        <strong>What are the most common passport photo requirements?</strong> Most countries require a neutral facial
        expression, even lighting, a plain background, and a centered head with eyes at a specific height. The exact size
        and proportions vary by country, so choose the correct preset in the app.
      </p>
      <p>
        <strong>How does the tool work?</strong> The app uses AI background segmentation and face landmarks to align and
        crop your image. You can also manually adjust the crop box and fine-tune edge cleanup before exporting.
      </p>
      <p>
        <strong>Why was my photo rejected?</strong> Common reasons include the head being too small or too large, shadows,
        glare on glasses, or a non-compliant background color. Use the warnings and quality meter to correct these issues.
      </p>
      <p>
        <strong>Can I use a selfie?</strong> Yes, as long as the image is sharp, well-lit, and meets the size and framing
        rules. We recommend a neutral background and a steady camera to avoid blur.
      </p>
      <p>
        <strong>Do you store my images?</strong> By default, no. Photos are processed locally in your browser. If you use
        optional sharing, an export may be stored briefly for delivery.
      </p>
      <p>
        <strong>What background color should I choose?</strong> Most authorities accept pure white, off-white, or light
        blue backgrounds. Choose the color recommended for your country and avoid patterns or strong gradients.
      </p>
      <p>
        <strong>Is retouching allowed?</strong> Light adjustments for brightness and contrast are typically acceptable, but
        do not alter facial features. The auto-retouch tool only balances lighting and does not change your appearance.
      </p>
      <p>
        <strong>How do I print correctly?</strong> Use the 4x6 print sheet option and print at 100% scale without resizing.
        The print pack panel displays the target pixel dimensions for your selected DPI.
      </p>
      <p>
        <strong>What if my country is not listed?</strong> Choose the Custom preset and enter the required dimensions. You
        can save custom profiles for quick reuse later.
      </p>
      <p>
        <strong>Why does the quality meter show a low score?</strong> The score drops if lighting is uneven, if the face is
        tilted, or if the image is blurry. Adjust your position, improve lighting, and keep the camera steady.
      </p>
      <p>
        <strong>Does the tool work offline?</strong> After the models are downloaded once, the app can operate offline for
        most editing tasks. Keep the page open so the assets remain available.
      </p>
      <p>
        <strong>Can I use glasses in my photo?</strong> Some authorities allow glasses if there is no glare and the eyes
        remain fully visible. If you see reflections or dark lenses, remove glasses and retake the photo.
      </p>
      <p>
        <strong>What resolution should I aim for?</strong> Higher resolution images produce better results. A 1 to 2
        megapixel image is usually sufficient, but a modern phone camera will offer the best sharpness and detail.
      </p>
      <p>
        <strong>Is background transparency acceptable?</strong> Transparency is useful for design workflows, but most
        passport submissions require a solid color. Choose the recommended background color before export.
      </p>
    </PageLayout>
  );
}
