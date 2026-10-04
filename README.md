# empiria – Strategie

Die drei Strategie-Seiten aus dem Entwicklungsstand der empiria-Website,
herausgelöst in ein eigenes Repository.

<https://empiria-dashboard.vercel.app/>

| Seite | Datei |
| --- | --- |
| Startseite (Übersicht) | `index.html` |
| Strategie und Zielbild | `strategie/zielbild.html` |
| Meilensteine | `strategie/meilensteine.html` |
| Ökosystem | `strategie/oekosystem.html` |

## Herkunft

Die drei Seiten stammen aus [NoahU01/empiria](https://github.com/NoahU01/empiria),
Branch `Daniel`, Stand `daf4bff` (04.10.2026), aus `site/strategie/`.

**Der Inhalt (`<main>`) ist unverändert und byte-identisch zur Quelle.**
Geändert wurde ausschließlich die Navigation drumherum (siehe unten).

## Navigation

Kopf- und Mobilnavigation enthalten nur noch das empiria-Logo und die drei
Seiten. Entfernt wurden: die vollständige Navigation der Hauptwebsite, das
Entwicklungsmenü (`<!-- ENTWICKLUNG -->`-Block mit Verweisen auf rund 70
Seiten, die hier nicht liegen) und der Kontakt-Button.

Die Rechtstexte im Footer zeigen auf die Originale unter `www.empiria.de`,
weil sie in diesem Repository nicht liegen.

## Aufbau

Die Ordnerstruktur entspricht der Original-Website, damit die absoluten
Pfade in den Seiten (`/styles.css`, `/assets/…`) weiter stimmen:

```
index.html        Übersicht mit den drei Karten
strategie/        die drei Seiten
styles.css        Haupt-Stylesheet der Website
script.js         Skript der Website
assets/
  fonts/          Lora + Poppins, selbst gehostet (26 woff2)
  projekte/       projekte.css, dashboard.css
  oekosystem.css  nur für oekosystem.html
  *.svg           Logos
```

Die Karten der Startseite nutzen das vorhandene `.cards-3col`-Raster und die
`.btn`-Klassen; die paar Zeilen eigenes CSS stehen inline in `index.html` und
übernehmen Rahmen, Radius und Fläche von `.pj-schritt-box` aus `projekte.css`.

## Kurze Links

`vercel.json` setzt drei Weiterleitungen (temporär, 307):

| Aufruf | landet auf |
| --- | --- |
| `/zielbild` | `/strategie/zielbild.html` |
| `/meilensteine` | `/strategie/meilensteine.html` |
| `/oekosystem` | `/strategie/oekosystem.html` |

Bewusst Weiterleitung statt Rewrite: die Seiten verlinken untereinander
relativ. Bei einem Rewrite bliebe die Adresszeile stehen und diese Links
würden ins Leere laufen.

## Lokal ansehen

Ein Webserver ist nötig, weil die Seiten absolute Pfade verwenden.

```bash
python3 -m http.server 8000
# dann http://localhost:8000/
```

## Offene Punkte

- Die Startseite ist ein Platzhalter – drei Karten mit Kurztext und Button.
  Die Texte stammen aus den Seiten selbst. Eine richtige Startseite
  definiert der Kunde später.
- Das Repository ist öffentlich.
