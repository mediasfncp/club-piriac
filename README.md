# 🏖️ FNCP – Club de Plage

Application mobile web de gestion du Club de Plage FNCP — La Baule — Saison 2026.

## 🚀 Déploiement

### Prérequis
- Node.js 18+
- npm ou yarn

---

### 1. Développement local

```bash
npm install
npm run dev
```
L'app tourne sur `http://localhost:5173`

---

### 2. Déploiement sur GitHub + Vercel

#### Étape 1 — Créer le dépôt GitHub

```bash
git init
git add .
git commit -m "Initial commit — FNCP App"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/fncp-app.git
git push -u origin main
```

#### Étape 2 — Connecter à Vercel

1. Aller sur [vercel.com](https://vercel.com) → **New Project**
2. Importer le dépôt GitHub `fncp-app`
3. Framework Preset : **Vite**
4. Build Command : `npm run build`
5. Output Directory : `dist`
6. Cliquer **Deploy** ✅

L'URL sera du type : `https://fncp-app.vercel.app`

---

### 3. Build de production

```bash
npm run build
npm run preview   # tester le build local
```

---

## 📱 Fonctionnalités

| Module | Description |
|--------|-------------|
| 🏠 Accueil | Home avec programme d'activités |
| 🎫 Formules | Natation, Club, Éveil Aquatique |
| 🏊 Réservations | Créneaux natation (2 places max) |
| 🏖️ Club de Plage | Formule Club + Carte Liberté |
| 🌊 Éveil Aquatique | Dimanches matin, 4 places / créneau |
| 📅 Planning | Programme saison 6 juil – 22 août |
| 💳 Paiement | Module PayPal intégré |
| 🔔 Rappels | Notifications veille à 20h00 |
| ⚙️ Admin | Dashboard protégé (code : **2026**) |

## 🔐 Accès Admin

Code PIN : **`2026`** (modifiable dans `src/App.jsx` → `ADMIN_CODE`)

## 🛠️ Stack

- **React 18** + hooks
- **Vite 5** (bundler)
- **Tailwind-free** — CSS-in-JS inline styles
- **Vercel** — déploiement CDN mondial
