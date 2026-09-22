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
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    send({ ok: true, rows, sheetName });
  }
} catch (error) {
  send({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
