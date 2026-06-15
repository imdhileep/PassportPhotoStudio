// Per-country passport-photo guides. These power the /passport-photo/{slug} SEO landing pages.
// `standardLabel` must match a passportStandards label exactly so the CTA can deep-link the editor
// via /app?country={standardLabel} (ToolApp matches the ?country= param against standard.label).
// Specs are summarized for guidance — each page reminds users to confirm with the official authority.

export type CountryGuide = {
  slug: string;
  country: string;
  standardLabel: string;
  sizeText: string;
  background: string;
  headHeight: string;
  resolution: string;
  intro: string;
  rules: string[];
  title: string;
  description: string;
};

export const countryGuides: CountryGuide[] = [
  {
    slug: "united-states",
    country: "United States",
    standardLabel: "US 2x2 in",
    sizeText: "2 x 2 inches (51 x 51 mm)",
    background: "Plain white or off-white",
    headHeight: "1 to 1⅜ inches (25–35 mm), about 50–69% of the photo height",
    resolution: "300 DPI or higher, color",
    intro:
      "A U.S. passport photo must be 2x2 inches with a plain white or off-white background, a neutral expression, and your full head visible. This tool aligns your face to the official proportions, removes the background, and exports a print-ready 2x2 photo or a digital file under the State Department size limits.",
    rules: [
      "Taken within the last 6 months to reflect your current appearance.",
      "Neutral expression with both eyes open and mouth closed.",
      "No glasses (removed since 2016 except for documented medical reasons).",
      "No hats or head coverings unless worn daily for religious reasons.",
      "Plain white or off-white background with even lighting and no shadows."
    ],
    title: "US Passport Photo Maker — 2x2 in, Free Online | Passport Photo Studio",
    description:
      "Create a compliant US passport photo (2x2 in, white background) free in your browser. Auto-crop to 50–69% head height, remove the background, and export print or digital."
  },
  {
    slug: "united-kingdom",
    country: "United Kingdom",
    standardLabel: "UK 35x45 mm",
    sizeText: "35 x 45 mm",
    background: "Plain light grey or cream",
    headHeight: "29–34 mm from chin to crown",
    resolution: "600 dpi recommended for digital uploads",
    intro:
      "A UK passport photo is 35x45 mm on a plain light grey or cream background, with a neutral expression and no smiling. This tool frames your head to the UK proportions, sets a compliant light-grey background, and exports a digital photo for the online HM Passport Office service or a printable copy.",
    rules: [
      "Plain light-coloured background (light grey or cream) — not pure white.",
      "Neutral expression with your mouth closed, looking straight at the camera.",
      "Eyes open and clearly visible, with no hair across them.",
      "No head coverings unless worn for religious or medical reasons.",
      "No glasses if possible; avoid glare and frames covering the eyes."
    ],
    title: "UK Passport Photo Maker — 35x45 mm, Free Online | Passport Photo Studio",
    description:
      "Make a compliant UK passport photo (35x45 mm, light grey background) free online. Correct head size, neutral expression checks, and export for the online passport service."
  },
  {
    slug: "india",
    country: "India",
    standardLabel: "India 35x45 mm",
    sizeText: "35 x 45 mm (2 x 2 in also accepted for some services)",
    background: "Plain white",
    headHeight: "Head centered and fully visible, about 70–80% of the photo",
    resolution: "300 DPI or higher, color",
    intro:
      "An Indian passport photo is typically 35x45 mm (or 2x2 in for some consular services) on a plain white background, with the face centered and a neutral expression. This tool crops to the correct proportions, removes the background to white, and exports a print or digital file.",
    rules: [
      "Plain white background with the face centered and clearly visible.",
      "Neutral expression, mouth closed, looking straight at the camera.",
      "Both eyes open; no hair or glare covering the eyes.",
      "No caps or hats; head coverings only for religious reasons.",
      "Even lighting with no harsh shadows on the face or background."
    ],
    title: "India Passport Photo Maker — 35x45 mm / 2x2 in, Free | Passport Photo Studio",
    description:
      "Create a compliant Indian passport photo (35x45 mm or 2x2 in, white background) free online. Auto-crop, background removal, and print or digital export."
  },
  {
    slug: "canada",
    country: "Canada",
    standardLabel: "Canada 50x70 mm",
    sizeText: "50 x 70 mm",
    background: "Plain white",
    headHeight: "31–36 mm from chin to crown",
    resolution: "High resolution, color, sharp focus",
    intro:
      "A Canadian passport photo is 50x70 mm on a plain white background with a neutral expression. This tool frames your head to the 31–36 mm chin-to-crown range, sets a white background, and exports a print-ready photo (remember the photographer's date stamp requirement for printed photos).",
    rules: [
      "Size 50x70 mm with the face measuring 31–36 mm from chin to crown.",
      "Plain white background, even lighting, no shadows.",
      "Neutral expression, mouth closed, eyes open and clearly visible.",
      "Taken within the last 6 months.",
      "Printed photos must include the photographer or studio name and date on the back."
    ],
    title: "Canada Passport Photo Maker — 50x70 mm, Free Online | Passport Photo Studio",
    description:
      "Make a compliant Canadian passport photo (50x70 mm, white background, 31–36 mm head) free online. Auto-crop, background removal, and print-ready export."
  },
  {
    slug: "australia",
    country: "Australia",
    standardLabel: "Australia 35x45 mm",
    sizeText: "35 x 45 mm",
    background: "Plain light grey or white",
    headHeight: "32–36 mm from chin to crown",
    resolution: "High resolution, color, sharp focus",
    intro:
      "An Australian passport photo is 35x45 mm on a plain light-coloured background with a neutral expression. This tool crops your head to the 32–36 mm chin-to-crown range, sets a compliant background, and exports a print or digital file.",
    rules: [
      "Size 35x45 mm with the face measuring 32–36 mm from chin to crown.",
      "Plain light grey or white background with even lighting.",
      "Neutral expression, mouth closed, eyes open looking at the camera.",
      "No glasses; no head coverings unless for religious or medical reasons.",
      "Taken within the last 6 months."
    ],
    title: "Australia Passport Photo Maker — 35x45 mm, Free | Passport Photo Studio",
    description:
      "Create a compliant Australian passport photo (35x45 mm, light background, 32–36 mm head) free online. Auto-crop, background removal, and export."
  },
  {
    slug: "schengen-visa",
    country: "Schengen / EU",
    standardLabel: "EU 35x45 mm",
    sizeText: "35 x 45 mm",
    background: "Plain light grey or off-white",
    headHeight: "Face about 70–80% of the photo (ICAO standard)",
    resolution: "High resolution, color, sharp focus",
    intro:
      "Schengen visa and EU passport photos are 35x45 mm on a plain light grey background, following the ICAO standard where the face fills about 70–80% of the frame. This tool crops to the EU proportions, sets a compliant light background, and exports a print or digital file.",
    rules: [
      "Size 35x45 mm with the face filling about 70–80% of the photo.",
      "Plain light grey or off-white background, evenly lit.",
      "Neutral expression, mouth closed, looking straight ahead.",
      "Both eyes open and clearly visible; no glare on glasses.",
      "No head coverings unless worn for religious reasons."
    ],
    title: "Schengen & EU Visa Photo Maker — 35x45 mm, Free | Passport Photo Studio",
    description:
      "Make a compliant Schengen visa / EU passport photo (35x45 mm, light grey background, ICAO 70–80% face) free online. Auto-crop, background removal, and export."
  }
];

export const getCountryGuide = (slug: string): CountryGuide | undefined =>
  countryGuides.find((guide) => guide.slug === slug);
