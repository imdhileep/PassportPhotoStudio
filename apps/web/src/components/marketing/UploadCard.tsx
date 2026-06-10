import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardDescription, CardHeader, CardTitle, Switch } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { passportStandards } from "@passport/ai";
import { appConfig } from "@/config";

type UploadSettings = {
  country: string;
  docType: string;
  output: string;
  templateId?: string;
  prioritySkipQueue?: boolean;
  humanVerificationAddon?: boolean;
  clothingAdjustmentAddon?: boolean;
  fileDataUrl?: string;
  fileName?: string;
};

type UploadCardProps = {
  onGenerate: (settings: UploadSettings) => void;
};

export default function UploadCard({ onGenerate }: UploadCardProps) {
  const fallbackCountries = useMemo(() => passportStandards.map((standard) => standard.label), []);
  const fallbackDocTypes = useMemo(() => ["Passport", "Visa", "ID Card", "OPT EAD"], []);
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      country: string;
      documentType: string;
      name: string;
      rules: {
        allowCrop: boolean;
        allowResize: boolean;
        allowBackgroundReplace: boolean;
        allowFaceRetouch: boolean;
        notes: string;
      };
    }>
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const countryOptions = useMemo(() => {
    if (templates.length === 0) return fallbackCountries;
    return Array.from(new Set(templates.map((template) => template.country)));
  }, [fallbackCountries, templates]);

  const [country, setCountry] = useState(countryOptions[0] ?? "United States");
  const [docType, setDocType] = useState(fallbackDocTypes[0]);
  const [output, setOutput] = useState("Digital");
  const [prioritySkipQueue, setPrioritySkipQueue] = useState(false);
  const [humanVerificationAddon, setHumanVerificationAddon] = useState(false);
  const [clothingAdjustmentAddon, setClothingAdjustmentAddon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | undefined>();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const docTypeOptions = useMemo(() => {
    if (templates.length === 0) return fallbackDocTypes;
    const filtered = templates.filter((template) => template.country === country);
    if (filtered.length === 0) return fallbackDocTypes;
    return Array.from(new Set(filtered.map((template) => template.documentType)));
  }, [country, fallbackDocTypes, templates]);

  const selectedTemplate = useMemo(() => {
    if (templates.length === 0) return null;
    return (
      templates.find((template) => template.country === country && template.documentType === docType) ?? null
    );
  }, [country, docType, templates]);

  useEffect(() => {
    if (!appConfig.serverEnabled) return;
    let cancelled = false;
    const run = async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const response = await fetch(`${appConfig.serverUrl}/api/templates`);
        if (!response.ok) throw new Error("Template API unavailable");
        const data = await response.json();
        if (cancelled) return;
        setTemplates(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Template fetch failed", error);
        if (!cancelled) setTemplatesError("Template catalog unavailable. Using local presets.");
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (countryOptions.length === 0) return;
    if (!countryOptions.includes(country)) {
      setCountry(countryOptions[0]);
    }
  }, [country, countryOptions]);

  useEffect(() => {
    if (docTypeOptions.length === 0) return;
    if (!docTypeOptions.includes(docType)) {
      setDocType(docTypeOptions[0]);
    }
  }, [docType, docTypeOptions]);

  const handleFileSelected = (nextFile?: File) => {
    setUploadError(null);
    setFile(nextFile ?? null);
    setFileName(nextFile?.name);
  };

  const readFileAsDataUrl = (source: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read selected file."));
      reader.readAsDataURL(source);
    });

  const handleGenerateClick = async () => {
    try {
      let fileDataUrl: string | undefined;
      if (file) {
        fileDataUrl = await readFileAsDataUrl(file);
      }
      onGenerate({
        country,
        docType,
        output,
        templateId: selectedTemplate?.id,
        prioritySkipQueue,
        humanVerificationAddon,
        clothingAdjustmentAddon,
        fileName,
        fileDataUrl
      });
    } catch (error) {
      console.error("Could not prepare upload", error);
      setUploadError("Could not read the selected image. Please try another file.");
    }
  };

  return (
    <Card id="upload" className="glass mx-auto w-full max-w-4xl">
      <CardHeader>
        <div>
          <CardTitle>Start with capture or upload</CardTitle>
          <CardDescription>Take a photo or upload once, then fine-tune the rest of the flow.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-6 px-6 pb-6">
        <label
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-sm text-slate-600 transition ${
            isDragging
              ? "border-ocean bg-ocean/10"
              : "border-slate-200 bg-white hover:border-slate-200"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFileSelected(event.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(event) => {
              handleFileSelected(event.target.files?.[0]);
            }}
          />
          <span className="text-slate-900">{fileName ?? "Drag & drop your photo here"}</span>
          <span className="text-xs text-slate-500">Or capture inside the app after you start.</span>
          <button
            type="button"
            className="text-xs text-ocean hover:underline"
            onClick={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
          >
            Choose from device
          </button>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Country</p>
            <input
              list="country-options"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900"
              aria-label="Country"
            />
            <datalist id="country-options">
              {countryOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Document Type</p>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose document" />
              </SelectTrigger>
              <SelectContent>
                {docTypeOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Output</p>
            <Select value={output} onValueChange={setOutput}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose output" />
              </SelectTrigger>
              <SelectContent>
                {["Digital", "4x6 Print Sheet"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="accent"
              className="w-full"
              onClick={handleGenerateClick}
            >
              Generate Photo
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Skip queue</p>
                <p className="text-xs text-slate-500">Paid priority processing.</p>
              </div>
              <Switch checked={prioritySkipQueue} onCheckedChange={setPrioritySkipQueue} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Human verification</p>
                <p className="text-xs text-slate-500">Manual review add-on.</p>
              </div>
              <Switch checked={humanVerificationAddon} onCheckedChange={setHumanVerificationAddon} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Clothing adjustment</p>
                <p className="text-xs text-slate-500">Premium manual service.</p>
              </div>
              <Switch checked={clothingAdjustmentAddon} onCheckedChange={setClothingAdjustmentAddon} />
            </div>
          </div>
        </div>
        {templatesLoading && <p className="text-xs text-slate-500">Loading country templates...</p>}
        {templatesError && <p className="text-xs text-amber-700">{templatesError}</p>}
        {selectedTemplate && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Compliance rules</p>
            <p className="mt-1">{selectedTemplate.rules.notes}</p>
            <p className="mt-2 text-slate-500">
              Allowed edits:{" "}
              {[
                selectedTemplate.rules.allowCrop ? "crop" : null,
                selectedTemplate.rules.allowResize ? "resize" : null,
                selectedTemplate.rules.allowBackgroundReplace ? "background replacement" : null,
                selectedTemplate.rules.allowFaceRetouch ? "face retouch" : "no face retouch"
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        )}
        {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
        <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          Compliance notice: the app applies edits only if the selected template allows them. Facial retouching is
          disabled for official-use exports.
        </div>
      </div>
    </Card>
  );
}
