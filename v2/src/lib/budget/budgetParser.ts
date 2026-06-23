/**
 * CSV parser for budget items.
 *
 * Expected CSV format:
 *   Category,Subcategory,BudgetedAmount,SpentAmount,Period
 *   labor,"Concrete work",50000,12000,Q1-2026
 *
 * Handles quoted fields, empty lines, and header detection.
 */

import type { BudgetCategory, BudgetItem } from "@/types/budget";

const VALID_CATEGORIES: BudgetCategory[] = [
  "labor",
  "materials",
  "equipment",
  "subcontractors",
  "other",
];

const CATEGORY_ALIASES: Record<string, BudgetCategory> = {
  labor: "labor",
  labour: "labor",
  "mano de obra": "labor",
  materials: "materials",
  materiales: "materials",
  equipment: "equipment",
  equipo: "equipment",
  subcontractors: "subcontractors",
  subcontratistas: "subcontractors",
  other: "other",
  otro: "other",
  otros: "other",
};

function normalizeCategory(raw: string): BudgetCategory {
  const lower = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[lower] ?? "other";
}

/**
 * Parse a single CSV line into fields, handling quoted fields.
 * Supports commas inside quotes and escaped quotes ("").
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Check if a row looks like a header row (contains "category" in first column).
 */
function isHeaderRow(fields: string[]): boolean {
  const first = fields[0]?.trim().toLowerCase() ?? "";
  return first === "category" || first === "categoría";
}

/**
 * Generate a unique ID for budget items.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Parse CSV text into an array of BudgetItem objects.
 *
 * Expected CSV format:
 *   Category,Subcategory,BudgetedAmount,SpentAmount,Period
 *
 * - Skips header row if first row contains "Category" or "category"
 * - Handles quoted fields with commas inside
 * - Skips empty lines
 * - Returns empty array for empty input
 * - Validates category (falls back to "other" for unknown values)
 */
export function parseBudgetCSV(csvText: string): BudgetItem[] {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/);
  const items: BudgetItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // skip empty lines

    const fields = parseCSVLine(trimmed);

    // Skip header row
    if (items.length === 0 && isHeaderRow(fields)) continue;

    // Need at least Category and BudgetedAmount (columns 0 and 2)
    if (fields.length < 3) continue;

    const category = normalizeCategory(fields[0] ?? "");
    const subcategory = fields[1]?.trim() || undefined;
    const budgetedAmount = parseFloat(fields[2] ?? "");
    const spentAmount = fields.length >= 4 ? parseFloat(fields[3] ?? "") : 0;
    const period = fields.length >= 5 ? fields[4]?.trim() || undefined : undefined;

    // Skip rows with invalid numeric values
    if (Number.isNaN(budgetedAmount)) continue;

    items.push({
      id: generateId(),
      category,
      subcategory,
      budgetedAmount,
      spentAmount: Number.isNaN(spentAmount) ? 0 : spentAmount,
      period,
      mappedTaskIds: [],
    });
  }

  return items;
}

/**
 * Export budget items to a CSV string.
 */
export function budgetToCSV(items: BudgetItem[]): string {
  const header = "Category,Subcategory,BudgetedAmount,SpentAmount,Period";
  const rows = items.map((item) => {
    const fields = [
      item.category,
      item.subcategory ?? "",
      item.budgetedAmount.toString(),
      item.spentAmount.toString(),
      item.period ?? "",
    ];

    // Quote fields that contain commas
    return fields
      .map((f) => (f.includes(",") ? `"${f}"` : f))
      .join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Validate a budget item. Returns an array of error messages (empty = valid).
 */
export function validateBudgetItem(item: Partial<BudgetItem>): string[] {
  const errors: string[] = [];

  if (!item.category) {
    errors.push("La categoría es requerida");
  } else if (!VALID_CATEGORIES.includes(item.category)) {
    errors.push(
      `Categoría inválida: "${item.category}". Debe ser: ${VALID_CATEGORIES.join(", ")}`,
    );
  }

  if (item.budgetedAmount === undefined || item.budgetedAmount === null) {
    errors.push("El monto presupuestado es requerido");
  } else if (item.budgetedAmount < 0) {
    errors.push("El monto presupuestado no puede ser negativo");
  }

  if (item.spentAmount !== undefined && item.spentAmount < 0) {
    errors.push("El monto gastado no puede ser negativo");
  }

  return errors;
}
