/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EnlaceNoDisponible from "./not-found";

/**
 * El 404 de la puerta pública, escrito para quien la cruza.
 *
 * El 404 general dice «Volver a mis cronogramas» y lleva al listado, que pide
 * sesión. A quien llega por un enlace compartido eso lo deja en la pantalla de
 * iniciar sesión sin haber pedido nunca una cuenta: la app respondiendo a una
 * persona distinta de la que tiene delante.
 *
 * Y en esta ruta la causa más probable no es «mal escrito», es que el enlace
 * caducó a los siete días. Decirlo evita que quien lo recibió crea que el
 * cronograma se borró.
 *
 * Lo que **no** cambia: sigue sin distinguir caducado de inexistente. Eso es a
 * propósito, y lo comprueba `loadSharedProject`.
 */
describe("el enlace que ya no vale se le explica a quien no tiene cuenta", () => {
  test("nombra la caducidad, que es la causa probable aquí", () => {
    render(<EnlaceNoDisponible />);

    expect(screen.getByTestId("share-gone")).toHaveTextContent(/caduc/i);
  });

  test("no le manda a «mis cronogramas», que le pediría iniciar sesión", () => {
    render(<EnlaceNoDisponible />);

    expect(document.body.textContent).not.toMatch(/mis cronogramas/i);
  });

  test("le ofrece la salida que sí puede tomar: subir su propio archivo", () => {
    render(<EnlaceNoDisponible />);

    expect(screen.getByTestId("share-gone-cta")).toHaveAttribute("href", "/");
  });
});
