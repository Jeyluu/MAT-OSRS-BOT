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

## Scripts utiles

```powershell
npm run start:dev  # demarrage avec rechargement
npm run build      # compilation de production
npm test -- --runInBand
npm run test:e2e
```

Pour verifier le style sans modifier de fichier :

```powershell
.\node_modules\.bin\eslint.cmd "{src,apps,libs,test}/**/*.ts"
```
