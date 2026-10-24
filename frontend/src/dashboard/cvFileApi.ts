import { API_URL } from "../api";

// Fonctions partagées pour le "CV pour les visiteurs"
// (utilisées par CvFileManager et par le bouton "Publier ce CV" de CvBuilder)

export type CvFileInfo = {
  file_name: string;
  size_bytes: number;
  is_public: boolean;
  uploaded_at: string;
} | null;

// Envoie un PDF à l'API (utilisé ici et par le bouton "Publier ce CV" du générateur)
export async function uploadCvFile(
  file: Blob,
  fileName: string,
): Promise<CvFileInfo> {
  const response = await fetch(`${API_URL}/api/cv-file`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent(fileName), // les en-têtes HTTP n'acceptent pas les accents
    },
    body: file, // le fichier tel quel, sans transformation
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Le téléversement a échoué.");
  return data;
}
