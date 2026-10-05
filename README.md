# empiria – Strategie

Die sieben Strategie-Seiten aus dem Entwicklungsstand der empiria-Website,
herausgelöst in ein eigenes Repository.

<https://empiria-dashboard.vercel.app/>

| Kürzel | Seite | Datei |
| --- | --- | --- |
| SZ | Strategie und Zielbild | `strategie/zielbild.html` |
| MS | Meilensteine | `strategie/meilensteine.html` |
| ÖS | Ökosystem (Startseite) | `strategie/oekosystem.html` |
| SZ | Steuerungszentrale | `strategie/dashboard.html` |
| AL | Aktuelle Lage | `strategie/dashboard-lage.html` |
| EN | Entwürfe I | `strategie/dashboard-entwuerfe.html` |
| E2 | Entwürfe II | `strategie/dashboard-entwuerfe-2.html` |

Dazu kommt `strategie/dashboard-korrespondenz.html`. Sie steht nicht im Menü
(auch im Original nicht), wird aber aus „Aktuelle Lage“ heraus verlinkt.

## Herkunft

Alle Seiten stammen aus [NoahU01/empiria](https://github.com/NoahU01/empiria),
Branch `Daniel`, aus `site/strategie/` – Menüpunkt „Entwicklung“, Kategorie
„Strategie“. Zielbild, Meilensteine und Ökosystem: Stand `daf4bff`
(04.10.2026); die übrigen: Stand `fa3f501` (05.10.2026). Der Inhalt der
ersten drei ist in beiden Ständen gleich.

**Der Inhalt (`<main>`) ist unverändert und byte-identisch zur Quelle.**
Geändert wurde ausschließlich die Navigation drumherum (siehe unten).

Einzige Ausnahme: Im Ökosystem tragen die Erklärungen zu GitHub und Vercel
je einen Satz mehr zu den Konten (GitHub auf Noahs Account, Vercel auf einem
eigenen Account von empiria). Das steht nur hier, nicht im empiria-Repository.

## Navigation

Die Kopfzeile zeigt nur das empiria-Logo und rechts daneben ein Dreieck.
Ein Klick darauf öffnet die Liste der sieben Seiten; Klick daneben oder
Escape schließt sie. Die Optik folgt dem Entwicklungsmenü der Website
(Kürzel-Kachel, Titel, Unterzeile). Desktop und Mobil nutzen dieselbe Liste,
einen Hamburger gibt es nicht mehr.

- `assets/dashboard-nav.css` – Gestaltung
- `assets/dashboard-nav.js` – Öffnen und Schließen

Das Logo führt zum Ökosystem. Entfernt wurden: die vollständige Navigation
der Hauptwebsite, das Entwicklungsmenü (`<!-- ENTWICKLUNG -->`-Block mit
Verweisen auf rund 70 Seiten, die hier nicht liegen) und der Kontakt-Button.

Die Rechtstexte im Footer zeigen auf die Originale unter `www.empiria.de`,
weil sie in diesem Repository nicht liegen.

## Aufbau

Die Ordnerstruktur entspricht der Original-Website, damit die absoluten
Pfade in den Seiten (`/styles.css`, `/assets/…`) weiter stimmen:

```
index.html          leitet auf das Ökosystem weiter
strategie/          die Seiten
styles.css          Haupt-Stylesheet der Website
script.js           Skript der Website
assets/
  fonts/            Lora + Poppins, selbst gehostet (26 woff2)
  projekte/         projekte.css, dashboard.css
  oekosystem.css    Ökosystem
  steuerzentrale.css, dashboard-neu.css   Steuerungszentrale, Lage, Korrespondenz
  entwuerfe.css, entwuerfe2.css           Entwürfe I und II
  dashboard-nav.*   Navigation (siehe oben)
  *.svg             Logos
```

## Startseite und kurze Links

`vercel.json` setzt Weiterleitungen (temporär, 307). `/` landet auf dem
Ökosystem; `index.html` leitet zusätzlich selbst weiter, damit das auch
lokal greift.

| Aufruf | landet auf |
| --- | --- |
| `/` | `/strategie/oekosystem.html` |
| `/zielbild` | `/strategie/zielbild.html` |
| `/meilensteine` | `/strategie/meilensteine.html` |
| `/oekosystem` | `/strategie/oekosystem.html` |
| `/steuerungszentrale` | `/strategie/dashboard.html` |
| `/lage` | `/strategie/dashboard-lage.html` |
| `/entwuerfe` | `/strategie/dashboard-entwuerfe.html` |
| `/entwuerfe-2` | `/strategie/dashboard-entwuerfe-2.html` |

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

- „Aktuelle Lage“: In den Startklar-Karten laufen die Buttons über den
  Kartenrand. Das ist im Original genauso und wurde hier nicht angefasst.
- Das Repository ist öffentlich.
