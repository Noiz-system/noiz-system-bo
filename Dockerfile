# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# noiz-system-bo — Strapi 5
#
# Image Debian slim plutôt qu'Alpine : `better-sqlite3` est une dépendance de
# production et ne publie pas de binaire précompilé pour musl. Sur Alpine il
# faudrait embarquer python3/make/g++ pour le compiler, ce qui coûte plus que
# l'écart de taille entre les deux bases.
# ─────────────────────────────────────────────────────────────────────────────
ARG NODE_VERSION=22-bookworm-slim

# ── Étape 1 : dépendances de build (dev comprises) ───────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Étape 2 : compilation TS + panneau d'administration ──────────────────────
FROM node:${NODE_VERSION} AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `strapi build` produit le serveur compilé dans dist/ et l'admin dans dist/build.
RUN npm run build

# ── Étape 3 : dépendances de production seules ───────────────────────────────
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Étape 4 : image finale ───────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337

# `--chown` à la copie plutôt qu'un `chown -R` a posteriori : ce dernier
# réécrivait chaque fichier de node_modules dans une couche supplémentaire,
# doublant la taille de l'image.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# `strapi start` lit `compilerOptions.outDir` de tsconfig.json pour localiser
# dist/. Sans ce fichier il chercherait les sources à la racine et échouerait.
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node favicon.png ./

# Les téléversements sont montés en volume : le point de montage doit appartenir
# à `node` pour rester inscriptible une fois l'utilisateur abaissé.
RUN mkdir -p /app/public/uploads && chown node:node /app /app/public/uploads

USER node

# Métadonnée seulement : aucun port n'est publié sur l'hôte, le service est
# joignable par son nom sur le réseau Docker (voir docker-compose.example.yml).
EXPOSE 1337

# `/_health` répond 204 sans toucher à la base. `fetch` est natif en Node 22,
# donc pas de curl/wget à installer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||1337)+'/_health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
