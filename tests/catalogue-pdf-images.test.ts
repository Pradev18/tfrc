import { afterEach, describe, expect, it, vi } from "vitest";
import { embedCatalogueImages } from "../src/lib/catalogue-pdf-images";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalogue PDF image acquisition", () => {
  it("retries a temporary image-server failure and normalises the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(TINY_PNG, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const url = `https://images.example.test/retry-${Date.now()}.png`;

    const result = await embedCatalogueImages([url]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.failures.size).toBe(0);
    expect(result.embedded.get(url)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("reports a permanent missing image instead of inventing a PDF placeholder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("missing", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const url = `https://images.example.test/missing-${Date.now()}.jpg`;

    const result = await embedCatalogueImages([url]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.embedded.has(url)).toBe(false);
    expect(result.failures.get(url)).toContain("HTTP 404");
  });

  it("reuses a validated image across duplicate products and repeated generations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(TINY_PNG, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const url = `https://images.example.test/shared-${Date.now()}.png`;

    const result = await embedCatalogueImages([url, url, url]);
    const repeated = await embedCatalogueImages([url]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.embedded.has(url)).toBe(true);
    expect(repeated.embedded.get(url)).toBe(result.embedded.get(url));
    expect(result.failures.size).toBe(0);
  });
});
