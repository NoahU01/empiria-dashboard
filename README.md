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

## Deployment

Liegt als eigenes Vercel-Projekt der empiria GmbH:
<https://empiria-dashboard.vercel.app/>

`vercel.json` setzt vier Weiterleitungen, damit kurze Links funktionieren:

| Aufruf | landet auf |
| --- | --- |
| `/` | `/strategie/zielbild.html` |
| `/zielbild` | `/strategie/zielbild.html` |
| `/meilensteine` | `/strategie/meilensteine.html` |
| `/oekosystem` | `/strategie/oekosystem.html` |

Bewusst **Weiterleitung statt Rewrite**: die drei Seiten verlinken
untereinander relativ (`meilensteine.html`). Bei einem Rewrite bliebe die
Adresszeile auf `/` stehen und diese Links würden ins Leere laufen. Die
Weiterleitungen sind temporär (307), nicht dauerhaft – so lässt sich `/`
später ohne Browser-Cache-Probleme auf eine echte Übersichtsseite legen.

## Offene Punkte

- **Keine Übersichtsseite** – `/` leitet auf die erste der drei Seiten
  weiter. Eine echte Startseite, die alle drei auflistet, gibt es nicht.
- **Kopfnavigation, Footer und Entwicklungsmenü sind mitkopiert** und
  verweisen auf rund 70 Seiten der Gesamt-Website, die hier nicht
  liegen (u. a. `/workshops`, `/impressum.html`, die Dashboard-Seiten).
  Diese Links laufen ins Leere, solange die Navigation nicht gekürzt wird.
- **Das Repository ist öffentlich.**
