import { describe, it, expect } from "vitest";
import { getEffectivePrice, validatePrices } from "@/lib/pricing";
import {
  buildWhatsAppUrl,
  buildWhatsAppMessage,
  buildCartWhatsAppMessage,
  buildCartWhatsAppCheckoutUrl,
} from "@/lib/whatsapp";
import {
  buildWhatsAppCatalogProductUrl,
  buildWhatsAppCatalogStoreUrl,
} from "@/lib/whatsapp-catalog";
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
        defaultGreeting: "Hi PawMart Qatar",
        productTemplate: "ignored",
      },
      {
        name: "Pet Comb",
        productId: "110005860",
        regularPrice: 10,
        salePrice: 6,
        slug: "pet-comb-110005860",
        environmentSlug: "pawmart",
      },
      "https://example.com"
    );
    expect(msg).toContain("Hi PawMart Qatar");
    expect(msg).toContain("Pet Comb");
    expect(msg).toContain("Ref: 110005860");
    expect(msg).toContain("QAR 6.00");
    expect(msg).toContain("Link: https://example.com/pawmart/product/pet-comb-110005860");
    expect(msg).not.toContain("wa.me/p/");
  });

  it("builds cart message with all products", () => {
    const msg = buildCartWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi TFRC",
        productTemplate: "ignored",
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 10,
          slug: "pet-comb",
          displayPrice: 6,
          currency: "QAR",
          environmentSlug: "pawmart",
        },
        {
          name: "Dog Leash",
          productId: "110005861",
          regularPrice: 25,
          slug: "dog-leash",
          displayPrice: 25,
          currency: "QAR",
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(msg).toContain("2 items");
    expect(msg).toContain("1. Pet Comb");
    expect(msg).toContain("2. Dog Leash");
    expect(msg).toContain("Order total: QAR 31.00");
    expect(msg).toContain("Ref: 110005860");
    expect(msg).toContain("Link: https://example.com/pawmart/product/pet-comb");
    expect(msg).toContain("Link: https://example.com/pawmart/product/dog-leash");
    expect(msg).not.toContain("WhatsApp Catalog");
  });

  it("builds correct links for hardware and household catalogues", () => {
    const msg = buildCartWhatsAppMessage(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi TFRC",
        productTemplate: "",
      },
      [
        {
          name: "Drill Set",
          productId: "220001",
          regularPrice: 120,
          slug: "drill-set",
          displayPrice: 120,
          currency: "QAR",
          environmentSlug: "hardware",
          environmentName: "Pro Tools",
        },
        {
          name: "Kitchen Mixer",
          productId: "330001",
          regularPrice: 85,
          slug: "kitchen-mixer",
          displayPrice: 85,
          currency: "QAR",
          environmentSlug: "household",
          environmentName: "Kitchen & Home",
        },
      ],
      "https://shop.example.com"
    );
    expect(msg).toContain("Pro Tools");
    expect(msg).toContain("Kitchen & Home");
    expect(msg).toContain("Link: https://shop.example.com/hardware/product/drill-set");
    expect(msg).toContain("Link: https://shop.example.com/household/product/kitchen-mixer");
  });

  it("builds catalog product and store URLs", () => {
    expect(buildWhatsAppCatalogProductUrl("97455049229", "110005860")).toBe(
      "https://wa.me/p/110005860/97455049229"
    );
    expect(buildWhatsAppCatalogStoreUrl("97455049229")).toBe(
      "https://wa.me/c/97455049229"
    );
  });

  it("single-item cart sends order message with product link", () => {
    const url = buildCartWhatsAppCheckoutUrl(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi",
        productTemplate: "{{name}}",
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 6,
          slug: "pet-comb",
          displayPrice: 6,
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(url).toContain("https://wa.me/97455049229?text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Pet Comb");
    expect(decoded).toContain("Link: https://example.com/pawmart/product/pet-comb");
  });

  it("multi-item cart sends plain order message with links", () => {
    const url = buildCartWhatsAppCheckoutUrl(
      {
        phoneNumber: "97455049229",
        defaultGreeting: "Hi",
        productTemplate: "{{name}}",
      },
      [
        {
          name: "Pet Comb",
          productId: "110005860",
          regularPrice: 6,
          slug: "pet-comb",
          displayPrice: 6,
          environmentSlug: "pawmart",
        },
        {
          name: "Dog Leash",
          productId: "110005861",
          regularPrice: 25,
          slug: "dog-leash",
          displayPrice: 25,
          environmentSlug: "pawmart",
        },
      ],
      "https://example.com"
    );
    expect(url).toContain("https://wa.me/97455049229?text=");
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Pet Comb");
    expect(decoded).toContain("Dog Leash");
    expect(decoded).toContain("Order total");
    expect(decoded).toContain("Link: https://example.com/pawmart/product/pet-comb");
    expect(decoded).not.toContain("wa.me/p/");
  });
});