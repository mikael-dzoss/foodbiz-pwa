import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compressImageFile } from "../utils/image-compression";

describe("compressImageFile", () => {
  const originalFileReader = globalThis.FileReader;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    // Mock FileReader
    class MockFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;

      readAsDataURL() {
        setTimeout(() => {
          this.result = "data:image/jpeg;base64,mockrawimagedata";
          this.onload?.();
        }, 10);
      }
    }
    // @ts-expect-error test mock
    globalThis.FileReader = MockFileReader;

    // Mock Image
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1600;
      naturalHeight = 1200;
      width = 1600;
      height = 1200;
      private _src = "";

      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          this.onload?.();
        }, 10);
      }
    }
    // @ts-expect-error test mock
    globalThis.Image = MockImage;

    // Mock HTMLCanvasElement.prototype.getContext & toDataURL
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );

    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,mockcompresseddata",
    );
  });

  afterEach(() => {
    globalThis.FileReader = originalFileReader;
    globalThis.Image = originalImage;
    vi.restoreAllMocks();
  });

  it("resizes and compresses an image maintaining aspect ratio", async () => {
    const file = new File(["dummycontent"], "burger.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800 });

    expect(result.dataUrl).toBe("data:image/jpeg;base64,mockcompresseddata");
    // 1600x1200 scaled to maxWidth 800 -> 800x600
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("handles images within max bounds without scaling up", async () => {
    // Modify MockImage to be smaller than max bounds
    class SmallMockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 400;
      naturalHeight = 300;
      width = 400;
      height = 300;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => this.onload?.(), 10);
      }
    }
    // @ts-expect-error test mock
    globalThis.Image = SmallMockImage;

    const file = new File(["dummycontent"], "small.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800 });

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });
});
