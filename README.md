# MAT OSRS BOT

Bot Discord qui identifie des opportunites de merch au Grand Exchange d'Old School RuneScape. Il utilise les prix temps reel de l'OSRS Wiki, applique la taxe GE, filtre les cotations trop anciennes et peut publier des alertes dedupliquees dans un salon Discord.

Les opportunites sont des estimations basees sur les dernieres transactions connues. Elles ne constituent ni un carnet d'ordres en direct ni une garantie de profit.

## Fonctionnalites

- `GET /health` pour verifier que le service HTTP fonctionne.
- `/ping` pour verifier la connexion Discord.
- `/merch [nombre]` pour afficher priveement les meilleures opportunites actuelles (1 a 10, 5 par defaut).
- Prix OSRS Wiki caches : cotations 60 secondes et mapping des objets 24 heures par defaut.
- Profit net par unite, ROI, taxe GE, plafond de taxe et exemptions connues.
- Alertes Discord facultatives, limitees et dedupliquees par objet.

## Prerequis

- Node.js 20 ou plus recent.
- Une application Discord avec un bot.
- Un acces reseau a `prices.runescape.wiki`.

## Installation rapide

```powershell
npm ci
Copy-Item .env.example .env
```

Renseigne ensuite `DISCORD_TOKEN` et `DISCORD_CLIENT_ID` dans `.env`, puis lance le bot :

```powershell
npm run start:dev
```

Le controle de sante est disponible sur `http://localhost:3000/health` par defaut.

## Configuration Discord

Dans le portail Discord Developer, cree une application puis un bot. Invite-le avec les scopes `bot` et `applications.commands`.

Le bot doit au minimum pouvoir voir le salon, envoyer des messages et integrer des liens. Ne versionne jamais `DISCORD_TOKEN` : `.env` est ignore par Git.

`DISCORD_GUILD_ID` est facultatif mais recommande en developpement : les commandes sont alors synchronisees immediatement dans ce serveur. Sans cette variable, elles sont synchronisees globalement, ce qui peut prendre du temps a etre visible.

Au demarrage, le bot synchronise l'ensemble de ses commandes (`/ping` et `/merch`) pour la portee configuree.

## Commandes

| Commande          | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `/ping`           | Repond `Pong!`.                                                      |
| `/merch`          | Affiche les cinq meilleures opportunites qui respectent les filtres. |
| `/merch nombre:8` | Affiche jusqu'a huit opportunites (maximum 10).                      |

`/merch` repond de maniere ephemere afin de ne pas encombrer le salon. Les alertes automatisees, elles, sont publiees dans le salon configure.

## Variables d'environnement

Copie `.env.example` vers `.env`. Les valeurs y sont deja documentees et correspondent aux valeurs par defaut.

### Discord et alertes

| Variable                    | Defaut    | Role                                                        |
| --------------------------- | --------- | ----------------------------------------------------------- |
| `PORT`                      | `3000`    | Port HTTP de NestJS.                                        |
| `DISCORD_TOKEN`             | -         | Secret du bot Discord.                                      |
| `DISCORD_CLIENT_ID`         | -         | ID de l'application Discord.                                |
| `DISCORD_GUILD_ID`          | -         | Serveur de developpement facultatif pour les commandes.     |
| `ALERTS_ENABLED`            | `false`   | Active les alertes automatisees.                            |
| `ALERTS_DISCORD_CHANNEL_ID` | -         | ID du salon cible, requis si les alertes sont actives.      |
| `ALERTS_INTERVAL_MS`        | `60000`   | Frequence minimale des verifications, en millisecondes.     |
| `ALERTS_MAX_PER_RUN`        | `3`       | Nombre maximal d'opportunites dans un digest (1 a 5).       |
| `ALERTS_DEDUP_TTL_MS`       | `3600000` | Duree avant de re-notifier le meme objet, en millisecondes. |

Pour les activer, renseigne explicitement un salon Discord puis redemarre le bot :

```dotenv
ALERTS_ENABLED=true
ALERTS_DISCORD_CHANNEL_ID=123456789012345678
```

