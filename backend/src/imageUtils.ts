import express, { type Response } from "express";

// Fonctions partagées pour les images (photo de profil, captures d'écran)

export const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3 Mo (le navigateur réduit l'image avant l'envoi)

// Lit le corps de la requête comme un fichier binaire (Buffer)
export const readImageBody = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: MAX_IMAGE_SIZE,
});

// Reconnaît le vrai type d'une image grâce à sa "signature" (ses premiers octets),
// sans se fier à l'extension du fichier ni à ce que le navigateur annonce.
export function detectImageType(file: Buffer): string | null {
  if (file.length < 12) return null;
  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) return "image/jpeg";
  if (file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (file.subarray(0, 4).toString("latin1") === "RIFF" && file.subarray(8, 12).toString("latin1") === "WEBP")
    return "image/webp";
  return null;
}

// Envoie une image au navigateur
export function sendImage(res: Response, image: { mime: string; data: Buffer }, cacheSeconds: number) {
  res.setHeader("Content-Type", image.mime);
  // L'adresse de l'image contient sa version (?v=...) : le navigateur peut la garder en cache
  res.setHeader("Cache-Control", cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "private, no-cache");
  // Autorise l'affichage dans une <img> d'un autre "origin" (en développement : le site sur :5173, l'API sur :3000)
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(image.data);
}
