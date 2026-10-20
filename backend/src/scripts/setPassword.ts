// Petit outil pour définir le mot de passe d'un compte existant
// (utile pour le compte créé par init.sql, qui a un mot de passe factice).
//
// Utilisation :
//   docker compose exec backend npx tsx src/scripts/setPassword.ts courriel@exemple.com "MonMotDePasse"
import bcrypt from "bcryptjs";
import { pool } from "../db.js";

const [email, password] = process.argv.slice(2);

if (!email || !password || password.length < 8) {
    console.error('Utilisation : npx tsx src/scripts/setPassword.ts <courriel> "<mot de passe de 8 caractères ou plus>"');
    process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const { rowCount } = await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [
    hash,
    email.toLowerCase(),
]);

console.log(rowCount ? `Mot de passe mis à jour pour ${email}.` : `Aucun compte trouvé pour ${email}.`);
await pool.end();