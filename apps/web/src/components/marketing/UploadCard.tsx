import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Card } from "@/components/ui";

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

// The editor uses these as sensible defaults; the user picks the exact size/output inside /app.
const DEFAULTS = { country: "United States", docType: "Passport", output: "Digital" };

export default function UploadCard({ onGenerate }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onGenerate({ ...DEFAULTS, fileDataUrl: reader.result as string, fileName: file.name });
    reader.readAsDataURL(file);
  };

  return (
    <Card id="upload" className="glass mx-auto w-full max-w-2xl">
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        {/* Capture — go straight into the editor's camera step */}
        <button
          type="button"
          onClick={() => {
            window.location.href = "/app";
          }}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center transition hover:border-amber-400 hover:bg-amber-50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Camera className="h-6 w-6" />
          </span>
          <span className="text-base font-semibold text-slate-900">Take a photo</span>
          <span className="text-xs text-slate-500">Use your camera</span>
        </button>

        {/* Upload — pick or drop an image, then into the editor */}
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border px-6 py-10 text-center transition ${
            dragging
              ? "border-amber-400 bg-amber-50"
              : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ImagePlus className="h-6 w-6" />
          </span>
          <span className="text-base font-semibold text-slate-900">Upload an image</span>
          <span className="text-xs text-slate-500">Drag &amp; drop or choose from your device</span>
        </label>
      </div>
    </Card>
  );
}
