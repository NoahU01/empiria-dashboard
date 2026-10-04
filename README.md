# empiria – Strategie

Die drei Strategie-Seiten aus dem Entwicklungsstand der empiria-Website,
herausgelöst in ein eigenes Repository.

| Seite | Datei |
| --- | --- |
| Strategie und Zielbild | `strategie/zielbild.html` |
| Meilensteine | `strategie/meilensteine.html` |
| Ökosystem | `strategie/oekosystem.html` |

## Herkunft

Kopiert aus [NoahU01/empiria](https://github.com/NoahU01/empiria),
Branch `Daniel`, Stand `daf4bff` (04.10.2026), aus `site/strategie/`.
Die Dateien sind unverändert übernommen – byte-identisch zur Quelle.

## Aufbau

Die Ordnerstruktur entspricht der Original-Website, damit die absoluten
Pfade in den Seiten (`/styles.css`, `/assets/…`) weiter stimmen:

```
strategie/        die drei Seiten
styles.css        Haupt-Stylesheet der Website
script.js         Skript der Website
assets/
  fonts/          Lora + Poppins, selbst gehostet (26 woff2)
  projekte/       projekte.css, dashboard.css
  oekosystem.css  nur für oekosystem.html
  *.svg           Logos
```

## Lokal ansehen

Ein Webserver ist nötig, weil die Seiten absolute Pfade verwenden –
per Doppelklick aus dem Dateisystem fehlen Stylesheet und Schriften.

```bash
python3 -m http.server 8000
# dann http://localhost:8000/strategie/zielbild.html
```

## Offene Punkte

- **Kein `index.html`** – der Aufruf von `/` läuft ins Leere.
  Einstieg ist `/strategie/zielbild.html`.
- **Kopfnavigation, Footer und Entwicklungsmenü sind mitkopiert** und
  verweisen auf rund 70 Seiten der Gesamt-Website, die hier nicht
  liegen (u. a. `/workshops`, `/impressum.html`, die Dashboard-Seiten).
  Diese Links laufen ins Leere, solange die Navigation nicht gekürzt wird.
- **Keine Deployment-Konfiguration** – eine `vercel.json` o. ä. ist
  bewusst nicht enthalten.
