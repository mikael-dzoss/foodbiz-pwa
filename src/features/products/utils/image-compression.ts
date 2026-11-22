export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Resizes and compresses an image file in the browser using HTML Canvas.
 * Keeps aspect ratio within maxWidth x maxHeight (default 800x800).
 * Outputs a JPEG data URL compressed to the requested quality (default 0.8).
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<CompressedImageResult> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.8 } = options;

  if (typeof window === "undefined" || typeof FileReader === "undefined") {
    throw new Error("Image compression is only supported in browser environments.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Failed to read image file."));
    };

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error("Failed to decode image file."));
      };

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          reject(new Error("Invalid image dimensions."));
          return;
        }

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas 2D context."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        const base64Part = dataUrl.split(",")[1] ?? "";
        const sizeBytes = Math.round((base64Part.length * 3) / 4);

        resolve({
          dataUrl,
          width,
          height,
          sizeBytes,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
