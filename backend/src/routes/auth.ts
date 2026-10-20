import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { createSession, destroySession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../session.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

// Plus ce nombre est grand, plus le hachage est lent (donc dur à attaquer)
const BCRYPT_ROUNDS = 12;

// ---------- Validation des données reçues (Zod) ----------
const registerSchema = z.object({
    full_name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(150),
    email: z.string().trim().toLowerCase().email("Adresse courriel invalide."),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(100),
});

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Adresse courriel invalide."),
    password: z.string().min(1, "Le mot de passe est obligatoire."),
});

// ---------- Fonctions utilitaires ----------

// "Éddy Russel Ngoue" -> "eddy-russel-ngoue"
function slugify(text: string): string {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // enlève les accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

// Trouve un slug libre : eddy-ngoue, sinon eddy-ngoue-2, eddy-ngoue-3...
async function uniqueSlug(base: string): Promise<string> {
    const root = base || "portfolio";
    let slug = root;
    for (let n = 2; ; n++) {
        const { rowCount } = await pool.query("SELECT 1 FROM users WHERE slug = $1", [slug]);
        if (rowCount === 0) return slug;
        slug = `${root}-${n}`;
    }
}

// Crée la session et l'envoie au navigateur dans un cookie "httpOnly"
// (httpOnly = le JavaScript de la page ne peut pas le lire : protège contre le vol de session)
async function startSession(res: Response, userId: number) {
    const token = await createSession(userId);
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production", // HTTPS obligatoire en production
        maxAge: SESSION_TTL_SECONDS * 1000,
    });
}

// ---------- POST /api/auth/register : inscription ----------
authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { full_name, email, password } = parsed.data;

    const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
        return res.status(409).json({ error: "Un compte existe déjà avec cette adresse courriel." });
    }

    // On ne stocke JAMAIS le mot de passe lui-même, seulement son hachage
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const slug = await uniqueSlug(slugify(full_name));

    // Transaction : l'utilisateur ET son profil sont créés ensemble, ou pas du tout
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            "INSERT INTO users (email, password_hash, slug) VALUES ($1, $2, $3) RETURNING id",
            [email, passwordHash, slug]
        );
        const userId: number = rows[0].id;
        await client.query("INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)", [userId, full_name]);
        await client.query("COMMIT");

        await startSession(res, userId);
        res.status(201).json({ user: { id: userId, email, slug, full_name } });
    } catch (err) {
        await client.query("ROLLBACK"); // on annule tout ce qui a été fait dans la transaction
        console.error(err);
        res.status(500).json({ error: "L'inscription a échoué. Réessayez plus tard." });
    } finally {
        client.release();
    }
});

// ---------- POST /api/auth/login : connexion ----------
authRouter.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const { rows } = await pool.query(
        `SELECT u.id, u.email, u.slug, u.password_hash, p.full_name
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.email = $1`,
        [email]
    );
    const user = rows[0];

    // Même message que l'email existe ou non : on ne révèle pas quels comptes existent
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) {
        return res.status(401).json({ error: "Courriel ou mot de passe incorrect." });
    }

    await startSession(res, user.id);
    res.json({ user: { id: user.id, email: user.email, slug: user.slug, full_name: user.full_name } });
});

// ---------- POST /api/auth/logout : déconnexion ----------
authRouter.post("/logout", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await destroySession(token);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
});

// ---------- GET /api/auth/me : qui suis-je ? (route protégée) ----------
authRouter.get("/me", requireAuth, async (_req, res) => {
    const { rows } = await pool.query(
        `SELECT u.id, u.email, u.slug, u.is_public, p.full_name
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
        [res.locals.userId]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Compte introuvable." });
    res.json({ user: rows[0] });
});
