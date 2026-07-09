"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE_MB = 50;

function validateMppFile(file: File): string | null {
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (extension !== ".mpp") {
    return "Selecciona un archivo Microsoft Project con extension .mpp";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `El archivo supera el maximo de ${MAX_FILE_SIZE_MB} MB`;
  }
  return null;
}

interface HomeMppUploadActionProps {
  className?: string;
}

export default function HomeMppUploadAction({
  className = "mt-4 flex flex-col items-center gap-2",
}: HomeMppUploadActionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const validationError = validateMppFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);
    formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action="/api/import-mpp"
      method="post"
      encType="multipart/form-data"
      className={className}
    >
      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".mpp"
        aria-label="Seleccionar archivo .mpp"
        className="sr-only"
        disabled={isProcessing}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => inputRef.current?.click()}
        className="apple-button-primary inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
      >
        <Upload size={16} aria-hidden />
        {isProcessing ? "Importando..." : "Subir Archivo .mpp"}
      </button>
      {error && (
        <p className="max-w-md rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] px-3 py-2 text-sm text-[var(--aia-alert-main)]">
          {error}
        </p>
      )}
    </form>
  );
}
