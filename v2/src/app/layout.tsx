import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visor Gantt — AIA",
  description:
    "Visor de cronogramas Gantt para archivos Microsoft Project (.mpp)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