Cela exige aussi `DISCORD_TOKEN` et `DISCORD_CLIENT_ID`. L'ID du salon doit contenir 17 a 20 chiffres. `ALERTS_INTERVAL_MS` ne peut pas etre inferieur a `60000` ms et `ALERTS_MAX_PER_RUN` doit etre compris entre 1 et 5.

La deduplication des alertes est conservee en memoire : un redemarrage peut donc renvoyer les opportunites encore actives.

### Source de prix OSRS

| Variable                              | Defaut                                                              | Role                                               |
| ------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| `OSRS_WIKI_PRICES_BASE_URL`           | `https://prices.runescape.wiki/api/v1/osrs`                         | Base de l'API de prix.                             |
| `OSRS_WIKI_PRICES_USER_AGENT`         | `MAT-OSRS-BOT/1.0 (GitHub: https://github.com/Jeyluu/MAT-OSRS-BOT)` | Identifie le bot aupres de l'API.                  |
| `OSRS_WIKI_PRICES_CACHE_TTL_MS`       | `60000`                                                             | Duree du cache des prix `latest`.                  |
| `OSRS_WIKI_MAPPING_CACHE_TTL_MS`      | `86400000`                                                          | Duree du cache des noms et limites d'achat.        |
| `OSRS_WIKI_PRICES_REQUEST_TIMEOUT_MS` | `10000`                                                             | Delai maximal d'une requete API, en millisecondes. |

