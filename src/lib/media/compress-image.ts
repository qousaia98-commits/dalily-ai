/**
 * Client-side image compression before upload.
 * Resizes long edge and encodes as WebP (fallback JPEG) to cut payload size.
 */

export type CompressImageOptions = {
  maxEdge?: number;
  quality?: number;
  /** Prefer webp when supported; otherwise jpeg. */
  preferWebp?: boolean;
  /** Always rewrite to canvas output (even for small files). */
  force?: boolean;
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

function toFile(blob: Blob, baseName: string, mime: string): File {
  const ext = mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName}.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  });
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  const maxEdge = options.maxEdge ?? 1600;
  const quality = options.quality ?? 0.82;
  const preferWebp = options.preferWebp !== false;
  const force = options.force === true;
  const originalBytes = file.size;

  // Skip tiny GIFs (animation) and already-small files — unless forced.
  if (!force && (file.type === "image/gif" || originalBytes < 180_000)) {
    return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
  }

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    if (
      !force &&
      scale >= 1 &&
      originalBytes < 900_000 &&
      file.type === "image/webp"
    ) {
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
    if (!blob) {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }
    if (
      !force &&
      blob.size >= originalBytes * 0.95 &&
      scale >= 1 &&
      originalBytes < 2_000_000
    ) {
      return { file, wasCompressed: false, originalBytes, outputBytes: originalBytes };
    }

    const outMime = blob.type || (preferWebp ? "image/webp" : "image/jpeg");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = toFile(
      blob,
      baseName,
      outMime === "image/webp" ? "image/webp" : "image/jpeg",
    );

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

const ALLOWED_OUTPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Verification uploads must always fit under the Server Action body limit.
 * Produces a JPEG under `maxBytes` (default 1.5MB).
 */
export async function prepareVerificationImage(
  file: File,
  maxBytes = 1_500_000,
): Promise<CompressImageResult> {
  const originalBytes = file.size;
  const attempts: Array<{ maxEdge: number; quality: number }> = [
    { maxEdge: 1600, quality: 0.82 },
    { maxEdge: 1400, quality: 0.75 },
    { maxEdge: 1200, quality: 0.68 },
    { maxEdge: 1024, quality: 0.6 },
    { maxEdge: 900, quality: 0.55 },
    { maxEdge: 720, quality: 0.5 },
  ];

  let last: CompressImageResult = {
    file,
    wasCompressed: false,
    originalBytes,
    outputBytes: originalBytes,
  };

  for (const attempt of attempts) {
    last = await compressImageFile(file, {
      maxEdge: attempt.maxEdge,
      quality: attempt.quality,
      preferWebp: false,
      force: true,
    });

    // Ensure MIME is always jpeg for bucket allow-list.
    if (!last.file.type || last.file.type === "image/jpg") {
      last = {
        ...last,
        file: new File([last.file], last.file.name.replace(/\.[^.]+$/, "") + ".jpg", {
          type: "image/jpeg",
          lastModified: Date.now(),
        }),
      };
    }

    if (last.file.size <= maxBytes && ALLOWED_OUTPUT_TYPES.has(last.file.type)) {
      return last;
    }
  }

  return last;
}

export function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
