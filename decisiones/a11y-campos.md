# Decisiones pendientes — frente a11y-campos

Formato de cada entrada: qué se decide · qué se midió · opciones reales · recomendación.

---

## 1. Los nueve campos «sin nombre» eran diecisiete, y siete de ellos no lo estaban

**Qué se decide:** nada — se resuelve solo, pero queda escrito porque cambia una cifra que
está publicada en `docs/barridos-por-clase.md` y que otras sesiones podrían citar.

**Qué se midió:** los seis ficheros señalados, campo a campo y a ojo. Salieron 18 marcados: uno
es un falso positivo obvio (`EditableCell.tsx:93` es un comentario que menciona `<input
type="date">`), y siete más de `MatrixEditorView` **sí tenían nombre**, por un `<label>` que
envuelve el campo. La heurística solo buscaba `aria-label`, `title` y `placeholder`, así que no
veía la forma más común y más correcta de nombrar un campo.

Reales: 10 —2 en la tabla, 6 en dependencias, y los 7 usos de `EditableCell`, que son uno solo
en código—. Todos arreglados.

**Recomendación aplicada:** los siete falsos positivos quedan **probados por su nombre**
(`MatrixEditorView.a11y.test.tsx`) en vez de anotados, porque «lo comprobé y estaba bien» no
impide que mañana alguien saque un campo de su `<label>` al recolocar el diseño.

---

## 2. Sin contexto suficiente, no se pone nombre

**Qué se decide:** qué hacer con un control que no tiene de dónde sacar un nombre que signifique
algo.

**Qué se midió:** `EditableCell` no sabe de qué columna ni de qué tarea es; eso solo lo sabe la
fila. Poner ahí «celda» o «valor» habría dejado los 1.680 campos de un cronograma real diciendo
lo mismo.

**Opciones reales:** (a) nombre genérico en el componente; (b) que lo pase quien lo usa, y si no
llega, ninguno.

**Recomendación aplicada:** la (b). **Un campo que miente es peor que uno mudo**: el mudo no
engaña. Hay una prueba de control que fija esa decisión — sin `label`, no se inventa `aria-label`.

---

## 3. El nombre sale del título de la columna, no de una copia

**Qué se decide:** de dónde sale el texto del nombre.

**Qué se midió:** las columnas ya declaran su título (`label`/`labelEs`/`labelEn`). Escribirlo
otra vez en la fila habría creado dos verdades sobre lo mismo, que es la clase de duplicado que
ya cerró el guardián `limitesUnaSolaVez`.

**Recomendación aplicada:** `columnLabelForLocale(column, locale)`, con una prueba que exige que
el nombre del campo empiece exactamente por el texto de un encabezado real de la tabla.
