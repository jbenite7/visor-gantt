"use client";

import { useState } from "react";
import type { ActivityRecipe } from "@/types/matrix";
import {
  addRecipeActivity,
  moveRecipeActivity,
  removeRecipeActivity,
  setRecipeDependency,
} from "@/lib/matrix/recipes";

interface RecipeEditorProps {
  recipe: ActivityRecipe;
  onChange: (recipe: ActivityRecipe) => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm";

/**
 * Editor de la receta: qué actividades tiene, en qué orden y cómo se encadenan.
 *
 * Las reglas (quitar una actividad quita sus vínculos, un vínculo no puede
 * cerrar un círculo) viven en `lib/matrix/recipes.ts`. Aquí solo se enseñan
 * sus motivos.
 */
export default function RecipeEditor({ recipe, onChange }: RecipeEditorProps) {
  const [newName, setNewName] = useState("");
  const [predecessor, setPredecessor] = useState(recipe.activities[0]?.id ?? "");
  const [successor, setSuccessor] = useState(recipe.activities[1]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: string) =>
    recipe.activities.find((activity) => activity.id === id)?.name ?? id;

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Escribe el nombre de la actividad antes de agregarla.");
      return;
    }
    setError(null);
    setNewName("");
    onChange(
      addRecipeActivity(recipe, {
        id: `actividad-${Date.now()}`,
        name: trimmed,
        productivityPerDay: 1,
      }),
    );
  };

  const handleLink = () => {
    const { recipe: next, rejectedReason } = setRecipeDependency(recipe, {
      predecessorActivityId: predecessor,
      successorActivityId: successor,
      type: "FS",
    });
    if (rejectedReason) {
      setError(rejectedReason);
      return;
    }
    setError(null);
    onChange(next);
  };

  return (
    <section className="apple-section space-y-3 p-3" data-testid="recipe-editor">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
        Actividades de «{recipe.name}»
      </h3>

      <ol className="space-y-1">
        {recipe.activities.map((activity, index) => (
          <li
            key={activity.id}
            data-testid={`recipe-activity-${activity.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-hairline)] px-2 py-1 text-sm"
          >
            <span>
              {activity.name}
              <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                {activity.productivityPerDay} {activity.unit ?? "un"}/día
              </span>
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onChange(moveRecipeActivity(recipe, activity.id, index - 1))}
              >
                {`Subir ${activity.name}`}
              </button>
              <button
                type="button"
                disabled={index === recipe.activities.length - 1}
                onClick={() => onChange(moveRecipeActivity(recipe, activity.id, index + 1))}
              >
                {`Bajar ${activity.name}`}
              </button>
              <button
                type="button"
                onClick={() => onChange(removeRecipeActivity(recipe, activity.id))}
              >
                {`Quitar ${activity.name}`}
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Nombre de la actividad
          <input
            className={inputClass}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="button" onClick={handleAdd}>
          Agregar actividad
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Actividad anterior
          <select
            className={inputClass}
            value={predecessor}
            onChange={(event) => setPredecessor(event.target.value)}
          >
            {recipe.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          Actividad siguiente
          <select
            className={inputClass}
            value={successor}
            onChange={(event) => setSuccessor(event.target.value)}
          >
            {recipe.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleLink}>
          Enlazar actividades
        </button>
      </div>

      <ul data-testid="recipe-dependencies" className="text-xs text-[var(--color-text-muted)]">
        {recipe.dependencies.map((rule) => (
          <li key={`${rule.predecessorActivityId}-${rule.successorActivityId}`}>
            {`${nameOf(rule.predecessorActivityId)} → ${nameOf(rule.successorActivityId)}`}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-strong)]">
          {error}
        </p>
      )}
    </section>
  );
}
