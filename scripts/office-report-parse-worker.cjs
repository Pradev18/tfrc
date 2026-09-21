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
    dense: false,
  });

  const sheets = {};
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    sheets[name] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });
  }

  send({ ok: true, sheets });
} catch (error) {
  send({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
