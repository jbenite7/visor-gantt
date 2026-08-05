#!/usr/bin/env node
// Operación `lint` de la wiki `memoria/` (patrón LLM Wiki).
// Comprueba la FORMA y reporta; nunca corrige. Ver memoria/wiki-operacion.md.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estadoVeracidad, mensajeVeracidad } from './wiki-veracidad.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(RAIZ, 'memoria');

const AREAS = new Set(['gantt', 'importacion', 'scheduling', 'datos', 'ui', 'auth',
  'reportes', 'qa', 'docker', 'deploy', 'proceso', 'arquitectura']);
const TIPOS = new Set(['mapa', 'decision', 'concepto', 'trampa', 'referencia', 'modulo', 'flujo']);
const ESTADOS = new Set(['vigente', 'derogada']);

function listarMd(dir) {
  const salida = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) salida.push(...listarMd(p));
    else if (extname(e.name) === '.md') salida.push(p);
  }
  return salida;
}

// Índice del vault entero (la raíz del repo), aplicando los mismos filtros que Obsidian.
const filtros = JSON.parse(readFileSync(join(RAIZ, '.obsidian/app.json'), 'utf8')).userIgnoreFilters;
const ignorado = (rel) => filtros.some((f) => rel === f.replace(/\/$/, '') || rel.startsWith(f))
  || rel.startsWith('.git/');

const vault = [];
(function recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    const rel = relative(RAIZ, p);
    if (ignorado(rel + (e.isDirectory() ? '/' : ''))) continue;
    if (e.isDirectory()) recorrer(p);
    else if (extname(e.name) === '.md' || extname(e.name) === '.base') vault.push(rel);
  }
})(RAIZ);

const porRuta = new Set(vault.map((f) => f.replace(/\.(md|base)$/, '')));
const porNombre = new Map();
for (const f of vault) {
  const corto = basename(f, extname(f));
  if (!porNombre.has(corto)) porNombre.set(corto, []);
  porNombre.get(corto).push(f);
}

const hallazgos = [];
const anota = (cat, archivo, detalle) => hallazgos.push(`${cat} ${archivo}: ${detalle}`);

const paginas = listarMd(WIKI);
const indice = readFileSync(join(WIKI, 'index.md'), 'utf8');

// Tipos cubiertos por alguna vista de paginas.base: esas páginas no necesitan enlace desde index.md.
const tiposCubiertos = new Set();
const rutaBase = join(WIKI, 'paginas.base');
if (existsSync(rutaBase)) {
  const base = readFileSync(rutaBase, 'utf8');
  for (const m of base.matchAll(/note\.tipo\s*==\s*"([^"]+)"/g)) tiposCubiertos.add(m[1]);
}

for (const p of paginas) {
  const rel = relative(RAIZ, p);
  const texto = readFileSync(p, 'utf8');
  const fm = texto.match(/^---\n([\s\S]*?)\n---/)?.[1];

  if (!fm) { anota('FRONTMATTER', rel, 'sin bloque de frontmatter'); continue; }

  const campo = (k) => fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1]?.trim();
  for (const k of ['tipo', 'estado', 'fecha', 'fuente', 'resumen']) {
    if (!campo(k)) anota('FRONTMATTER', rel, `falta o está vacío: ${k}`);
  }
  if (fm.match(/^areas:/m) === null) anota('FRONTMATTER', rel, 'falta: areas');
  if (campo('tipo') && !TIPOS.has(campo('tipo'))) anota('FRONTMATTER', rel, `tipo desconocido: ${campo('tipo')}`);
  if (campo('estado') && !ESTADOS.has(campo('estado'))) anota('FRONTMATTER', rel, `estado desconocido: ${campo('estado')}`);
  if (campo('fecha') && !/^\d{4}-\d{2}-\d{2}$/.test(campo('fecha'))) anota('FRONTMATTER', rel, `fecha no ISO: ${campo('fecha')}`);

  // `areas` admite forma inline (`[a, b]`) y forma de bloque (lista con guiones).
  let areas = [];
  const areasInline = fm.match(/^areas:\s*\[(.*)\]$/m)?.[1];
  if (areasInline !== undefined) {
    areas = areasInline.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    const areasBloque = fm.match(/^areas:\s*\n((?:^\s*-\s*.+\n?)+)/m)?.[1];
    if (areasBloque) {
      areas = [...areasBloque.matchAll(/^\s*-\s*(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
    }
  }
  for (const a of areas) if (!AREAS.has(a)) anota('AREA', rel, `fuera de la lista cerrada: ${a}`);

  // Una nota, un hecho: más de tres hechos numerados delata una nota que debería partirse.
  const numerados = (texto.match(/^(?:\d+\.|\*\*\d+\.)\s/gm) ?? []).length;
  if (numerados > 3) anota('MULTIHECHO', rel, `${numerados} hechos numerados; parte la nota`);

  // Enlaces. Se ignora lo que va dentro de bloques y spans de código.
  const limpio = texto.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of limpio.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const destino = m[1].trim().replace(/\.(md|base)$/, '');
    if (porRuta.has(destino)) continue;
    const cand = porNombre.get(basename(destino));
    if (!cand) anota('ENLACE', rel, `roto: [[${destino}]]`);
    else if (cand.length > 1) anota('ENLACE', rel, `ambiguo: [[${destino}]] → ${cand.join(', ')}`);
  }

  // Toda página debe ser alcanzable desde el índice o desde una vista de la base.
  const nombre = basename(p, '.md');
  const enlazadaEnIndice = new RegExp(`\\[\\[${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\]\\]|[|#])`).test(indice);
  if (!['index', 'log'].includes(nombre)
      && !enlazadaEnIndice
      && !tiposCubiertos.has(campo('tipo'))) {
    anota('INDICE', rel, 'no aparece en index.md y ninguna vista de paginas.base la lista');
  }
}

// Edad del último pase de veracidad, medida en commits de código (no en días).
const veracidad = mensajeVeracidad(estadoVeracidad(readFileSync(join(WIKI, 'log.md'), 'utf8')));
if (veracidad.hallazgo) anota('VERACIDAD', 'memoria/log.md', veracidad.hallazgo);
if (veracidad.aviso) console.log(`${veracidad.aviso}\n`);

if (hallazgos.length) {
  console.log(hallazgos.join('\n'));
  console.log(`\n${hallazgos.length} hallazgos en ${paginas.length} páginas.`);
  process.exit(1);
}
console.log(`Sin hallazgos. ${paginas.length} páginas revisadas.`);
