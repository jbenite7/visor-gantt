import {
  DRAFT_HISTORY_LIMIT,
  canRedoDraft,
  canUndoDraft,
  commitDraftState,
  createDraftHistory,
  redoDraftState,
  undoDraftState,
} from "./draftHistory";

describe("draftHistory (R1: la pila propia del editor de matriz)", () => {
  test("un borrador recién abierto no tiene nada que deshacer", () => {
    const history = createDraftHistory({ n: 0 });

    expect(history.present).toEqual({ n: 0 });
    expect(canUndoDraft(history)).toBe(false);
    expect(canRedoDraft(history)).toBe(false);
  });

  test("deshacer devuelve exactamente el estado anterior", () => {
    let history = createDraftHistory({ n: 0 });
    history = commitDraftState(history, { n: 1 });
    history = commitDraftState(history, { n: 2 });

    history = undoDraftState(history);

    expect(history.present).toEqual({ n: 1 });
    expect(canUndoDraft(history)).toBe(true);
    expect(canRedoDraft(history)).toBe(true);
  });

  test("rehacer devuelve lo deshecho", () => {
    let history = createDraftHistory({ n: 0 });
    history = commitDraftState(history, { n: 1 });
    history = undoDraftState(history);
    history = redoDraftState(history);

    expect(history.present).toEqual({ n: 1 });
    expect(canRedoDraft(history)).toBe(false);
  });

  test("un cambio nuevo después de deshacer descarta el futuro", () => {
    let history = createDraftHistory({ n: 0 });
    history = commitDraftState(history, { n: 1 });
    history = undoDraftState(history);
    history = commitDraftState(history, { n: 9 });

    expect(history.present).toEqual({ n: 9 });
    expect(canRedoDraft(history)).toBe(false);
  });

  test("deshacer sin pasado no rompe ni cambia nada", () => {
    const history = createDraftHistory({ n: 0 });

    expect(undoDraftState(history)).toEqual(history);
    expect(redoDraftState(history)).toEqual(history);
  });

  test("el pasado se corta en el tope y conserva los más recientes", () => {
    let history = createDraftHistory({ n: 0 });
    for (let i = 1; i <= DRAFT_HISTORY_LIMIT + 10; i += 1) {
      history = commitDraftState(history, { n: i });
    }

    expect(history.past).toHaveLength(DRAFT_HISTORY_LIMIT);
    expect(history.past[history.past.length - 1]).toEqual({
      n: DRAFT_HISTORY_LIMIT + 9,
    });
  });

  test("sin borrador todavía, el primer cambio no inventa un pasado", () => {
    const history = commitDraftState(
      createDraftHistory<{ n: number }>(undefined),
      { n: 1 },
    );

    expect(history.past).toEqual([]);
    expect(canUndoDraft(history)).toBe(false);
  });
});
