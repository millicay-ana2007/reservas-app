import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// columnas: [{ label, key, accessor?(fila) }]
const valor = (col, fila) => (col.accessor ? col.accessor(fila) : fila[col.key]);

export function exportarExcel(nombreArchivo, columnas, filas) {
  const datos = filas.map((f) => Object.fromEntries(columnas.map((c) => [c.label, valor(c, f)])));
  const hoja = XLSX.utils.json_to_sheet(datos);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Reporte");
  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}

export function exportarPDF(nombreArchivo, titulo, columnas, filas) {
  const doc = new jsPDF({ orientation: columnas.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text(titulo, 14, 18);
  doc.setFontSize(9);
  doc.text(`Generado el ${new Date().toLocaleString("es-AR")}`, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [columnas.map((c) => c.label)],
    body: filas.map((f) => columnas.map((c) => valor(c, f))),
    headStyles: { fillColor: [123, 30, 58] },
    styles: { fontSize: 9 },
  });
  doc.save(`${nombreArchivo}.pdf`);
}
