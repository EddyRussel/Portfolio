import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { invalidatePortfolio } from "../cache.js";

// ---------------------------------------------------------------------------
// "Fabrique" de routes CRUD.
// Expériences, formations, compétences et projets fonctionnent exactement pareil :
// lister, ajouter, modifier, supprimer, réordonner. Au lieu d'écrire 4 fois le
// même code, cette fonction fabrique un Router à partir d'une petite configuration.
// ---------------------------------------------------------------------------
type CrudConfig = {
  table: string; // nom de la table PostgreSQL
  schema: z.ZodObject<z.ZodRawShape>; // règles de validation (Zod)
  dateColumns?: string[]; // colonnes DATE échangées au format "AAAA-MM"
};

export function createCrudRouter({
  table,
  schema,
  dateColumns = [],
}: CrudConfig) {
  const router = Router();
  router.use(requireAuth);

  // Vérifie que le :id de l'adresse est bien un nombre entier
  router.param("id", (_req, res, next, value) => {
    if (!/^\d+$/.test(value))
      return res.status(400).json({ error: "Identifiant invalide." });
    next();
  });

  // Les noms de colonnes viennent de NOTRE schéma (jamais de l'utilisateur) :
  // on peut donc les écrire dans le SQL sans risque. Les VALEURS, elles,
  // passent toujours par des paramètres $1, $2... (protection contre l'injection SQL).
  const columns = Object.keys(schema.shape);
  const selectList = [
    "id",
    ...columns.map((c) =>
      dateColumns.includes(c) ? `to_char(${c}, 'YYYY-MM') AS ${c}` : c,
    ),
    "sort_order",
  ].join(", ");

  // "2026-05" -> "2026-05-01" pour PostgreSQL
  const toDb = (column: string, value: unknown) =>
    dateColumns.includes(column) && typeof value === "string"
      ? `${value}-01`
      : (value ?? null);

  // GET / : tous mes éléments, dans l'ordre choisi
  router.get("/", async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT ${selectList} FROM ${table} WHERE user_id = $1 ORDER BY sort_order, id`,
      [res.locals.userId],
    );
    res.json(rows);
  });

  // POST / : ajouter un élément (il se place à la fin de la liste)
  router.post("/", async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });

    const data = parsed.data as Record<string, unknown>;
    const values = columns.map((c) => toDb(c, data[c]));
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(", ");

    const { rows } = await pool.query(
      `INSERT INTO ${table} (user_id, ${columns.join(", ")}, sort_order)
       VALUES ($1, ${placeholders},
               (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${table} WHERE user_id = $1))
       RETURNING ${selectList}`,
      [res.locals.userId, ...values],
    );
    await invalidatePortfolio(res.locals.userId);
    res.status(201).json(rows[0]);
  });

  // PUT /reorder : nouvel ordre d'affichage, ex. { "ids": [3, 1, 2] }
  // (déclarée AVANT "/:id", sinon Express croirait que "reorder" est un id)
  router.put("/reorder", async (req, res) => {
    const parsed = z
      .object({ ids: z.array(z.number().int()) })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Liste d'identifiants invalide." });

    // unnest + WITH ORDINALITY : la position dans la liste devient le nouveau sort_order
    await pool.query(
      `UPDATE ${table} t SET sort_order = o.position
         FROM unnest($2::int[]) WITH ORDINALITY AS o(id, position)
        WHERE t.id = o.id AND t.user_id = $1`,
      [res.locals.userId, parsed.data.ids],
    );
    await invalidatePortfolio(res.locals.userId);
    res.json({ ok: true });
  });

  // PUT /:id : modifier un de MES éléments
  router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.issues[0].message });

    const data = parsed.data as Record<string, unknown>;
    const assignments = columns.map((c, i) => `${c} = $${i + 3}`).join(", ");

    // "AND user_id = $2" : impossible de modifier l'élément de quelqu'un d'autre
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${assignments} WHERE id = $1 AND user_id = $2 RETURNING ${selectList}`,
      [id, res.locals.userId, ...columns.map((c) => toDb(c, data[c]))],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Élément introuvable." });

    await invalidatePortfolio(res.locals.userId);
    res.json(rows[0]);
  });

  // DELETE /:id : supprimer un de MES éléments
  router.delete("/:id", async (req, res) => {
    const { rowCount } = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 AND user_id = $2`,
      [Number(req.params.id), res.locals.userId],
    );
    if (!rowCount)
      return res.status(404).json({ error: "Élément introuvable." });

    await invalidatePortfolio(res.locals.userId);
    res.status(204).end(); // 204 = "c'est fait, rien à renvoyer"
  });

  return router;
}
