import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  /**
   * El distintivo de desarrollo se sitúa en la esquina inferior izquierda, que
   * es donde termina el menú de vistas: tapaba «Configuración» y bloqueaba el
   * clic en las pruebas de extremo a extremo. Es chrome de desarrollo, no del
   * producto.
   */
  devIndicators: false,
};

export default nextConfig;
