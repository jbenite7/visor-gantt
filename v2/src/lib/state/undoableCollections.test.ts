import { insertAt, removeWhere, replaceWhere,
  removeAt,
} from "./undoableCollections";

describe("insertAt / removeWhere (E24)", () => {
  test("devuelve el elemento a su posición original", () => {
    const original = ["a", "b", "c"];
    const withoutB = removeWhere(original, (item) => item === "b");
    expect(withoutB).toEqual(["a", "c"]);
    expect(insertAt(withoutB, 1, "b")).toEqual(["a", "b", "c"]);
  });

  test("no pisa lo que se añadió después de borrar — el caso que rompía el undo por snapshot", () => {
    const original = ["a", "b", "c"];
    const afterDelete = removeWhere(original, (item) => item === "b");
    // El usuario añade algo nuevo antes de deshacer.
    const afterAdd = [...afterDelete, "nuevo"];

    const afterUndo = insertAt(afterAdd, 1, "b");

    expect(afterUndo).toEqual(["a", "b", "c", "nuevo"]);
    expect(afterUndo).toContain("nuevo");
  });

  test("un índice mayor que la lista añade al final en vez de perder el elemento", () => {
    expect(insertAt(["a"], 9, "b")).toEqual(["a", "b"]);
  });

  test("insertar en 0 respeta el principio de la lista", () => {
    expect(insertAt(["b"], 0, "a")).toEqual(["a", "b"]);
  });

  test("removeWhere no muta el original", () => {
    const original = ["a", "b"];
    removeWhere(original, (item) => item === "a");
    expect(original).toEqual(["a", "b"]);
  });
});

describe("replaceWhere (E24: editar también se deshace)", () => {
  test("sustituye el elemento que coincide y respeta el resto", () => {
    const items = [{ id: 1, n: "a" }, { id: 2, n: "b" }];
    const next = replaceWhere(items, (i) => i.id === 2, { id: 2, n: "B" });

    expect(next).toEqual([{ id: 1, n: "a" }, { id: 2, n: "B" }]);
  });

  test("no muta la lista original", () => {
    const items = [{ id: 1, n: "a" }];
    replaceWhere(items, (i) => i.id === 1, { id: 1, n: "z" });
    expect(items[0].n).toBe("a");
  });

  test("si nada coincide devuelve una copia igual", () => {
    const items = [{ id: 1, n: "a" }];
    expect(replaceWhere(items, (i) => i.id === 9, { id: 9, n: "x" })).toEqual(items);
  });
});

describe("quitar por identidad, no por parecido", () => {
  test("removeAt quita solo la de esa posición, aunque haya iguales", () => {
    const duplicadas = [
      { taskId: 1, resourceId: 7 },
      { taskId: 1, resourceId: 7 },
      { taskId: 2, resourceId: 7 },
    ];

    expect(removeAt(duplicadas, 1)).toEqual([
      { taskId: 1, resourceId: 7 },
      { taskId: 2, resourceId: 7 },
    ]);
  });

  test("una posición fuera de rango no toca la lista", () => {
    const lista = [{ id: 1 }];

    expect(removeAt(lista, 5)).toEqual(lista);
    expect(removeAt(lista, -1)).toEqual(lista);
  });

  test("no modifica la lista original", () => {
    const lista = [{ id: 1 }, { id: 2 }];
    removeAt(lista, 0);

    expect(lista).toHaveLength(2);
  });

  test("quitar la última y volver a insertarla la deja donde estaba", () => {
    const lista = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(insertAt(removeAt(lista, 2), 2, { id: 3 })).toEqual(lista);
  });
});
