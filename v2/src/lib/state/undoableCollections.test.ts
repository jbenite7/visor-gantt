import { insertAt, removeWhere, replaceWhere } from "./undoableCollections";

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
