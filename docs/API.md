# Documentation de l'API

- Adresse de base : `http://localhost:3000`
- Format : JSON (sauf les PDF)
- Authentification : cookie `session` (`httpOnly`), créé par `/api/auth/login` ou `/api/auth/register`. Côté navigateur, chaque appel utilise `credentials: "include"`.
- Erreurs : toujours au format `{ "error": "message lisible" }`

| Code | Signification |
|---|---|
| 200 / 201 / 204 | Succès (201 = créé, 204 = rien à renvoyer) |
| 400 | Données invalides (message de validation Zod) |
| 401 | Non connecté, ou mot de passe incorrect |
| 404 | Introuvable (ou appartient à un autre utilisateur) |
| 409 | Conflit (courriel déjà utilisé) |
| 413 | Fichier trop volumineux |
| 500 | Erreur interne |

🔒 = route protégée (connexion obligatoire)

---

## Santé

### `GET /api/health`
Vérifie que PostgreSQL et Redis répondent.
```json
{ "status": "ok", "postgres": "up", "redis": "up" }
```

---

## Authentification et compte

### `POST /api/auth/register`
Crée un compte et ouvre une session. Le slug est généré à partir du nom (sans accents, unique). Le portfolio est **privé** au départ.
```json
{ "full_name": "Eddy Russel Ngoue", "email": "eddy@exemple.com", "password": "8 caractères minimum" }
```
Réponse `201` : `{ "user": { "id": 1, "email": "...", "slug": "eddy-russel-ngoue", "is_public": false, "full_name": "..." } }`
Erreurs : `400` (validation), `409` (courriel déjà utilisé).

### `POST /api/auth/login`
```json
{ "email": "eddy@exemple.com", "password": "..." }
```
Réponse `200` : `{ "user": { ... } }`. Erreur `401` : « Courriel ou mot de passe incorrect. » (même message que le compte existe ou non).

### `POST /api/auth/logout`
Ferme la session. Réponse : `{ "ok": true }`.

### `GET /api/auth/me` 🔒
L'utilisateur connecté : `{ "user": { "id", "email", "slug", "is_public", "full_name" } }`.

### `PUT /api/account/password` 🔒 (RF-03)
```json
{ "current_password": "...", "new_password": "8 caractères minimum" }
```
Ferme toutes les **autres** sessions. Erreur `401` si l'ancien mot de passe est faux.

### `DELETE /api/account` 🔒 (RF-04)
```json
{ "password": "..." }
```
Supprime le compte et **toutes** ses données (PostgreSQL en cascade, caches, sessions et statistiques dans Redis). Réponse `204`.

---

## Profil

### `GET /api/profile` 🔒
Profil complet, y compris le téléphone (privé) : `email`, `slug`, `is_public`, `full_name`, `headline`, `bio`, `phone`, `city`, `linkedin_url`, `github_url`, `website_url`, `photo_url`.

### `PUT /api/profile` 🔒
Mêmes champs (sauf `email`, `slug`, `is_public`). `full_name` obligatoire ; un champ vide (`""`) devient `null` ; les liens doivent commencer par `http(s)://`.

### `PATCH /api/profile/visibility` 🔒 (RF-11)
```json
{ "is_public": true }
```

---

## Contenu du portfolio (CRUD)

Les quatre ressources ont exactement les mêmes routes (fabriquées par `routes/crud.ts`) :

| Ressource | Adresse |
|---|---|
| Expériences | `/api/experiences` |
| Formations | `/api/education` |
| Compétences | `/api/skills` |
| Projets | `/api/projects` |

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/` 🔒 | Liste de mes éléments, dans l'ordre d'affichage |
| `POST` | `/` 🔒 | Ajouter (placé à la fin) → `201` + l'élément |
| `PUT` | `/:id` 🔒 | Modifier → l'élément modifié |
| `DELETE` | `/:id` 🔒 | Supprimer → `204` |
| `PUT` | `/reorder` 🔒 | Nouvel ordre : `{ "ids": [3, 1, 2] }` |

Un élément d'un autre utilisateur renvoie toujours `404`. Chaque modification vide le cache du portfolio public.

### Champs

Les dates sont au format `"AAAA-MM"` ; `end_date` vide ou `null` = « en cours ».

**Expérience**
```json
{ "position": "Développeur", "company": "Entreprise", "start_date": "2026-05", "end_date": null, "description": "..." }
```
**Formation**
```json
{ "degree": "AEC ...", "school": "Collège LaSalle", "start_date": "2025-01", "end_date": null, "description": "..." }
```
**Compétence** : `category` ∈ `langage`, `technologie`, `outil`, `langue`, `soft skill` ; `level` de 1 à 5 ou vide.
```json
{ "name": "TypeScript", "category": "langage", "level": 4 }
```
**Projet**
```json
{ "title": "...", "description": "...", "technologies": ["React", "Express"], "repo_url": "https://github.com/...", "demo_url": null, "image_url": null }
```

---

## Génération du CV

### `GET /api/cv/data` 🔒
Toutes les données du CV (profil, téléphone compris, et listes complètes), pour construire l'écran de sélection.

### `POST /api/cv/preview` 🔒 (RF-23) et `POST /api/cv/download` 🔒 (RF-20)
Renvoient le PDF (`Content-Type: application/pdf`) ; `preview` en `inline`, `download` en `attachment` avec le nom `CV_Prenom_Nom.pdf` (RF-25).
```json
{
  "template": "modern",
  "sections": { "bio": true, "experiences": true, "education": true, "skills": true, "projects": false },
  "exclude": { "experiences": [3], "education": [], "skills": [12, 15], "projects": [] }
}
```
- `template` : `classic` ou `modern` (RF-21) ;
- `sections` : sections à inclure ; `exclude` : éléments à retirer (RF-22) ;
- En-tête `X-CV-Cache` : `HIT` si le PDF vient du cache Redis, `MISS` sinon (RF-26).

---

## CV pour les visiteurs

### `GET /api/cv-file` 🔒
Infos du PDF téléversé (`file_name`, `size_bytes`, `is_public`, `uploaded_at`) ou `null`.

### `PUT /api/cv-file` 🔒
Téléverse ou remplace le PDF. Corps : le fichier brut, `Content-Type: application/pdf`, nom dans l'en-tête `X-File-Name` (encodé avec `encodeURIComponent`). 5 Mo maximum ; le fichier doit commencer par `%PDF-`.

### `PATCH /api/cv-file` 🔒
Autoriser ou non le téléchargement : `{ "is_public": false }`.

### `DELETE /api/cv-file` 🔒
Supprime le PDF. Réponse `204`.

---

## Statistiques

### `GET /api/stats` 🔒
30 derniers jours, un point par jour (même sans visite) :
```json
{
  "days": [{ "day": "2026-10-23", "views": 3, "unique_visitors": 2, "cv_downloads": 1 }],
  "totals": { "views": 201, "unique_visitors": 174, "cv_downloads": 54 }
}
```

---

## Routes publiques (sans connexion)

### `GET /api/public/:slug`
Le portfolio public complet, ou `404` s'il est privé ou inexistant. Ne contient jamais le téléphone.
Champs : `slug`, `email`, `full_name`, `headline`, `bio`, `city`, les liens, `cv_available`, `experiences`, `education`, `skills`, `projects`, et `source` (`"cache"` ou `"db"`, pour observer le cache Redis).
Chaque appel compte une visite dans les statistiques (sauf celles du propriétaire connecté).

### `GET /api/public/:slug/cv`
Télécharge le CV publié par l'étudiant, si le portfolio est public **et** le CV autorisé ; sinon `404`.
