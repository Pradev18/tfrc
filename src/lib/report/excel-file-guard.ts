/** Detect real Excel binaries before xlsx tries to parse garbage / HTML renames. */

export function detectExcelKind(buffer: Buffer): "xlsx" | "xls" | null {
  if (buffer.length < 8) return null;
  // ZIP container used by .xlsx / .xlsm
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "xlsx";
  // OLE Compound File used by legacy .xls
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "xls";
  }
  return null;
}

export function assertExcelBuffer(buffer: Buffer, fileName: string): "xlsx" | "xls" {
  const kind = detectExcelKind(buffer);
  if (kind) return kind;

  const head = buffer.subarray(0, 64).toString("utf8").toLowerCase();
  if (head.includes("<!doctype") || head.includes("<html")) {
    throw new Error(
      `“${fileName}” is an HTML page saved with an Excel extension, not a real workbook. Download the original .xlsx / .xls from Office Forms and upload that.`
    );
  }
  if (head.startsWith("%pdf")) {
    throw new Error(
      `“${fileName}” is a PDF, not an Excel workbook. Upload the Office Forms .xlsx / .xls file.`
    );
  }
  throw new Error(
    `“${fileName}” is not a valid Excel workbook (expected .xlsx or .xls). Re-save it from Excel as .xlsx and try again.`
  );
}

export function explainExcelParseFailure(error: unknown, fileName: string): Error {
  const raw = error instanceof Error ? error.message : String(error || "Unknown parse error");
  const lower = raw.toLowerCase();

  if (
    lower.includes("password") ||
    lower.includes("encrypted") ||
    lower.includes("cfb")
  ) {
    return new Error(
      `Excel problem in “${fileName}”: the workbook is password-protected or encrypted. Remove the password in Excel, save, and upload again.`
    );
  }
  if (lower.includes("corrupt") || lower.includes("invalid") || lower.includes("end of data")) {
    return new Error(
      `Excel problem in “${fileName}”: the file looks damaged or incomplete. Re-export / re-save the workbook as .xlsx and upload again. (${raw})`
    );
  }
  if (raw.startsWith("Excel problem") || raw.startsWith("Could not identify") || raw.startsWith("Item inventory")) {
    return error instanceof Error ? error : new Error(raw);
  }
  return new Error(`Excel problem in “${fileName}”: ${raw}`);
}
