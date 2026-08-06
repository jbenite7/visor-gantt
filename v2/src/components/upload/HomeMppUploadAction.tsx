"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE_MB = 50;
const IMPORT_TIMEOUT_MS = 180000;

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phase, setPhase] = useState<"idle" | "parsing">(
    "idle",
  );
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const handleFile = async (file: File) => {
    const validationError = validateMppFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(
      () => controller.abort("timeout"),
      IMPORT_TIMEOUT_MS,
    );
    setPhase("parsing");
    setElapsedSeconds(0);
    const ticker = setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000,
    );

    controller.signal.addEventListener("abort", () => {
      setError(
        controller.signal.reason === "timeout"
          ? "El análisis tardó demasiado. Vuelve a intentarlo o prueba con un archivo más pequeño."
          : "Importación cancelada.",
      );
      setPhase("idle");
      setIsProcessing(false);
      clearInterval(ticker);
    });

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/import-mpp", {
        method: "POST",
        body,
        signal: controller.signal,
      });

      if (response.ok) {
        router.push(response.url || "/");
        return;
      }

      const payload = await response.json().catch(() => null);

      if (response.status === 401 && payload?.loginUrl) {
        router.push(payload.loginUrl);
        return;
      }

      setError(payload?.error ?? "No se pudo importar el archivo .mpp");
    } catch {
      if (controller.signal.aborted) {
        setError(
          controller.signal.reason === "timeout"
            ? "El análisis tardó demasiado. Vuelve a intentarlo o prueba con un archivo más pequeño."
            : "Importación cancelada.",
        );
      } else {
        setError("No se pudo conectar con el servidor de importacion");
      }
    } finally {
      clearTimeout(timeout);
      clearInterval(ticker);
      abortRef.current = null;
      setPhase("idle");
      setIsProcessing(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => event.preventDefault()}
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
          event.target.value = "";
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
      {isProcessing && (
        <span className="gantt-import-phase" data-testid="import-phase">
          {phase === "parsing" && "Analizando el cronograma…"}
          {elapsedSeconds > 0 && ` ${elapsedSeconds} s`}
          <button
            type="button"
            data-testid="cancel-import"
            onClick={() => abortRef.current?.abort("user")}
          >
            Cancelar
          </button>
        </span>
      )}
      {error && (
        <p className="max-w-md rounded-[var(--radius-lg)] border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] px-3 py-2 text-sm text-[var(--aia-alert-main)]">
          {error}
        </p>
      )}
    </form>
  );
}
