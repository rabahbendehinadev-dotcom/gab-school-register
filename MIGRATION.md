# GAB System — Guide de migration vers Dokploy

## Vue d'ensemble

Ce document explique comment déployer le système GAB sur Dokploy à partir du dépôt GitHub.  
Le serveur est buildé dans un container Docker multi-étape. PostgreSQL et les fichiers uploadés sont **persistants et extérieurs au container**.

---

## 1. Variables d'environnement requises

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | URL de connexion PostgreSQL externe (ex: `postgres://user:pass@host:5432/dbname`) |
| `SESSION_SECRET` | ✅ | Chaîne secrète longue et aléatoire pour les cookies de session |
| `PORT` | ✅ | Port sur lequel le serveur écoute (ex: `3000`) |
| `NODE_ENV` | ✅ | `production` |
| `UPLOADS_DIR` | ✅ | Chemin vers le dossier d'uploads **monté en Volume** (ex: `/app/uploads`) |

### Exemple de configuration dans Dokploy

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://gabuser:motdepasse@postgres-service:5432/gabschool
SESSION_SECRET=une_chaine_tres_longue_et_aleatoire_ici_changez_moi
UPLOADS_DIR=/app/uploads
```

---

## 2. Volume Docker — Fichiers uploadés (CRITIQUE)

> ⚠️ **Sans ce Volume, toutes les images disparaissent à chaque rebuild ou redémarrage.**

### Dans Dokploy

1. Dans la configuration du service, ajouter un **Volume persistant** :
   - **Container path** : `/app/uploads`
   - **Host path** ou volume nommé Dokploy (selon votre configuration)

2. La structure du dossier sera automatiquement créée au démarrage :
   ```
   /app/uploads/
   ├── gallery/     ← Images de la galerie publique
   └── receipts/    ← Reçus de paiement des étudiants
   ```

### Vérification après démarrage

```bash
# Dans le container
ls /app/uploads/gallery
ls /app/uploads/receipts
```

---

## 3. Base de données PostgreSQL

- PostgreSQL **doit être un service séparé** dans Dokploy — jamais dans le même container.
- Le serveur applique automatiquement les migrations au démarrage via `CREATE TABLE IF NOT EXISTS` et `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — **les données existantes ne sont jamais supprimées**.
- Le premier démarrage crée un compte admin par défaut si aucun n'existe : `admin / admin123` — **changez ce mot de passe immédiatement**.

### Backup de la base de données

```bash
# Exporter (depuis la machine hôte ou un container utilitaire)
pg_dump $DATABASE_URL > backups/gabschool_$(date +%Y%m%d_%H%M%S).dump

# Restaurer
psql $DATABASE_URL < backups/gabschool_20240101_120000.dump
```

> Ne committez jamais les fichiers `.dump` ou `.sql` dans Git.

---

## 4. Build et déploiement

### Dans Dokploy

1. Connectez votre dépôt GitHub.
2. Branch de production : `main`.
3. Dockerfile : `Dockerfile` (à la racine).
4. Port : `3000`.
5. Volume : `/app/uploads` → volume persistant.
6. Variables d'environnement : voir section 1.

### Localement (test avant déploiement)

```bash
# Build et démarrage avec Docker Compose
docker compose up --build

# L'application sera disponible sur http://localhost:3000
# Login : admin / admin123
```

---

## 5. Migration des fichiers depuis Replit

Les images uploadées sur Replit étaient stockées dans Replit Object Storage (Google Cloud Storage). Pour les migrer :

### Option A — Depuis le dossier uploads local

Si des fichiers existent dans `artifacts/api-server/uploads/` :

```bash
# Copier vers le volume du serveur de production
scp -r artifacts/api-server/uploads/* user@serveur:/chemin/vers/volume/uploads/gallery/
```

### Option B — Réuploader manuellement

Si les images étaient uniquement dans Replit GCS, elles doivent être réuploadées depuis l'interface d'administration.  
Les URLs des images dans la base de données devront être mises à jour : 
- Ancien format (Replit GCS) : `/api/gallery/image/gallery/uuid.jpg`
- Nouveau format (local) : `/api/gallery/image/gallery/uuid.jpg` ← **même format, compatible**

---

## 6. Fichiers modifiés dans cette migration

| Fichier | Changement |
|---|---|
| `artifacts/api-server/src/lib/localFileStorage.ts` | NOUVEAU — Utilitaire de stockage local sur disque |
| `artifacts/api-server/src/routes/gallery.ts` | Remplacé GCS par stockage disque local |
| `artifacts/api-server/src/routes/students.ts` | Reçus sauvegardés sur disque au lieu de GCS |
| `artifacts/api-server/src/routes/storage.ts` | Reçus servis depuis le disque ; routes GCS désactivées proprement |
| `artifacts/api-server/src/app.ts` | Ajout création automatique des dossiers uploads |
| `Dockerfile` | NOUVEAU — Build multi-étape production |
| `docker-compose.yml` | NOUVEAU — Pour tests locaux |
| `.dockerignore` | NOUVEAU |
| `.gitignore` | Mis à jour (uploads, .env, backups, etc.) |

---

## 7. Ce qui n'a PAS changé

- Logique métier, UI, schéma de base de données — inchangés.
- Format des URLs des images : `/api/gallery/image/gallery/uuid.jpg` — compatible avec les données existantes.
- Format des URLs des reçus : `/api/storage/receipts/uuid` — compatible.
- Toutes les fonctionnalités (pipeline, étudiants, groupes, personnel, tâches, checklists, etc.) — inchangées.
