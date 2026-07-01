"use client";

import { useState, useRef, useCallback } from "react";
import { parseMPP } from "@/lib/api";
import type { ProjectData } from "@/lib/parser/mpp-parser";

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
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
          ${
            isDragging
              ? "border-blue-400 bg-blue-950/20 scale-[1.01]"
              : error
                ? "border-red-500/50 bg-red-950/10 hover:border-red-400/60"
                : "border-slate-700 hover:border-slate-600 bg-slate-900"
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
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            {isProcessing ? (
              <svg
                className="w-8 h-8 text-blue-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className={`w-8 h-8 ${isDragging ? "text-blue-400" : "text-slate-400"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
          </div>

          {isProcessing ? (
            <div className="space-y-2">
              <p className="text-lg text-blue-400 animate-pulse">
                Parseando archivo...
              </p>
              <p className="text-sm text-slate-500">{fileName}</p>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium">
                {isDragging
                  ? "Suelta el archivo aquí"
                  : "Arrastra tu archivo .mpp aquí"}
              </p>
              <p className="text-sm text-slate-500">
                o haz clic para seleccionar desde tu equipo
              </p>
              <p className="text-xs text-slate-600">
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
          w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
          ${
            disabled || isProcessing
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700"
          }
        `}
      >
        {isProcessing ? "Procesando..." : "Seleccionar archivo .mpp"}
      </button>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-950/20 border border-red-700/50 text-red-400 text-sm">
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
