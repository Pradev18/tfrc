import { describe, it, expect } from "vitest";
import { getEffectivePrice, validatePrices } from "@/lib/pricing";
import { buildWhatsAppUrl, buildWhatsAppMessage } from "@/lib/whatsapp";

describe("pricing", () => {
  it("calculates discount correctly", () => {
    const price = getEffectivePrice({ regular: 10, sale: 6, currency: "QAR" });
    expect(price.isOnSale).toBe(true);
    expect(price.discountPercent).toBe(40);
    expect(price.displayPrice).toBe(6);
  });

  it("rejects sale >= regular", () => {
    expect(() => validatePrices(10, 10)).toThrow();
    expect(() => validatePrices(10, 12)).toThrow();
  });

  it("ignores invalid sale price in effective price", () => {
    const price = getEffectivePrice({ regular: 10, sale: 12 });
    expect(price.isOnSale).toBe(false);
    expect(price.displayPrice).toBe(10);
  });
});

describe("whatsapp", () => {
  it("generates correct wa.me URL", () => {
    const url = buildWhatsAppUrl("97455049229", "Hello");
    expect(url).toBe("https://wa.me/97455049229?text=Hello");
  });

  it("builds product message with price", () => {
    const msg = buildWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi PawMart Qatar 👋",
        productTemplate: "Product: {{name}} {{productId}}\nPrice: {{price}}",
      },
      {
        name: "Pet Comb",
        productId: "110005860",
        regularPrice: 10,
        salePrice: 6,
        slug: "pet-comb-110005860",
      }
    );
    expect(msg).toContain("Pet Comb");
    expect(msg).toContain("110005860");
    expect(msg).toContain("QAR 6.00");
  });
});
