import { useMemo, useState } from "react";
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
  const [fileName, setFileName] = useState<string | undefined>();

  return (
    <Card id="upload" className="glass mx-auto w-full max-w-4xl">
      <CardHeader>
        <div>
          <CardTitle>Start with your photo</CardTitle>
          <CardDescription>Upload once, then fine-tune the rest of the flow.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-6 px-6 pb-6">
        <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 text-sm text-slate-300 transition hover:border-white/50">
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name);
            }}
          />
          <span className="text-white">{fileName ?? "Drag & drop your photo here"}</span>
          <span className="text-xs text-slate-400">PNG or JPG up to 10MB</span>
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
              onClick={() => onGenerate({ country, docType, output, fileName })}
            >
              Generate Photo
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          TODO: Connect this form to your upload/processing API to kick off generation.
        </p>
      </div>
    </Card>
  );
}
