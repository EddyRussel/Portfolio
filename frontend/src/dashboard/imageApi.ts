import { API_URL } from "../api";

// Réduit une image dans le navigateur avant l'envoi : les photos de téléphone font
// souvent 5 Mo ou plus. Résultat : un JPEG de 1600 px maximum, quelques centaines de Ko.
export async function resizeImage(file: File, maxSize = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer l'image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion impossible."))), "image/jpeg", 0.88)
  );
}

// Envoie une image à l'API (le fichier brut, comme pour le CV)
export async function uploadImage(path: string, image: Blob): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": image.type || "image/jpeg" },
      body: image,
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifie que l'API est démarrée.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "L'envoi de l'image a échoué.");
  }
}

// Quelles images existent, avec leur version (pour l'aperçu)
export type ImageSummary = { photo: number | null; projects: Record<number, number> };
