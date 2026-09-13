import QRCode from "qrcode";

/** Generate a scannable QR as a PNG data URI. */
export async function generateQrDataUrl(value: string, size = 280): Promise<string> {
  const text = value.trim();
  if (!text) {
    return emptyQrPlaceholder(size);
  }

  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: {
        dark: "#0f2922",
        light: "#ffffff",
      },
    });
  } catch {
    return emptyQrPlaceholder(size);
  }
}

function emptyQrPlaceholder(size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#f3f6f4"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="#6b746e">QR</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
