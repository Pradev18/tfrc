import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCataloguePdfHtml } from "../src/lib/catalogue-pdf-html";
import type { CataloguePdfPayload } from "../src/services/catalogue-pdf.service";
import { generateQrDataUrl } from "../src/lib/catalogue-pdf-qr";

function svgData(label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#f3f6f4" width="100%" height="100%"/><rect x="70" y="50" width="260" height="200" rx="18" fill="#dfe8e2"/><text x="200" y="155" text-anchor="middle" font-family="Segoe UI, Arial" font-size="18" font-weight="700" fill="#2f6b52">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function main() {
  const titles = Array.from({ length: 12 }, (_, i) => `Sample Product ${i + 1}`);
  const products: CataloguePdfPayload["categories"][number]["products"] = titles.map(
    (title, i) => ({
      id: `p${i + 1}`,
      name: title,
      displayName: title,
      productId: String(110012700 + i),
      size: null,
      availableSizes: i % 4 === 0 ? ["S", "M", "L"] : [],
      price: 20 + i * 3,
      priceFrom: i % 5 === 0,
      currency: "QAR",
      inStock: true,
      imageUrl: svgData(`P${i + 1}`),
      whatsappUrl: "https://wa.me/97455049229",
    })
  );

  const websiteUrl = "https://example.com/pawmart";
  const whatsappUrl = "https://wa.me/97455049229";
  const [websiteQrDataUrl, whatsappQrDataUrl] = await Promise.all([
    generateQrDataUrl(websiteUrl),
    generateQrDataUrl(whatsappUrl),
  ]);

  const payload: CataloguePdfPayload = {
    catalogue: {
      id: "demo",
      name: "PawMart",
      slug: "pawmart",
      logoUrl: null,
      tagline: "Everything for your pets",
      description:
        "Food, grooming, toys and accessories — handpicked for pet lovers in Qatar.",
    },
    websiteUrl,
    whatsappUrl,
    whatsappPhone: "97455049229",
    websiteQrDataUrl,
    whatsappQrDataUrl,
    totalProducts: 24,
    listedCards: 24,
    accent: "#40916c",
    heading: "#0f2922",
    muted: "#6b8f82",
    surface: "#f7fbf9",
    cta: "#1b4332",
    categories: [
      {
        slug: "leashes-collars",
        name: "Leashes & Collars",
        productCount: 24,
        products: [
          ...products,
          ...products.map((p, i) => ({
            ...p,
            id: `q${i + 1}`,
            displayName: `${p.displayName} Pro`,
            productId: String(110012800 + i),
          })),
        ],
      },
    ],
  };

  const html = buildCataloguePdfHtml(payload, { autoPrint: false });
  const out = resolve(process.cwd(), "tmp-catalogue-pdf-preview.html");
  writeFileSync(out, html, "utf8");
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
