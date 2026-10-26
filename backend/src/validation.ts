import { z } from "zod";

// Règles de validation réutilisées par plusieurs routes.

// Un champ texte facultatif : "" (champ vidé dans le formulaire) devient null
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional()
  );

// Une URL facultative (doit commencer par http:// ou https://)
export const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().url("Lien invalide : il doit commencer par https://").max(500).nullable().optional()
);

// Un mois au format "2026-05" (celui d'un <input type="month">)
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Date invalide (format attendu : AAAA-MM).");
export const optionalMonth = z.preprocess((v) => (v === "" ? null : v), month.nullable().optional());

// Une liste de petits textes (ex. technologies, passions, réalisations)
export const textList = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength, `Chaque élément : ${maxLength} caractères au maximum.`))
    .max(maxItems, `${maxItems} éléments au maximum.`)
    .default([]);
