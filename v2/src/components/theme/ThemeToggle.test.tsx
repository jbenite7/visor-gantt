/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  test("defaults to light and persists dark mode when toggled", () => {
    render(<ThemeToggle />);

    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Cambiar a modo oscuro" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("visor-gantt-theme")).toBe("dark");
  });

  test("hydrates with the same initial markup even when localStorage is dark", async () => {
    window.localStorage.clear();
    const serverHtml = renderToString(<ThemeToggle />);
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    window.localStorage.setItem("visor-gantt-theme", "dark");
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <ThemeToggle />);
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cambiar a modo claro" })).toBeInTheDocument();

    await act(async () => {
      root?.unmount();
    });
    consoleError.mockRestore();
    container.remove();
  });
});
