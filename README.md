# Portail captif Wifi Zone (Next.js + Supabase + FreeRADIUS)

Flux : client WiFi → redirigé par le Ruijie vers ce portail → saisit son code → l'API
vérifie le ticket dans Supabase → le portail renvoie code/code au contrôleur Ruijie →
le Ruijie interroge FreeRADIUS (qui lit Supabase) → accès internet.

## 1. Supabase
1. Charger le schéma FreeRADIUS PostgreSQL, puis `supabase/schema.sql`.
2. Générer des tickets : `select * from generate_vouchers(1, 20);`

## 2. Portail (Vercel)
1. `cp .env.example .env.local` et remplir les variables.
2. `npm install && npm run dev` pour tester, puis déployer sur Vercel (HTTPS obligatoire).
3. Ajouter les mêmes variables dans Vercel.

## 3. FreeRADIUS (VPS Ubuntu, IP publique)
    apt install freeradius freeradius-postgresql
Suivre `radius/sql.conf.md` et `radius/clients.conf`. Ouvrir uniquement UDP 1812 et 1813.
Starlink étant en CGNAT, ne pas filtrer par IP : le secret doit être long et aléatoire.

## 4. Ruijie Cloud
Auth and Account > Captive Portal > nouvelle politique :
- Policy Mode : **External**, SSID invité en **Open**
- Portal Server URL : l'URL HTTPS du portail
- RADIUS : IP du VPS, ports 1812/1813, le secret de `clients.conf`
- Allowlist (Free URLs) : le domaine du portail uniquement

## À vérifier absolument
- **L'URL de soumission** (`NEXT_PUBLIC_GATEWAY_LOGIN_URL`) et les noms de champs dépendent du
  firmware Ruijie. Lance `npm run dev`, connecte-toi au WiFi, et regarde la console :
  les paramètres reçus (gw_address, ip, mac, url...) y sont affichés. Envoie-les-moi
  pour ajuster le formulaire.
- Un AP seul (sans passerelle/contrôleur) ne supporte pas forcément le portail externe :
  envoie-moi une capture de la page Captive Portal de ton Ruijie Cloud.
- Durée : `Expiration` limite la validité totale ; pour plafonner aussi le temps cumulé
  de connexion, ajouter le module `sqlcounter` (Max-All-Session).
- Anti-bruteforce : ajouter une limitation de requêtes sur `/api/voucher` avant la production.
