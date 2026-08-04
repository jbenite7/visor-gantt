"use client";

import { useState } from "react";
import { uploadProject } from "../actions/upload";
import ErrorDisplay from "@/components/upload/ErrorDisplay";
import HomeMppUploadAction from "@/components/upload/HomeMppUploadAction";
import { CheckCircle2, FileCode2, Loader2, UploadCloud } from "lucide-react";

export default function UploadPage() {
  // Legacy XML upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isXmlUploading, setIsXmlUploading] = useState(false);
  const [xmlResult, setXmlResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // --- Legacy XML Upload Handlers ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processXmlFile(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processXmlFile(files[0]);
    }
  };

  const processXmlFile = async (file: File) => {
    setIsXmlUploading(true);
    setXmlResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadProject(formData);
      setXmlResult(res);
    } catch (error) {
      setXmlResult({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsXmlUploading(false);
    }
  };

  // --- Render ---

  return (
    <div className="apple-page px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--aia-corp-main)] shadow-sm">
            <UploadCloud size={28} aria-hidden />
          </div>
          <h1 className="text-4xl font-semibold text-[var(--color-text-strong)]">
            Importar proyecto
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Carga un cronograma MS Project y conviértelo en Gantt, recursos y programación matricial.
          </p>
        </div>

        <section className="apple-dropzone rounded-[var(--radius-lg)] p-8 text-center">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-strong)]">
            Selecciona un .mpp para importarlo y abrirlo como proyecto guardado.
          </p>
          <HomeMppUploadAction />
        </section>

        <section className="apple-section p-5">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
            <FileCode2 size={16} aria-hidden />
            ¿Tienes un archivo XML?{" "}
            <span className="font-semibold text-[var(--color-text-strong)]">
              Usa la opción heredada
            </span>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              apple-dropzone relative rounded-[var(--radius-lg)] p-6 text-center transition-all
              ${
                isDragging
                  ? "border-[var(--aia-corp-main)]"
                  : "border-[var(--color-hairline)]"
              }
              ${isXmlUploading ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input
              type="file"
              accept=".xml"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isXmlUploading}
            />

            <div className="space-y-2">
              {isXmlUploading ? (
                <p className="inline-flex items-center gap-2 text-sm text-[var(--aia-corp-main)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Procesando XML...
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                    {isDragging
                      ? "Suelta el archivo XML aquí"
                      : "Arrastra un archivo XML o haz clic"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Compatible con MSPDI XML
                  </p>
                </>
              )}
            </div>
          </div>

          {xmlResult && (
            <div
              className={`
              mt-3 rounded-[var(--radius-lg)] border p-3 text-sm
              ${
                xmlResult.success
                  ? "border-[var(--aia-corp-main)] bg-[var(--aia-corp-xlight)] text-[var(--color-text-strong)]"
                  : ""
              }
            `}
            >
              {xmlResult.success ? (
                <p className="inline-flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {xmlResult.message}
                </p>
              ) : (
                <ErrorDisplay
                  error={xmlResult.message}
                  onDismiss={() => setXmlResult(null)}
                />
              )}
            </div>
          )}
        </section>

        <div className="border-t border-[var(--color-hairline)] pt-4">
          <p className="text-center text-sm text-[var(--color-text-muted)]">
            Visor Gantt v2 - Next.js + PostgreSQL
          </p>
        </div>
      </div>
    </div>
  );
}
