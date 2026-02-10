import PageLayout from "@/components/marketing/PageLayout";

export default function Contact() {
  return (
    <PageLayout title="Contact">
      <p>
        We’re happy to help with any questions about photo requirements, exports, or troubleshooting. For the fastest
        response, email us directly and include your browser version, device model, and the step where you ran into an
        issue.
      </p>
      <p>
        Email:{" "}
        <a className="text-sky-300" href="mailto:dhileep.dk@gmail.com">
          dhileep.dk@gmail.com
        </a>
      </p>
      <p>
        If you’re reporting a bug, please share a screenshot and the exact warning text you see in the app. We typically
        respond within one business day.
      </p>
      <p>
        For photo compliance questions, include the country or agency you are submitting to and any published size
        requirements. If you need a custom size or have trouble matching official guidance, we can recommend a preset or
        a safe custom profile. We also welcome suggestions for additional countries or document types.
      </p>
      <p>
        Partnership inquiries are welcome. If you represent a travel agency, university, or visa support company, let us
        know how many photos you process per month and the type of integrations you need. We can discuss bulk workflows,
        white-label options, and API-based processing.
      </p>
      <p>
        For partnerships or enterprise licensing, include your organization name and the volume of photos you process per
        month. We’ll follow up with details about custom workflows or integrations.
      </p>
      <p>
        We value transparency and strive to keep communication direct. Please do not send sensitive personal identifiers
        like passport numbers in email. If you need help with a specific photo, describe the issue and we will advise on
        how to adjust the image safely within the app.
      </p>
      <p>
        Our support hours are typically Monday through Friday, and we reply as quickly as possible. If you are on a tight
        deadline, include the date you need to submit your application so we can prioritize urgent requests. For general
        questions, you may receive a knowledge base response with step-by-step guidance.
      </p>
      <p>
        If you have accessibility needs or require alternate instructions, let us know. We can provide simplified steps,
        keyboard-only navigation tips, and recommendations for camera positioning to help you achieve a compliant photo.
      </p>
    </PageLayout>
  );
}
