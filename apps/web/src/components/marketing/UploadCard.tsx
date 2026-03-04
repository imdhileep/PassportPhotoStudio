import { useMemo, useRef, useState } from "react";
import { Button, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { passportStandards } from "@passport/ai";

type UploadSettings = {
  country: string;
  docType: string;
  output: string;
  fileDataUrl?: string;
  fileName?: string;
};

type UploadCardProps = {
  onGenerate: (settings: UploadSettings) => void;
};

export default function UploadCard({ onGenerate }: UploadCardProps) {
  const countryOptions = useMemo(
    () => passportStandards.map((standard) => standard.label),
    []
  );
  const [country, setCountry] = useState(countryOptions[0] ?? "United States");
  const [docType, setDocType] = useState("Passport");
  const [output, setOutput] = useState("Digital");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | undefined>();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-sm text-slate-300 transition ${
            isDragging
              ? "border-ocean bg-ocean/10"
              : "border-white/20 bg-white/5 hover:border-white/50"
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
          <span className="text-white">{fileName ?? "Drag & drop your photo here"}</span>
          <span className="text-xs text-slate-400">Or capture inside the app after you start.</span>
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Country</p>
            <input
              list="country-options"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white"
              aria-label="Country"
            />
            <datalist id="country-options">
              {countryOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Document Type</p>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose document" />
              </SelectTrigger>
              <SelectContent>
                {["Passport", "Visa", "ID Card", "OPT EAD"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Output</p>
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
        {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
        <p className="text-xs text-slate-400">
          TODO: Connect this form to your upload/processing API to kick off generation.
        </p>
      </div>
    </Card>
  );
}
