# Choix techniques

## Génération du PDF : @react-pdf/renderer

Trois bibliothèques étaient suggérées. Comparaison :

| | puppeteer | pdfkit | **@react-pdf/renderer** ✅ |
|---|---|---|---|
| Principe | Un vrai navigateur Chrome imprime du HTML | Dessin manuel avec des coordonnées | Composants React mis en page comme en flexbox |
| Image Docker | Lourde (Chromium, ~300 Mo) et capricieuse sous Alpine | Légère | Légère (JavaScript pur) |
| Sauts de page | Automatiques | À gérer à la main | Automatiques (`wrap`, `minPresenceAhead`) |
| Effort pour 2 modèles | Moyen | Élevé | Faible |

**Choix : @react-pdf/renderer.** Les modèles s'écrivent en React, comme le frontend ; la bibliothèque gère seule la pagination, n'a pas besoin de navigateur, et garde l'image Docker légère. Deux réglages ont été nécessaires : désactiver la césure anglaise des mots (`Font.registerHyphenationCallback`) et éviter les titres seuls en bas de page (`minPresenceAhead`).

## Cache des CV (RF-26)

La clé Redis contient une **empreinte SHA-256** des données sélectionnées : `cv:<utilisateur>:<modèle>:<empreinte>`. Si une donnée change, l'empreinte change : l'ancien PDF n'est plus utilisé, sans avoir besoin de l'effacer (il expire après 24 h). Mesure : environ 80 ms pour générer, environ 5 ms depuis le cache.

## Sessions dans Redis plutôt que des JWT

Une session est un jeton aléatoire (256 bits) stocké dans Redis avec l'id de l'utilisateur, envoyé dans un cookie `httpOnly`. Contrairement à un JWT, une session Redis peut être **révoquée immédiatement** : c'est ce qui permet de déconnecter les autres appareils lors d'un changement de mot de passe, ou toutes les sessions à la suppression du compte. Le cookie `httpOnly` protège contre le vol de session par un script malveillant.

## bcryptjs plutôt que bcrypt ou argon2

`bcryptjs` est écrit en JavaScript pur : aucune compilation native, donc aucune difficulté dans l'image Docker Alpine. Coût : 12 tours.

## Routes CRUD génériques

Les expériences, formations, compétences et projets se gèrent exactement de la même façon. Une seule fonction (`createCrudRouter` dans `routes/crud.ts`) fabrique leurs routes à partir d'une configuration (table, validation Zod, colonnes de dates). Côté frontend, un seul composant (`ResourceEditor`) fait de même à partir de `fields.ts`. Principe **DRY** : moins de code, un seul endroit à corriger.

## Statistiques : Redis puis PostgreSQL

Chaque visite est comptée dans Redis (rapide, n'alourdit pas l'affichage du portfolio), puis les compteurs sont recopiés dans PostgreSQL chaque minute (persistance).

- `HINCRBY` pour les compteurs ;
- `SET ... NX EX 1800` : une personne qui revient dans les 30 minutes compte pour une seule visite ;
- **HyperLogLog** (`PFADD` / `PFCOUNT`) pour les visiteurs uniques : environ 12 Ko par jour, quel que soit le nombre de visiteurs ;
- `RENAME` atomique au moment de la recopie : aucune visite perdue pendant l'écriture ;
- Vie privée : le visiteur est identifié par une empreinte de son IP et de son navigateur, qui change chaque jour ; l'IP n'est jamais stockée. Les visites du propriétaire connecté ne sont pas comptées.

## Migrations au démarrage

`init.sql` ne s'exécute qu'à la première création de la base. Les nouvelles tables (`cv_files`, `visit_stats`) sont donc créées par `migrate.ts` au démarrage de l'API, avec `CREATE TABLE IF NOT EXISTS` : la base d'un développeur existant est mise à jour sans perdre ses données.

## Robustesse

Express 4 ne rattrape pas les erreurs des routes `async` : une seule erreur arrêtait tout le serveur. `express-async-errors` et un gestionnaire d'erreurs global renvoient désormais une réponse `500` sans arrêter l'API.

## Bug trouvé grâce aux tests

Le test des statistiques échouait au deuxième lancement. Cause : à la suppression d'un compte, ses traces de statistiques restaient dans Redis ; un nouveau compte obtenant le même slug en héritait. Correction : `purgeStats()` est appelée lors de la suppression du compte.
