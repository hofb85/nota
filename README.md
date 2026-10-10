# Nota

Nota helpt aan tafel om een rekening te delen. Je maakt een foto van de bon, controleert de gerechten en prijzen, en wijst daarna elk stuk toe aan een persoon.

Met Firebase leest Gemini de foto en haalt daar de producten en prijzen uit. De foto wordt niet in Firestore bewaard. Zonder Firebase blijft de foto op het toestel en leest de app de bon lokaal.

## Lokaal starten

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:47231](http://127.0.0.1:47231) op je telefoon, tablet of computer.

Zonder Firebase-configuratie blijft elke rekening op dit toestel staan. Delen kopieert dan alleen het overzicht.

## Gebruik

1. Maak een foto van de rekening, of kies een foto uit je bibliotheek.
2. Controleer namen, aantallen en bedragen. Voeg toe wat de foto miste.
3. Zet de namen aan tafel. Tik op een gerecht om één stuk aan de gekozen persoon te geven, of kies **Alles** voor de hele lijn.
4. Een gerecht dat jullie samen namen, open je via **Aanpassen** en kies **Samen delen**.
5. Deel het overzicht. Een fooi is optioneel en volgt ieders deel.

**Probeer de voorbeeldbon** laadt een rekening van Café De Lantaarn, zodat je de verdeling kan proberen zonder een echte bon.

Met Firebase krijgt de rekening een link `/?tafel=…`. Iedereen die de link opent, ziet dezelfde gerechten en dezelfde verdeling, live bijgewerkt. **Deel de tafel** stuurt die link mee.

## Tests

```bash
npm test
```

## Online op Firebase

Nota wordt als statische site gebouwd naar `out/` en gehost met Firebase Hosting. De rekening zelf staat in Firestore, collectie `bills`. Het document-id is een lange toevalscode. Alleen wie de link heeft, kan die ene rekening lezen of bijwerken. Verwijderen en de hele collectie overlopen zijn dicht.

### 1. Firebase-project

1. Maak een project in de [Firebase-console](https://console.firebase.google.com).
2. Maak een Firestore-database aan.
3. Zet Hosting aan.
4. Voeg een webapp toe en kopieer de config.

```bash
cp .env.example .env.local
```

Vul in `.env.local` de zes `NEXT_PUBLIC_FIREBASE_*` waarden. Herstart daarna `npm run dev`. Een nieuwe rekening krijgt dan een tafellink.

Zet daarna in de Firebase-console **Build → AI Logic → Get started** aan. Dat koppelt Gemini aan dezelfde webapp. Een foto van de bon gaat dan naar Gemini, dat de merken, gerechten, aantallen en lijntotalen teruggeeft. Lukt die stap niet, dan valt de app terug op de lokale lezer.

### 2. GitHub

Deze map publiceer je als eigen repository:

```bash
gh auth login
gh repo create nota --public --source=. --remote=github --push
```

Kies een andere naam als `nota` al bezet is.

Zet daarna in de repository onder Settings → Secrets and variables → Actions:

| Secret | Inhoud |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Webapp-config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Webapp-config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Webapp-config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Webapp-config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Webapp-config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Webapp-config |
| `FIREBASE_PROJECT_ID` | Zelfde project-id |
| `FIREBASE_SERVICE_ACCOUNT` | JSON van een serviceaccount |

Het serviceaccount heeft de rollen **Firebase Hosting Admin** en **Firebase Rules Admin** nodig. Download de sleutel als JSON en plak het hele bestand in het secret. Elke push naar `main` draait de tests, bouwt de site met die config, en publiceert Hosting plus de Firestore-regels. Zonder die secrets slaagt de build en wordt de deploy overgeslagen.

### 3. Zelf publiceren

```bash
npm test
npm run build
npx firebase-tools@14 login
npx firebase-tools@14 deploy --only firestore:rules,hosting --project JOUW_PROJECT_ID
```

De site staat daarna op `https://JOUW_PROJECT_ID.web.app`. De build leest `.env.local`, dus de Firebase-waarden moeten daar staan vóór `npm run build`.
