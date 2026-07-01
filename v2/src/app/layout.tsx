import type { Metadata } from "next";
import ThemeToggle from "@/components/theme/ThemeToggle";
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = window.localStorage.getItem("visor-gantt-theme") === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch (_) {
  document.documentElement.dataset.theme = "light";
}
`,
          }}
        />
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
