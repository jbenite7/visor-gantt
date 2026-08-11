"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { SHARE_TTL_DAYS } from "@/lib/share/shareToken";
import {
  MAX_FILE_SIZE_MB,
  archivoDemasiadoGrande,
} from "@/lib/import/uploadLimits";


/**
 * Ver un cronograma sin crear cuenta. La entrada de E51.
 *
 * Vive en `/login` y no en la home: la home redirige a `/login` cuando no hay
 * sesión, así que un botón allí sería una función construida que nadie sin
 * cuenta puede alcanzar — justo el patrón que este trabajo existe para
 * eliminar. Aquí lo ve la primera persona que llega.
 *
 * Son tres pasos hasta el cronograma: llegar, pulsar, elegir archivo.
 */
export default function AnonymousMppUpload({
  className,
}: {
  className?: string;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function alElegir(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Se comprueba aquí también, no solo en el servidor: avisar antes de subir
    // 50 MB por una red de obra es la diferencia entre un aviso y una espera
    // inútil. `file.size` se declara, no se materializa.
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`${archivoDemasiadoGrande()}.`);
      return;
    }

    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.set("file", file);
      const respuesta = await fetch("/api/ver-mpp", {
        method: "POST",
        body: cuerpo,
      });
      const datos = (await respuesta.json()) as {
        token?: string;
        error?: string;
      };

      if (!respuesta.ok || !datos.token) {
        setError(datos.error ?? "No pudimos leer el archivo.");
        return;
      }

      router.push(`/ver/${datos.token}`);
    } catch {
      setError(
        "No pudimos conectar. Comprueba la red y vuelve a intentarlo.",
      );
    } finally {
      // Siempre: si esto viviera solo en el camino bueno, un fallo de red
      // dejaría el botón bloqueado diciendo que sube algo que ya no sube.
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <label className="apple-button-secondary inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-lg)] px-4 py-2 text-sm font-semibold">
        {subiendo ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <FileUp size={16} aria-hidden />
        )}
        <span>{subiendo ? "Leyendo tu cronograma…" : "Ver un .mpp sin cuenta"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".mpp"
          aria-label="Ver un .mpp sin cuenta"
          disabled={subiendo}
          onChange={alElegir}
          className="sr-only"
        />
      </label>

      <p className="mt-2 max-w-xs text-xs text-[var(--color-text-muted)]">
        Se abre en solo lectura y el enlace caduca a los {SHARE_TTL_DAYS} días. Si te sirve,
        puedes quedártelo creando una cuenta.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-2 max-w-xs text-xs font-semibold text-[var(--aia-warn-main)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
