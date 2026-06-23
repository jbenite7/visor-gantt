import { parseBudgetCSV, budgetToCSV, validateBudgetItem } from "@/lib/budget/budgetParser";
import type { BudgetItem } from "@/types/budget";

describe("parseBudgetCSV", () => {
  test("happy path: valid CSV with 3 rows returns 3 BudgetItem objects with correct fields", () => {
    const csv = [
      "labor,Concrete,50000,12000,Q1-2026",
      "materials,Rebar,30000,8000,Q1-2026",
      "equipment,Crane,100000,25000",
    ].join("\n");

    const result = parseBudgetCSV(csv);

    expect(result).toHaveLength(3);

    // First row: all fields present
    expect(result[0].category).toBe("labor");
    expect(result[0].subcategory).toBe("Concrete");
    expect(result[0].budgetedAmount).toBe(50000);
    expect(result[0].spentAmount).toBe(12000);
    expect(result[0].period).toBe("Q1-2026");
    expect(result[0].id).toBeTruthy();
    expect(typeof result[0].id).toBe("string");
    expect(result[0].mappedTaskIds).toEqual([]);

    // Second row
    expect(result[1].category).toBe("materials");
    expect(result[1].subcategory).toBe("Rebar");
    expect(result[1].budgetedAmount).toBe(30000);
    expect(result[1].spentAmount).toBe(8000);
    expect(result[1].period).toBe("Q1-2026");

    // Third row: no period
    expect(result[2].category).toBe("equipment");
    expect(result[2].subcategory).toBe("Crane");
    expect(result[2].budgetedAmount).toBe(100000);
    expect(result[2].spentAmount).toBe(25000);
    expect(result[2].period).toBeUndefined();
  });

  test("with header: header row is skipped and data rows are parsed correctly", () => {
    const csv = [
      "Category,Subcategory,BudgetedAmount,SpentAmount,Period",
      "labor,Concrete,50000,12000,Q1-2026",
      "materials,Rebar,30000,8000,Q1-2026",
    ].join("\n");

    const result = parseBudgetCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("labor");
    expect(result[0].subcategory).toBe("Concrete");
    expect(result[0].budgetedAmount).toBe(50000);
    expect(result[1].category).toBe("materials");
  });

  test("quoted fields: commas inside quotes are preserved in subcategory", () => {
    const csv = 'materials,"Item, with comma",1000,500';

    const result = parseBudgetCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0].subcategory).toBe("Item, with comma");
    expect(result[0].budgetedAmount).toBe(1000);
    expect(result[0].spentAmount).toBe(500);
    expect(result[0].category).toBe("materials");
  });

  test("empty input returns empty array", () => {
    expect(parseBudgetCSV("")).toEqual([]);
    expect(parseBudgetCSV("   ")).toEqual([]);
  });

  test("invalid category falls back to 'other'", () => {
    const csv = "invalid,Test,1000,500";

    const result = parseBudgetCSV(csv);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("other");
    expect(result[0].subcategory).toBe("Test");
    expect(result[0].budgetedAmount).toBe(1000);
  });
});

describe("budgetToCSV", () => {
  test("exports 3 BudgetItems to CSV string with header and data rows", () => {
    const items: BudgetItem[] = [
      {
        id: "1",
        category: "labor",
        subcategory: "Concrete",
        budgetedAmount: 50000,
        spentAmount: 12000,
        period: "Q1-2026",
        mappedTaskIds: [],
      },
      {
        id: "2",
        category: "materials",
        subcategory: "Rebar",
        budgetedAmount: 30000,
        spentAmount: 8000,
        period: "Q1-2026",
        mappedTaskIds: [],
      },
      {
        id: "3",
        category: "equipment",
        subcategory: "Crane",
        budgetedAmount: 100000,
        spentAmount: 25000,
        mappedTaskIds: [],
      },
    ];

    const result = budgetToCSV(items);
    const lines = result.split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("Category,Subcategory,BudgetedAmount,SpentAmount,Period");
    expect(lines[1]).toBe("labor,Concrete,50000,12000,Q1-2026");
    expect(lines[2]).toBe("materials,Rebar,30000,8000,Q1-2026");
    expect(lines[3]).toBe("equipment,Crane,100000,25000,");
  });
});

describe("validateBudgetItem", () => {
  test("valid item with all fields correct returns empty error array", () => {
    const item: Partial<BudgetItem> = {
      category: "labor",
      budgetedAmount: 50000,
      spentAmount: 10000,
    };

    const errors = validateBudgetItem(item);

    expect(errors).toEqual([]);
  });

  test("negative budgetedAmount returns error about negative amount", () => {
    const item: Partial<BudgetItem> = {
      category: "materials",
      budgetedAmount: -1000,
    };

    const errors = validateBudgetItem(item);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe("El monto presupuestado no puede ser negativo");
  });

  test("missing category returns error about required category", () => {
    const item: Partial<BudgetItem> = {
      budgetedAmount: 50000,
    };

    const errors = validateBudgetItem(item);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe("La categoría es requerida");
  });
});
