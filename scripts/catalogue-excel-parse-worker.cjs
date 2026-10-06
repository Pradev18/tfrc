/**
 * Off-thread Meta catalogue Excel decode.
 * Keeps synchronous XLSX.read off the Next.js event loop so storefront
 * and other admin modules stay responsive during large uploads.
 */
const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require("xlsx");

function send(message) {
  if (parentPort) parentPort.postMessage(message);
}

function sheetToMatrix(sheet) {
  const ref = sheet["!ref"];
  if (!ref) return { matrix: [], originRow: 1 };
  const range = XLSX.utils.decode_range(ref);
  const matrix = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) {
        row.push("");
        continue;
      }
      const target = cell.l && typeof cell.l.Target === "string" ? cell.l.Target : "";
      if (target.startsWith("http://") || target.startsWith("https://")) {
        row.push(target);
      } else {
        row.push(cell.v == null ? "" : cell.v);
      }
    }
    matrix.push(row);
  }
  return { matrix, originRow: range.s.r + 1 };
}

try {
  const buffer = Buffer.from(workerData.buffer);
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
  const sheetName =
    workbook.SheetNames.find((name) => String(name).toLowerCase().includes("meta")) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    send({
      ok: false,
      error: "The workbook does not contain a readable worksheet",
    });
  } else {
    const { matrix, originRow } = sheetToMatrix(sheet);
    send({ ok: true, matrix, originRow, sheetName });
  }
} catch (error) {
  send({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
