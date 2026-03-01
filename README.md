# IDSchema

Webbapp för veckoschema och terminsplanering.

## Driftmodell (Neon + egen auth)

Appen använder nu:
- Neon Postgres för all data
- Vercel Functions (`/api/*`) för datalager och auth
- Cookie-baserad session för admin-login

Supabase används inte längre i runtime.

## Miljövariabler i Vercel

### Obligatoriska
- `NEON_DATABASE_URL`
- `AUTH_SESSION_SECRET`

### Minst en av dessa inloggningsmodeller
- Enkel admin:
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
  - (valfri) `ADMIN_ROLE` (`owner`/`editor`/`viewer`/`admin`)
- Flera användare:
  - `AUTH_USERS_JSON`

Exempel `AUTH_USERS_JSON`:

```json
[{"email":"erik.espemyr@falkoping.se","password":"byt-losenord","role":"owner"}]
```

## Sätt upp Neon-schema

1. Öppna Neon SQL Editor.
2. Kör innehållet i:

`neon_schema.sql`

Det skapar alla tabeller som appen behöver.

## Lokal utveckling

```bash
npm install
npm run dev
```

## Bygg

```bash
npm run lint
npm run build
```