L'API demande un `User-Agent` descriptif. Le bot fait une requete agregee pour les prix et les met en cache, plutot qu'une requete par objet. Consulte la [documentation Real-time Prices de l'OSRS Wiki](https://oldschool.runescape.wiki/w/RuneScape%3AReal-time_Prices) pour les details de la source.

### Filtres de merch

| Variable                               | Defaut    | Role                                                                   |
| -------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `OPPORTUNITIES_MIN_BUY_PRICE`          | `1000`    | Prix d'achat minimal, en GP.                                           |
| `OPPORTUNITIES_MIN_PROFIT_PER_ITEM`    | `1000`    | Profit net minimal par unite, en GP.                                   |
| `OPPORTUNITIES_MIN_ROI_PERCENT`        | `2`       | ROI minimal apres taxe.                                                |
| `OPPORTUNITIES_MAX_PRICE_AGE_MS`       | `900000`  | Age maximal de la plus ancienne cotation haut/bas.                     |
| `OPPORTUNITIES_MIN_BUY_LIMIT`          | `1`       | Limite d'achat minimale connue; les limites inconnues sont conservees. |
| `OPPORTUNITIES_MAX_RESULTS`            | `25`      | Nombre maximal de candidats produits par le moteur.                    |
| `OPPORTUNITIES_INCLUDE_MEMBERS`        | `true`    | Inclut les objets members.                                             |
| `OPPORTUNITIES_GE_TAX_RATE`            | `0.02`    | Taux de taxe GE par unite.                                             |
| `OPPORTUNITIES_GE_TAX_CAP`             | `5000000` | Plafond de taxe GE par unite, en GP.                                   |
| `OPPORTUNITIES_GE_TAX_EXEMPT_ITEM_IDS` | -         | IDs supplementaires exemptes, separes par des virgules.                |

Les exemptions configurees s'ajoutent a la liste d'exemptions connue integree au bot. Redemarre le bot apres toute modification de `.env`.

## Calcul et limites

Pour une opportunite, le bot estime :

```text
taxe = min(plafond, floor(prix_vente * taux))
profit_net = prix_vente - taxe - prix_achat
roi = profit_net / prix_achat * 100
```

La taxe est calculee par unite vendue. Le bot applique le taux GE courant de 2 %, le plafond de 5 M GP et les exemptions connues. Les prix `high` et `low` peuvent provenir de transactions differentes : le filtre de fraicheur utilise donc la cotation la plus ancienne. Les limites d'achat sont elles aussi des estimations et peuvent etre partagees entre variantes d'objets.

Les regles de taxe evoluent avec le jeu : verifie les [notes Jagex sur la taxe GE](https://secure.runescape.com/m=news/yama-cas--more?oldschool=1) si une mise a jour change les valeurs ou les exemptions.

## Classement flipping de la SPA

Le profil local fournit le capital et la stratégie. Une opportunité utilise `low` comme coût d'achat estimé, `high` comme prix de vente estimé, puis applique la taxe par unité avant le calcul du profit net et du ROI :

```text
taxe = 0 si l'objet est exempt, sinon min(5 000 000, floor(high × 2 %))
profit_net_unitaire = high - taxe - low
quantité = min(floor(capital / low), limite_GE si elle est connue)
profit_total_estimé = quantité × profit_net_unitaire
```

Le classement écarte les profits non positifs, les cotations de plus de 15 minutes, les cotations futures de plus d'une minute et les objets sans volume observé. Le rafraîchissement sélectionne jusqu'à 40 items dans plusieurs tranches de prix et récupère leur série OSRS Wiki sur six heures. Le volume affiché additionne les volumes `high` et `low` rapportés par la source ; ce n'est pas une mesure de profondeur d'ordres ni nécessairement un nombre d'objets uniques.

La volatilité est l'écart-type des variations en pourcentage du prix médian entre points adjacents (intervalles jusqu'à 15 minutes), calculée avec au moins 12 variations. Un item sans assez de points d'historique n'est pas classé. Les scores intermédiaires vont de 0 à 100 : profit total logarithmique (référence 10 M GP), ROI (référence 20 %), liquidité logarithmique (référence 10 000 unités de volume), stabilité (0 volatilité = 100, 10 % ou plus = 0), fraîcheur (15 minutes = 0) et capital investi (100 % utilisé = 100).

| Stratégie | Profit | ROI | Liquidité | Stabilité | Fraîcheur | Capital utilisé |
| --------- | -----: | --: | --------: | --------: | --------: | --------------: |
| Prudente  | 10 %   | 5 % | 25 %      | 30 %      | 20 %      | 10 %            |
| Équilibrée | 20 %  | 15 % | 20 %     | 15 %      | 15 %      | 15 %            |
| Agressive | 30 %   | 25 % | 10 %     | 5 %       | 15 %      | 15 %            |

Le score de risque combine volatilité (50 %), liquidité insuffisante (30 %) et fraîcheur insuffisante (20 %). Les niveaux sont faible jusqu'à 33, modéré jusqu'à 66, puis élevé. Les recommandations restent indicatives : `high` et `low` sont des transactions passées, et les offres du Grand Exchange ne sont pas garanties.

## Scripts utiles

```powershell
npm run start:dev  # demarrage avec rechargement
npm run build      # compilation de production
npm test -- --runInBand
npm run test:e2e
```

Pour verifier le style sans modifier de fichier :

```powershell
.\node_modules\.bin\eslint.cmd "{src,test}/**/*.ts"
```

## Application web OSRS Helper

La SPA React se trouve dans `apps/web`. Elle utilise React, Vite, Tailwind CSS, shadcn/ui, TanStack
Query, Zod, Biome et Vitest. Les calculs OSRS sans dépendance de framework sont partagés dans
`packages/core` avec le bot existant.

Pour la SPA, utilise Node.js 22.12 ou plus récent, ou Node.js 20.19 ou plus récent.

Depuis la racine du dépôt :

```powershell
npm ci
```

Pour le développement local, démarre Vite dans un terminal :

```powershell
npm run dev:web
```

Cette commande rafraîchit d’abord les données. Pour contrôler le code et construire une version
locale de production :

```powershell
npm run check:web
npm run test:web
npm run refresh:market -- --required
npm run build:web
```

Le workflow rafraîchit l’instantané automatiquement et bloque la publication si la collecte échoue.

Le workflow `.github/workflows/pages.yml` vérifie les pull requests vers `main`, puis construit
`apps/web/dist` et le publie après un push sur `main`, une exécution manuelle depuis `main` ou le
rafraîchissement planifié des prix. Les pull requests et les lancements depuis une autre branche
exécutent les validations et le build sans publier le site.

Pour le premier déploiement, le dépôt doit être public avec GitHub Free. Dans les paramètres du
dépôt, choisis **Settings → Pages → Build and deployment → Source: GitHub Actions** et vérifie que
GitHub Actions est activé. Lance ensuite **Actions → Deploy OSRS Helper to GitHub Pages → Run
workflow** et sélectionne `main`, ou pousse sur cette branche. L’URL attendue pour ce dépôt est
`https://jeyluu.github.io/MAT-OSRS-BOT/`. Le chemin de base Vite est `/MAT-OSRS-BOT/` ; adapte
`apps/web/vite.config.ts` si le dépôt est renommé ou si un domaine personnalisé est configuré.

### Données de marché de la SPA

La SPA récupère les cotations `latest`, le mapping des items et les agrégats `5m` de l’[API Real-time Prices de l’OSRS Wiki](https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices). Un script Node les valide avec Zod puis écrit un instantané JSON dans `apps/web/public/data/osrs-market.json`. Le navigateur lit ce fichier statique depuis GitHub Pages ; il n’appelle pas l’API source directement.

Le script est lancé avant Vite lors du développement. Pour le rafraîchir manuellement, utilise `npm run refresh:market`. Si la source est indisponible, le script local garde l’instantané précédent ; le workflow Pages exige une collecte valide avant de publier.

Le workflow met à jour le site toutes les cinq minutes avec un User-Agent descriptif. GitHub peut retarder ou ignorer une exécution planifiée sous forte charge et désactive les plannings des dépôts publics sans activité pendant 60 jours ; relance le workflow manuellement depuis l’onglet **Actions** si nécessaire. Les réponses ont leur propre horodatage, affiché dans l’interface. Les prix correspondent aux transactions récentes et ne garantissent pas l’exécution d’un ordre.

### Skilling

Le catalogue documente des méthodes de Coupe de bois, Cuisine, Empennage, Artisanat, Herboristerie et Forge. Les taux et prérequis proviennent des guides de l’[OSRS Wiki](https://oldschool.runescape.wiki/) ; les calculs de coût utilisent les prix acheteur récents et les recettes vendent au prix vendeur récent, après taxe du Grand Exchange. La fraîcheur des cotations est vérifiée avant d’afficher une recommandation. Le résultat reste une estimation des transactions récentes, pas une garantie d’exécution ou de profit.

Les méthodes d’Astral runes et de culture de ranarr sont listées à part, sans GP/h, car le coût horaire des déplacements et consommables ou le rendement de récolte ne sont pas assez déterminés par les données disponibles. Les niveaux de compétence sont éditables dans l’écran et enregistrés dans le stockage local du navigateur.

Références de taux utilisées : [Coupe de bois](https://oldschool.runescape.wiki/w/Tree_cutting_guide), [Cuisine](https://oldschool.runescape.wiki/w/Pay-to-play_Cooking_training), [Empennage](https://oldschool.runescape.wiki/w/Fletching_training), [Artisanat](https://oldschool.runescape.wiki/w/Money_making_guide/Crafting_drift_nets), [Herboristerie](https://oldschool.runescape.wiki/w/Herblore_training), [Forge](https://oldschool.runescape.wiki/w/Pay-to-play_Smithing_training), [Runecraft](https://oldschool.runescape.wiki/w/Pay-to-play_Runecraft_training) et [Culture](https://oldschool.runescape.wiki/w/Farming).

### Profil et HiScores

Le profil conserve localement le pseudo, le capital, la stratégie de flipping et la préférence de skilling. La préférence d’affichage des grands montants active aussi le format compact dans les écrans Flipping, Skilling et Profil. Le pseudo et les préférences restent dans ce navigateur et ne demandent aucun compte.

L’[endpoint officiel HiScores](https://secure.runescape.com/m=hiscore_oldschool/) ne renvoie pas d’en-tête `Access-Control-Allow-Origin` pour une lecture depuis la SPA. Pour éviter un proxy externe ou un backend, l’écran Profil ouvre la réponse CSV officielle dans un onglet ; l’utilisateur la copie puis l’importe. Le parseur valide les 25 lignes HiScores (total et 24 compétences), conserve l’instantané localement et transmet les niveaux publiés au calcul des recommandations. Une compétence non classée garde son niveau manuel précédent. Les mots de passe et jetons ne sont jamais demandés.
