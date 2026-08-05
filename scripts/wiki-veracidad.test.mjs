import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UMBRAL_COMMITS, ultimoPase, contarCommits, estadoVeracidad, mensajeVeracidad,
} from './wiki-veracidad.mjs';

const LOG_SIN_PASE = '# Log\n\n- 2026-08-05 · ingest · se monta la wiki\n';
const LOG_CON_PASES = [
  '# Log',
  '',
  '- 2026-07-01 · veracidad · areas: gantt · sin correcciones',
  '- 2026-07-15 · ingest · cosas',
  '- 2026-08-02 · veracidad · areas: scheduling, datos · 2 notas derogadas',
  '',
].join('\n');

test('ultimoPase devuelve null si no hay ninguna linea de veracidad', () => {
  assert.equal(ultimoPase(LOG_SIN_PASE), null);
});

test('ultimoPase devuelve la fecha del ultimo pase, no la del primero', () => {
  assert.equal(ultimoPase(LOG_CON_PASES), '2026-08-02');
});

test('ultimoPase ignora las lineas de ingest', () => {
  assert.equal(ultimoPase('- 2026-08-05 · ingest · veracidad mencionada de pasada\n'), null);
});

test('contarCommits cuenta las lineas no vacias que devuelve el ejecutor', () => {
  const fake = () => 'aaa\nbbb\nccc\n';
  assert.equal(contarCommits('2026-08-01', fake), 3);
});

test('contarCommits pasa --since con hora 00:00 para incluir los commits del dia', () => {
  let argsCapturados = null;
  const fake = (args) => {
    argsCapturados = args;
    return '';
  };
  contarCommits('2026-08-05', fake);
  assert.ok(argsCapturados.includes('--since=2026-08-05 00:00'));
});

test('contarCommits devuelve 0 cuando el ejecutor no devuelve nada', () => {
  assert.equal(contarCommits('2026-08-01', () => ''), 0);
});

test('estadoVeracidad marca sembrado:false cuando no hay pase', () => {
  const e = estadoVeracidad(LOG_SIN_PASE, () => '');
  assert.deepEqual(e, { sembrado: false, desde: null, commits: 0, excedido: false });
});

test('estadoVeracidad no excede cuando los commits estan en el umbral', () => {
  const e = estadoVeracidad(LOG_CON_PASES, () => 'x\n'.repeat(UMBRAL_COMMITS));
  assert.equal(e.commits, UMBRAL_COMMITS);
  assert.equal(e.excedido, false);
});

test('estadoVeracidad excede en cuanto pasa el umbral por uno', () => {
  const e = estadoVeracidad(LOG_CON_PASES, () => 'x\n'.repeat(UMBRAL_COMMITS + 1));
  assert.equal(e.excedido, true);
  assert.equal(e.desde, '2026-08-02');
});

test('mensajeVeracidad sin pase avisa pero no es hallazgo', () => {
  const m = mensajeVeracidad({ sembrado: false, desde: null, commits: 0, excedido: false });
  assert.equal(m.hallazgo, null);
  assert.match(m.aviso, /sin pase registrado/);
});

test('mensajeVeracidad dentro del umbral avisa pero no es hallazgo', () => {
  const m = mensajeVeracidad({ sembrado: true, desde: '2026-08-02', commits: 5, excedido: false });
  assert.equal(m.hallazgo, null);
  assert.match(m.aviso, /5 commits/);
});

test('mensajeVeracidad excedido devuelve hallazgo y ningun aviso', () => {
  const m = mensajeVeracidad({ sembrado: true, desde: '2026-08-02', commits: 99, excedido: true });
  assert.equal(m.aviso, null);
  assert.match(m.hallazgo, /99 commits/);
  assert.match(m.hallazgo, /2026-08-02/);
});
