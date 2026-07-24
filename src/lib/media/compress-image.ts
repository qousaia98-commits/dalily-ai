/**
 * Client-side image compression before upload.
 * Resizes long edge and encodes as WebP (fallback JPEG) to cut payload size.
 */

export type CompressImageOptions = {
  maxEdge?: number;
  quality?: number;
  /** Prefer webp when supported; otherwise jpeg. */
  preferWebp?: boolean;
};

export type CompressImageResult = {
  file: File;
  wasCompressed: boolean;
  originalBytes: number;
  outputBytes: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  const maxEdge = options.maxEdge ?? 1600;
  const quality = options.quality ?? 0.82;
  const preferWebp = options.preferWebp !== false;
  const originalBytes = file.size;

  // Skip tiny GIFs (animation) and already-small files.
  if (file.type === "image/gif" || originalBytes < 180_000) {
    return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
  }

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    if (scale >= 1 && originalBytes < 900_000 && file.type === "image/webp") {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }
    ctx.drawImage(img, 0, 0, width, height);

    const mime = preferWebp ? "image/webp" : "image/jpeg";
    let blob = await canvasToBlob(canvas, mime, quality);
    if (!blob || blob.size === 0) {
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
    // Always prefer the canvas output when we resized OR when the original is large.
    if (!blob) {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }
    if (blob.size >= originalBytes * 0.95 && scale >= 1 && originalBytes < 2_000_000) {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([blob], `${baseName}.${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });

    return {
      file: compressed,
      wasCompressed: true,
      originalBytes,
      outputBytes: compressed.size,
    };
  } catch {
    return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
  }
}

export function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
