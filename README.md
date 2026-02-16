# Idschema

Webbapp for idrott och halsa med elevvy och adminvy, byggd med React, Vite, Tailwind och Supabase.

## Kommandon

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

## Miljovariabler

Skapa en `.env` med:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

## Struktur

```text
src/
  app/                # App shell (providers + router)
  features/           # Domanspecifika features (admin, auth, schedule, term-plan, site)
  shared/             # Delade konstanter, layout och helpers
  integrations/       # Externa klienter (Supabase)
  lib/                # Smala utility-funktioner
```

## Notering

Projektet ar refaktorerat fran en aldre Lovable-export med fokus pa:

- tydligare feature-struktur
- mindre beroende- och filyta
- enhetliga Tailwind/CSS-tokens
