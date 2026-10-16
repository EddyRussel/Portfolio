# Portfolio professionnel – Socle de départ

Stack : React (Vite) · Express · TypeScript · PostgreSQL · Redis · Docker

## Démarrage

```bash
cp .env.example .env     # puis modifier les mots de passe
docker compose up --build
```

- Frontend : http://localhost:5173
- API (santé) : http://localhost:3000/api/health
- Portfolio de démo (API) : http://localhost:3000/api/public/demo-etudiant
- PostgreSQL : localhost:5432 — Redis : localhost:6379

## Structure

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── db/init.sql          # schéma initial + données de démo
│   └── src/
│       ├── index.ts         # point d'entrée Express
│       ├── db.ts            # pool PostgreSQL
│       ├── redis.ts         # client Redis
│       └── routes/          # health, public (cache Redis), cv (à implémenter)
└── frontend/
    ├── Dockerfile
    └── src/                 # React + Router
```

## À réaliser par les étudiants

Voir le cahier des charges : authentification, CRUD du contenu, portfolio public,
**génération du CV en PDF**, tests, documentation.

## Commandes utiles

```bash
docker compose down -v                      # tout arrêter et supprimer les volumes (réinitialise la BD)
docker compose exec postgres psql -U portfolio -d portfolio
docker compose exec redis redis-cli
docker compose logs -f backend
```

> Note : `init.sql` ne s'exécute qu'à la première création du volume PostgreSQL.
> Après modification du schéma, utiliser `docker compose down -v`.
