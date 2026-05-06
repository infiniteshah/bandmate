"use client";
import { useRef, useState } from "react";

type Props = {
  onPicked: (file: File, dataUrl: string) => void;
  hint?: string;
};

export function PhotoCapture({ onPicked, hint }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function open() {
    inputRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    onPicked(file, dataUrl);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <button
        onClick={open}
        className="frame group flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-3 rounded-md text-ink/70 transition hover:text-ink"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="h-full w-full rounded-sm object-cover"
          />
        ) : (
          <>
            <CameraIcon />
            <div className="font-mono text-[11px] uppercase tracking-[0.22em]">
              Tap to photograph an object
            </div>
            {hint ? (
              <div className="max-w-[22ch] text-center text-[13px] text-ink/55">
                {hint}
              </div>
            ) : null}
          </>
        )}
      </button>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M8 6l1.5-2h5L16 6" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
