/* Dashboard 2.0 – Entwürfe A (Tagesblatt), B (Lagezentrum), C (Projektraum).
   Lädt nach der Anmeldung Projekte, Aufgaben, Termine und Briefing aus der Datenbank und füllt die Seite je nach <main data-d2="a|b|c">. */
(function () {
  "use strict";
  var db = window.empiriaDb, el = document.querySelector("[data-d2]");
  if (!db || !el) return;
  var art = el.getAttribute("data-d2"), D, HEUTE, TAGNAME;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function datum(f) { return f ? f.slice(8, 10) + "." + f.slice(5, 7) + "." : ""; }
  function istDaniel(v) { return v === "Daniel" || /^Daniel /.test(v || ""); }
  function projekt(id) { for (var i = 0; i < D.projekte.length; i++) if (D.projekte[i].id === id) return D.projekte[i]; return null; }
  function spaet(f) { return f && f < HEUTE; }
  function faellig(f) { if (!f) return ""; return spaet(f) ? '<span class="d2-spaet">seit ' + datum(f) + "</span>" : "bis " + datum(f); }
  function uhr(ts) { return ts ? new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : ""; }
  function plusTage(n) { return iso(new Date(new Date(HEUTE + "T12:00:00").getTime() + n * 86400000)); }
  function iso(d) { return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); }

  /* Tag der Ansicht: bis 18 Uhr heute, danach morgen */
  var jetzt = new Date(), tagDatum = new Date(jetzt.getTime() + (jetzt.getHours() >= 18 ? 86400000 : 0));
  HEUTE = iso(tagDatum);
  TAGNAME = (jetzt.getHours() >= 18 ? "Morgen, " : "Heute, ") + tagDatum.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { el.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden, dann erscheinen hier deine Daten.</p></div>'; return; }
    var von = new Date(HEUTE + "T00:00:00"), bis = new Date(von.getTime() + 86400000);
    Promise.all([
      db.from("projekte").select("id, name, marke, typ, phase, prioritaet").eq("status", "läuft"),
      db.from("aufgaben").select("id, projekt_id, titel, verantwortlich, faellig_am, ticket_stand, spalte").eq("status", "offen"),
      db.from("termine").select("start, ende, ganztags, betreff, postfach, abgesagt").gte("start", von.toISOString()).lt("start", bis.toISOString()).order("start"),
      db.from("briefing").select("id, rang, titel, kern, knopf, link").is("entscheidung", null).eq("gilt_fuer", HEUTE).order("rang")
    ]).then(function (r) {
      var fehler = r.filter(function (x) { return x.error; })[0];
      if (fehler) { el.innerHTML = '<p class="d2-leer">Daten konnten nicht geladen werden: ' + esc(fehler.error.message) + "</p>"; return; }
      var projekte = r[0].data || [], ids = projekte.map(function (p) { return p.id; });
      var aufgaben = (r[1].data || []).filter(function (a) { return ids.indexOf(a.projekt_id) >= 0; }).map(function (a) {
        return { id: a.id, p: a.projekt_id, t: a.titel, v: a.verantwortlich, f: a.faellig_am, s: a.ticket_stand, sp: a.spalte };
      });
      var termine = (r[2].data || []).filter(function (t) { return !t.abgesagt; });
      D = {
        projekte: projekte, aufgaben: aufgaben, briefing: r[3].data || [],
        termine: termine.filter(function (t) { return !t.ganztags; }),
        ganztag: termine.filter(function (t) { return t.ganztags; }).map(function (t) { return t.betreff; })
      };
      D.dir = aufgaben.filter(function (a) { return a.v === "Claude" && ["zur_abnahme", "rueckfrage", "in_arbeit"].indexOf(a.s) >= 0; })
          .map(function (a) { var p = projekt(a.p); return { id: a.id, t: a.t, s: a.s, p: p ? p.name : "" }; });
      zeichnen();
    });
  });

  function briefing(spalten) {
    var l = D.briefing.length ? '<ul class="d2-impulse">' + D.briefing.map(function (i) {
      var ziel = "/strategie/eingang-klar.html#s=briefing:" + i.id;
      return '<li class="d2-impuls"><div><b><a href="' + ziel + '">' + esc(i.titel) + "</a></b><span>" + esc(i.kern) + '</span></div><a class="d2-knopf" href="' + ziel + '">Öffnen und entscheiden</a></li>';
    }).join("") + "</ul>" : '<p class="d2-impuls">Für diesen Tag liegt noch kein Briefing vor.</p>';
    return '<section class="d2-briefing' + (spalten ? " d2-briefing--spalten" : "") + '"><h2>Drei Dinge zuerst</h2>' +
      '<span class="d2-neben">Briefing von Claude als Stabschef</span>' + l + "</section>";
  }

  function tag(titel) {
    var z = D.termine.map(function (t) {
      return '<li class="d2-zeile"><span class="d2-zeit">' + esc(uhr(t.start)) + "</span><span>" + esc(t.betreff) +
        "<small>bis " + esc(uhr(t.ende)) + '</small></span><span class="d2-rechts">' + esc(t.postfach || "") + "</span></li>";
    }).join("") || '<li class="d2-zeile d2-zeile--ohne"><span class="d2-leer">Keine Termine</span></li>';
    return '<section class="d2-abschnitt"><h2>' + esc(titel || "Dein Tag") + '</h2><p class="d2-neben">' + esc(TAGNAME) +
      D.ganztag.map(function (g) { return " · " + esc(g); }).join("") + '</p><ul class="d2-liste">' + z + "</ul></section>";
  }

  function dran() {
    var z = D.dir.filter(function (x) { return x.s !== "in_arbeit"; }).map(function (x) {
      var was = x.s === "rueckfrage" ? "Rückfrage" : "Abnahme";
      return '<li class="d2-zeile d2-zeile--ohne"><span><b>' + was + ":</b> " + esc(x.t) + "<small>" + esc(x.p) +
        '</small></span><a class="d2-knopf" href="/strategie/eingang-klar.html#s=ticket:' + x.id + '">' + (x.s === "rueckfrage" ? "Antworten" : "Öffnen") + "</a></li>";
    }).join("");
    return '<section class="d2-abschnitt d2-dran"><h2>Wartet auf dich</h2><ul class="d2-liste">' + z + "</ul></section>";
  }

  function claude() {
    var laeuft = D.dir.filter(function (x) { return x.s === "in_arbeit"; });
    var naechste = D.aufgaben.filter(function (a) { return a.v === "Claude" && a.s === "bereit"; })
      .sort(function (a, b) { return (a.f || "9") < (b.f || "9") ? -1 : 1; }).slice(0, 4);
    var z = laeuft.map(function (x) {
      return '<li class="d2-zeile d2-zeile--ohne"><span>' + esc(x.t) + "<small>" + esc(x.p) + '</small></span><span class="d2-rechts">läuft gerade</span></li>';
    }).concat(naechste.map(function (a) {
      var p = projekt(a.p);
      return '<li class="d2-zeile d2-zeile--ohne"><span>' + esc(a.t) + "<small>" + esc(p ? p.name : "") + '</small></span><span class="d2-rechts">als Nächstes' + (a.f ? ", " + faellig(a.f) : "") + "</span></li>";
    })).join("");
    return '<section class="d2-abschnitt"><h2>Claude arbeitet daran</h2><ul class="d2-liste">' + z + "</ul></section>";
  }

  function liste(titel, neben, filter, offen) {
    var z = D.aufgaben.filter(filter).sort(function (a, b) { return (a.f || "9") < (b.f || "9") ? -1 : 1; }).map(function (a) {
      var p = projekt(a.p);
      return '<li class="d2-zeile d2-zeile--ohne"><span>' + esc(a.t) + "<small>" + esc(p ? p.name : "") + (istDaniel(a.v) ? "" : " · " + esc(a.v)) +
        '</small></span><span class="d2-rechts">' + faellig(a.f) + "</span></li>";
    }).join("");
    return '<details class="d2-abschnitt d2-auf"' + (offen ? " open" : "") + "><summary><h2>" + esc(titel) + '</h2></summary><p class="d2-neben">' + esc(neben) +
      '</p><ul class="d2-liste">' + z + "</ul></details>";
  }
  var ueberfaelligDir = function (a) { return istDaniel(a.v) && spaet(a.f) && a.sp !== "backlog"; };
  var ueberfaelligAndere = function (a) { return !istDaniel(a.v) && a.v !== "Claude" && a.v !== "Zuständigkeit offen" && spaet(a.f); };

  function zeichnen() {
  /* ---------- A: Tagesblatt ---------- */
  if (art === "a") {
    el.innerHTML = briefing(false) + dran() + claude() +
      liste("Überfällig bei dir", "Neu terminieren, abgeben oder streichen", ueberfaelligDir) +
      liste("Überfällig bei anderen", "Nachhaken: Claude schreibt den Entwurf, du gibst frei", ueberfaelligAndere);
  }

  /* ---------- B: Lagezentrum ---------- */
  if (art === "b") {
    var marken = ["Alle", "empiria", "sofortsichtbar", "Müller&Ströbel."];
    function zeilen(marke) {
      var reihen = D.projekte.filter(function (p) { return marke === "Alle" || p.marke === marke; }).map(function (p) {
        var nachDatum = function (a, b) { return (a.f || "9") < (b.f || "9") ? -1 : 1; };
        var offen = D.aufgaben.filter(function (a) { return a.p === p.id && a.sp !== "backlog"; }).sort(nachDatum);
        /* ohne aktive Aufgabe: fällige Backlog-Aufgabe der nächsten 60 Tage (oder überfällig) als nächster Schritt */
        if (!offen.length) offen = D.aufgaben.filter(function (a) { return a.p === p.id && a.f && a.f <= plusTage(60); }).sort(nachDatum);
        return { p: p, a: offen[0] || null };
      }).sort(function (x, y) { return ((x.a && x.a.f) || "9") < ((y.a && y.a.f) || "9") ? -1 : 1; });
      return reihen.map(function (r) {
        var a = r.a, bei = a ? (istDaniel(a.v) ? "<span>Du</span>" : esc(a.v)) : "";
        return '<tr class="' + (a && istDaniel(a.v) ? "d2-dir" : "") + '"><td><b>' + esc(r.p.name) + "</b><small>" + esc(r.p.marke) + (r.p.typ ? " · " + esc(r.p.typ) : "") +
          "</small></td><td>" + (a ? esc(a.t) : '<span class="d2-leer">Kein nächster Schritt festgelegt</span>') + "</td><td>" + bei + "</td><td>" + (a ? faellig(a.f) : "") + "</td></tr>";
      }).join("");
    }
    el.innerHTML = briefing(true) + '<div class="d2-lage"><section class="d2-abschnitt"><h2>Projektlage</h2><p class="d2-neben">Je Projekt der nächste Schritt, sortiert nach Fälligkeit</p>' +
      '<div class="d2-filter">' + marken.map(function (m, i) { return '<button type="button" data-marke="' + esc(m) + '" aria-pressed="' + (i === 0) + '">' + esc(m) + "</button>"; }).join("") +
      '</div><table class="d2-tabelle"><thead><tr><th>Projekt</th><th>Nächster Schritt</th><th>Bei</th><th>Fällig</th></tr></thead><tbody data-zeilen>' + zeilen("Alle") +
      "</tbody></table></section><div class=\"d2-seite\">" + dran() + tag("Dein Tag") + "</div></div>";
    el.querySelectorAll("[data-marke]").forEach(function (b) {
      b.addEventListener("click", function () {
        el.querySelectorAll("[data-marke]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        el.querySelector("[data-zeilen]").innerHTML = zeilen(b.getAttribute("data-marke"));
      });
    });
  }

  /* ---------- C: Projektraum ---------- */
  if (art === "c") {
    var gruppen = ["sofortsichtbar", "empiria", "Müller&Ströbel."];
    var wartet = function (pid) { return D.aufgaben.some(function (a) { return a.p === pid && istDaniel(a.v) && a.sp !== "backlog" && a.f && a.f <= plusTage(2); }); };
    function raum(pid) {
      var p = projekt(pid), auf = D.aufgaben.filter(function (a) { return a.p === pid; });
      var aktiv = auf.filter(function (a) { return a.sp !== "backlog"; }), ziele = auf.filter(function (a) { return a.sp === "backlog"; });
      function spalte(titel, kl, f) {
        var l = aktiv.filter(f).map(function (a) { return "<li>" + esc(a.t) + "<small>" + (istDaniel(a.v) || a.v === "Claude" ? "" : esc(a.v) + " · ") + (faellig(a.f) || "ohne Termin") + "</small></li>"; }).join("");
                return '<div class="d2-spalte ' + (l ? kl : "") + '"><h3>'  + titel + "</h3>" + (l ? "<ul>" + l + "</ul>" : '<p class="d2-leer">Nichts offen</p>') + "</div>";
      }
      return "<h2>" + esc(p.name) + '</h2><p class="d2-neben">' + esc(p.marke) + (p.phase ? " · " + esc(p.phase) : "") + '</p><div class="d2-spalten">' +
        spalte("Bei dir", "d2-spalte--dir", function (a) { return istDaniel(a.v); }) +
        spalte("Bei Claude", "", function (a) { return a.v === "Claude"; }) +
        spalte("Bei anderen", "", function (a) { return !istDaniel(a.v) && a.v !== "Claude"; }) + "</div>" +
        (ziele.length ? '<details class="d2-auf d2-ziele"><summary><h2>Ziele und Meilensteine</h2></summary><ul class="d2-liste">' + ziele.map(function (a) {
          return '<li class="d2-zeile d2-zeile--ohne"><span>' + esc(a.t) + '</span><span class="d2-rechts">' + (a.f ? datum(a.f) + a.f.slice(0, 4) : "") + "</span></li>";
        }).join("") + "</ul></details>" : "");
    }
    var leiste = gruppen.map(function (g) {
      return "<p>" + esc(g) + "</p>" + D.projekte.filter(function (p) { return p.marke === g; }).map(function (p) {
        return '<button type="button" data-pid="' + p.id + '"><span>' + esc(p.name) + "</span>" + (wartet(p.id) ? '<i title="Du bist in den nächsten zwei Tagen dran"></i>' : "") + "</button>";
      }).join("");
    }).join("") + '<select aria-label="Projekt wählen">' + gruppen.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + D.projekte.filter(function (p) { return p.marke === g; }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("") + "</optgroup>";
    }).join("") + "</select>";
    el.innerHTML = '<div class="d2-raum"><nav class="d2-leiste" aria-label="Projekte">' + leiste + '</nav><section data-raum></section></div>';
    function zeige(pid) {
      el.querySelector("[data-raum]").innerHTML = raum(pid);
      el.querySelectorAll("[data-pid]").forEach(function (b) { b.setAttribute("aria-current", String(+b.getAttribute("data-pid") === pid)); });
      el.querySelector("select").value = String(pid);
    }
    el.querySelectorAll("[data-pid]").forEach(function (b) { b.addEventListener("click", function () { zeige(+b.getAttribute("data-pid")); }); });
    el.querySelector("select").addEventListener("change", function (e) { zeige(+e.target.value); });
    zeige(1);
  }
  }
})();
