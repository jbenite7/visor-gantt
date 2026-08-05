#!/usr/bin/env node
// Alarma de la operación `veracidad` de la wiki `memoria/`.
// Funciones puras: no imprimen ni salen con código. Las consume scripts/wiki-lint.mjs.
// Ver memoria/wiki-operacion.md.
import { execFileSync } from 'node:child_process';

// Más de este número de commits de código desde el último pase → hallazgo.
// Ajustable en una línea; si se cambia, deja constancia en memoria/log.md.
export const UMBRAL_COMMITS = 40;

// Código y contratos. `memoria/` queda fuera a propósito: la wiki no dispara su propia alarma.
export const RUTAS_CONTADAS = ['v2/src/', 'v2/scripts/', 'services/', 'scripts/', 'docs/', 'AGENTS.md'];

const LINEA_VERACIDAD = /^-\s+(\d{4}-\d{2}-\d{2})\s+·\s+veracidad\s+·/;

export function ultimoPase(logTexto) {
  let ultima = null;
  for (const linea of logTexto.split('\n')) {
    const m = LINEA_VERACIDAD.exec(linea.trim());
    if (m) ultima = m[1];
  }
  return ultima;
}

function gitPorDefecto(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

export function contarCommits(desde, ejecutor = gitPorDefecto) {
  const args = ['log', `--since=${desde} 00:00`, '--pretty=%H', '--', ...RUTAS_CONTADAS];
  return ejecutor(args).split('\n').filter((l) => l.trim()).length;
}

export function estadoVeracidad(logTexto, ejecutor = gitPorDefecto) {
  const desde = ultimoPase(logTexto);
  if (!desde) return { sembrado: false, desde: null, commits: 0, excedido: false };
  const commits = contarCommits(desde, ejecutor);
  return { sembrado: true, desde, commits, excedido: commits > UMBRAL_COMMITS };
}

export function mensajeVeracidad(estado) {
  if (!estado.sembrado) {
    return {
      hallazgo: null,
      aviso: 'Veracidad: sin pase registrado todavía. El primer pase siembra la línea '
        + '`veracidad` en memoria/log.md; hasta entonces esta comprobación no falla.',
    };
  }
  if (!estado.excedido) {
    return {
      hallazgo: null,
      aviso: `Veracidad: ${estado.commits} commits de código desde el pase del ${estado.desde} `
        + `(umbral ${UMBRAL_COMMITS}).`,
    };
  }
  return {
    hallazgo: `${estado.commits} commits de código desde el último pase del ${estado.desde}, `
      + `por encima del umbral de ${UMBRAL_COMMITS}. Toca un pase de veracidad: `
      + 'verifica contra el repositorio las páginas de las áreas que cambiaron '
      + '(ver memoria/wiki-operacion.md).',
    aviso: null,
  };
}
