import PageLayout from "@/components/marketing/PageLayout";

export default function PrivacyPolicy() {
  return (
    <PageLayout title="Privacy Policy">
      <p>
        Passport Photo Studio is designed to minimize data collection. By default, your photo is processed locally in your
        browser and is not uploaded to our servers. This allows you to generate a compliant photo without creating an
        account or sharing personal information.
      </p>
      <p>
        If you choose optional features such as sharing or server-assisted export, we may temporarily process your image
        to fulfill that request. Uploaded files are stored only as long as needed to deliver the export or share link and
        are deleted according to our retention settings. We do not sell or rent your images, and we never use them for
        advertising or training models without explicit consent.
      </p>
      <p>
        We may collect basic diagnostic logs to keep the service reliable. These logs can include performance timings,
        error messages, and browser metadata, but they do not include the image itself or sensitive personal data. We use
        this information to improve the product, fix bugs, and maintain security.
      </p>
      <p>
        We apply reasonable administrative and technical safeguards to protect any optional exports stored on our servers.
        Access is limited to authorized personnel and automated systems needed to deliver the service. While no system is
        completely secure, we aim to minimize exposure and promptly address any issues.
      </p>
      <p>
        We may use standard analytics to understand usage trends and improve performance. These analytics collect
        aggregated, non-identifying information such as pages visited, device type, and feature usage. We do not collect
        sensitive biometric data or government identifiers in analytics logs.
      </p>
      <p>
        Cookies may be used to remember your preferences, such as chosen photo size, background color, and UI settings. If
        third-party advertising is enabled in the future, those partners may use cookies or similar technologies to serve
        relevant ads. You can control cookie behavior through your browser settings.
      </p>
      <p>
        If third-party ads are enabled, those services may place cookies or similar identifiers to measure ad performance
        or limit repetitive ads. You can opt out of personalized advertising through industry tools or your browser’s
        privacy settings. We do not control third-party cookie policies, but we aim to choose partners that comply with
        published privacy and security standards.
      </p>
      <p>
        You have the right to request deletion of any server-stored exports. Contact us with the share link or export ID,
        and we will remove the file. This policy may be updated periodically; the most recent version will always be
        published on this page.
      </p>
      <p>
        If you are located in a region with privacy rights such as the EU or California, you can request access, deletion,
        or correction of any personal data we may hold. Because the default workflow is local, most requests are resolved
        by clearing your browser data or deleting any optional exports.
      </p>
    </PageLayout>
  );
}
