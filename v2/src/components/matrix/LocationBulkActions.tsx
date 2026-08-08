"use client";

import { useState } from "react";

interface LocationBulkActionsProps {
  locations: Array<{ id: string; name: string }>;
  onDuplicate: (areaId: string) => void;
  onCreateRange: (input: {
    pattern: string;
    from: number;
    to: number;
    type: string;
  }) => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm";

export default function LocationBulkActions({
  locations,
  onDuplicate,
  onCreateRange,
}: LocationBulkActionsProps) {
  const [selected, setSelected] = useState(locations[0]?.id ?? "");
  const [pattern, setPattern] = useState("Piso {n}");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [type, setType] = useState("Piso");

  const count = Math.abs(to - from) + 1;

  return (
    <section className="apple-section space-y-3 p-3" data-testid="location-bulk-actions">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Ubicación a duplicar
          <select
            className={inputClass}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={locations.length === 0}
          onClick={() => onDuplicate(selected)}
        >
          Duplicar ubicación
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          {"Nombre, con {n} donde va el número"}
          <input
            className={inputClass}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
        </label>
        <label className="flex flex-col text-xs">
          Desde
          <input
            className={inputClass}
            type="number"
            value={from}
            onChange={(event) => setFrom(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col text-xs">
          Hasta
          <input
            className={inputClass}
            type="number"
            value={to}
            onChange={(event) => setTo(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col text-xs">
          Tipo
          <input
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => onCreateRange({ pattern, from, to, type })}
        >
          Crear ubicaciones
        </button>
      </div>

      <p data-testid="range-preview" className="text-xs text-[var(--color-text-muted)]">
        {`Se crearán ${count} ubicaciones.`}
      </p>
    </section>
  );
}
