/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import CalendarSettingsView from "./CalendarSettingsView";

describe("CalendarSettingsView", () => {
  test("toggles project work days", () => {
    const onChange = jest.fn();

    render(
      <CalendarSettingsView
        calendar={DEFAULT_PROJECT_CALENDAR}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sáb" }));

    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
    });
  });

  test("rejects duplicate non-working dates before emitting changes", () => {
    const onChange = jest.fn();
    const calendar = {
      ...DEFAULT_PROJECT_CALENDAR,
      nonWorkingDays: [
        { id: "existing", date: "2026-01-06", name: "Festivo" },
      ],
    };

    render(<CalendarSettingsView calendar={calendar} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Fecha no laboral"), {
      target: { value: "2026-01-06" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del día no laboral"), {
      target: { value: "Otro nombre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("La fecha ya está configurada.")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
