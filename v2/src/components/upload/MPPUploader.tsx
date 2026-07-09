"use client";

import { useState, useRef, useCallback } from "react";
import { parseMPP } from "@/lib/api";
import type { ProjectData } from "@/lib/parser/mpp-parser";
import { AlertTriangle, CloudUpload, Loader2 } from "lucide-react";

export interface MPPUploaderProps {
  onUploadComplete: (data: ProjectData) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

type UploadState = "idle" | "parsing";

const ACCEPTED_EXTENSIONS = [".mpp"];
const MAX_FILE_SIZE_MB = 50;

function validateFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Tipo de archivo no soportado. Usa archivos ${ACCEPTED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`;
  }
  return null;
}

export default function MPPUploader({
  onUploadComplete,
  onError,
  disabled = false,
}: MPPUploaderProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [dragCounter, setDragCounter] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isDragging = dragCounter > 0;
  const isProcessing = state === "parsing";

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError(validationError);
        return;
      }

      setState("parsing");
      setFileName(file.name);
      setError("");

      try {
        const data = await parseMPP(file);
        setState("idle");
        setError("");
        onUploadComplete(data);
      } catch (err) {
        setState("idle");
        const message =
          err instanceof Error
            ? err.message
            : "Error desconocido al parsear el archivo";
        setError(message);
        onError(message);
      }
    },
    [onUploadComplete, onError],
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c - 1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);

    if (disabled || isProcessing) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input so same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled && !isProcessing) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          apple-dropzone relative rounded-[var(--radius-lg)] p-12 text-center transition-all cursor-pointer
          ${
            isDragging
              ? "scale-[1.01] border-[var(--aia-corp-main)]"
              : error
                ? "border-[var(--aia-alert-main)]"
                : "border-[var(--color-hairline)]"
          }
          ${disabled || isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mpp"
          onChange={handleInputChange}
          className="sr-only"
          disabled={disabled || isProcessing}
          aria-label="Seleccionar archivo .mpp"
        />

        <div className="space-y-4">
          <div className="apple-card mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)]">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin text-[var(--aia-corp-main)]" />
            ) : (
              <CloudUpload
                className={`h-8 w-8 ${isDragging ? "text-[var(--aia-corp-main)]" : "text-[var(--color-text-muted)]"}`}
              />
            )}
          </div>

          {isProcessing ? (
            <div className="space-y-2">
              <p className="text-lg text-[var(--aia-corp-main)] animate-pulse">
                Parseando archivo...
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">{fileName}</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium">
                {isDragging
                  ? "Suelta el archivo aquí"
                  : "Arrastra tu archivo .mpp aquí"}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                o haz clic para seleccionar desde tu equipo
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Máximo {MAX_FILE_SIZE_MB} MB — Archivo MS Project (.mpp)
              </p>
            </>
          )}
        </div>
      </div>

      {/* File Selection Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={`
          w-full rounded-[var(--radius-lg)] px-4 py-2.5 text-sm font-medium transition-colors
          ${
            disabled || isProcessing
              ? "apple-button-secondary text-[var(--color-text-muted)] cursor-not-allowed"
              : "apple-button-primary"
          }
        `}
      >
        {isProcessing ? "Procesando..." : "Seleccionar archivo .mpp"}
      </button>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] p-3 text-sm text-[var(--aia-alert-main)]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
