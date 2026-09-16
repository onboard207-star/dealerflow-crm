import { describe, expect, it } from "vitest";
import { InventoryMediaStorageError, inspectImage, R2InventoryMediaStorage } from "./r2-media-storage";

describe("inventory image verification", () => {
  it("creates browser upload URLs without an empty-payload checksum", async () => {
    const storage = new R2InventoryMediaStorage({
      accountId: "0".repeat(32),
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "dealerflow-test",
      publicBaseUrl: "https://media.example.test",
    });

    const upload = await storage.createUploadUrl({ objectKey: "synthetic/test.png", contentType: "image/png", byteSize: 68 });
    const url = new URL(upload.url);

    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
    const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders")?.split(";") ?? [];
    expect(signedHeaders).not.toContain("content-length");
    expect(signedHeaders).not.toContain("cache-control");
    expect(upload.headers).toEqual({ "content-type": "image/png" });
  });

  it("reads authoritative PNG dimensions", () => {
    const bytes = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    bytes.writeUInt32BE(1600, 16);
    bytes.writeUInt32BE(1200, 20);
    expect(inspectImage(bytes, "image/png")).toEqual({ width: 1600, height: 1200 });
  });

  it("reads JPEG SOF dimensions", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 4, 176, 6, 64, 3, 1, 0, 2, 0, 3, 0, 0, 0, 0]);
    expect(inspectImage(bytes, "image/jpeg")).toEqual({ width: 1600, height: 1200 });
  });

  it("rejects MIME spoofing and unbounded dimensions", () => {
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    png.writeUInt32BE(25000, 16);
    png.writeUInt32BE(1200, 20);
    expect(() => inspectImage(png, "image/jpeg")).toThrow(InventoryMediaStorageError);
    expect(() => inspectImage(png, "image/png")).toThrow("dimensions are invalid");
  });
});
