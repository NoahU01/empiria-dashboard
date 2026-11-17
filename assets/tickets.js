/* Tickets bei Claude (Daniel, 17.11.2026) – oben auf der Seite „Aufgaben“.
   Logik und Begriffe von der Seite Ticketsystem: Sofort-Spur (Vorfahrt, startet innerhalb einer Minute über den Wächter),
   Hintergrund-Spur (nach Priorität), Vorziehen, Stopp, Abnahme je Ticket. Jede Aktion bekommt eine sichtbare Bestätigung.
   Daten: aufgaben (verantwortlich 'Claude', Ticketfelder), steuerung_schalter ('stopp'), vorlagen (Abnahme-Karte wird mit erledigt). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-tickets]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var tickets = [], projekte = [], stopp = false, spur = "sofort", meldung = "";
  var GRUPPEN = [
    ["dir", "Wartet auf dich", function (t) { return t.ticket_stand === "zur_abnahme" || t.ticket_stand === "rueckfrage"; }],
    ["laeuft", "Läuft gerade", function (t) { return t.ticket_stand === "in_arbeit"; }],
    ["naechstes", "Als Nächstes bei Claude", function (t) { return t.ticket_stand === "bereit"; }],
    ["wartet", "Wartet auf Vorgänger oder Anlass", function (t) { return t.ticket_stand === "wartet"; }],
    ["neu", "Noch zu beschreiben", function (t) { return !t.ticket_stand; }]
  ];
  var PRIO = { hoch: 1, mittel: 2, niedrig: 3 };

  db.auth.getSession().then(function (s) { if (s.data.session) laden(); });

  function laden() {
    Promise.all([
      db.from("aufgaben").select("id, titel, projekt_id, faellig_am, ticket_stand, ticket_prioritaet, ticket_spur, ticket_herkunft, ticket_ergebnis, ticket_ablage, ticket_rueckmeldung, ticket_ergebnis_link, ticket_stand_am")
        .eq("status", "offen").eq("verantwortlich", "Claude").neq("art", "projektgate").neq("art", "gate"),
      db.from("projekte").select("id, name, marke").neq("status", "abgeschlossen").order("name"),
      db.from("steuerung_schalter").select("an").eq("name", "stopp").maybeSingle()
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="tk-fehler">Tickets konnten nicht geladen werden: ' + esc(r[0].error.message) + "</p>"; return; }
      tickets = r[0].data || []; projekte = r[1].data || []; stopp = !!(r[2].data && r[2].data.an);
      zeichnen();
    });
  }
  function projektName(id) { var p = projekte.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "Operativ"; }
  function sortieren(a, b) {
    return (a.ticket_spur === "sofort" ? 0 : 1) - (b.ticket_spur === "sofort" ? 0 : 1) ||
      (PRIO[a.ticket_prioritaet] || 4) - (PRIO[b.ticket_prioritaet] || 4) ||
      String(a.faellig_am || "9999").localeCompare(String(b.faellig_am || "9999")) || a.id - b.id;
  }
  function chips(t) {
    var c = "";
    if (t.ticket_spur === "sofort") c += '<span class="tk-chip tk-chip--sofort">' + (t.ticket_herkunft === "chat" ? "Sprint im Chat" : "Sofort-Spur") + "</span>";
    if (t.ticket_prioritaet) c += '<span class="tk-chip">Priorität ' + esc(t.ticket_prioritaet) + "</span>";
    if (t.faellig_am) c += '<span class="tk-chip">bis ' + new Date(t.faellig_am + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + "</span>";
    return c;
  }
  function zeile(t, gruppe) {
    var aktionen = "", info = "";
    if (t.ticket_stand === "zur_abnahme") {
      info = '<p class="tk-info" data-auf><span class="tk-marke">Ergebnis</span>' + esc(t.ticket_rueckmeldung || "liegt vor") + "</p>" +
        (t.ticket_ablage ? '<p class="tk-ablage">' + esc(t.ticket_ablage) + "</p>" : "");
      aktionen = '<button type="button" class="tk-ja" data-aktion="passt">Passt</button><button type="button" data-aktion="zurueck">Überarbeiten</button>';
    } else if (t.ticket_stand === "rueckfrage") {
      info = '<p class="tk-info" data-auf><span class="tk-marke tk-marke--frage">Rückfrage</span>' + esc(t.ticket_rueckmeldung || "Die Frage fehlt im Ticket. Claude ergänzt sie, oder du schreibst direkt, wie es weitergehen soll.") + "</p>";
      aktionen = '<button type="button" class="tk-ja" data-aktion="antworten">Antworten</button>';
    } else if (t.ticket_stand === "bereit" && t.ticket_spur !== "sofort") {
      aktionen = '<button type="button" data-aktion="vorziehen">Vorziehen</button>';
    }
    return '<li class="tk-ticket" data-id="' + t.id + '">' +
      '<div class="tk-zeile"><div class="tk-titel"><b>' + esc(t.titel) + '</b><span>' + esc(projektName(t.projekt_id)) + "</span></div>" +
      '<div class="tk-chips">' + chips(t) + "</div></div>" + info +
      (aktionen ? '<div class="tk-aktionen">' + aktionen + "</div>" : "") +
      '<form class="tk-text" hidden><textarea rows="3"></textarea><button type="submit" class="tk-ja"></button></form>' +
      "</li>";
  }
  function zeichnen() {
    var opt = projekte.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("");
    var html = '<div class="tk-kopf"><h2 class="h-serif">Tickets bei Claude</h2>' +
      '<button type="button" class="tk-stopp' + (stopp ? " is-an" : "") + '" data-stopp>' + (stopp ? "Gestoppt – fortsetzen" : "Alles anhalten") + "</button></div>" +
      (stopp ? '<p class="tk-hinweis tk-hinweis--stopp">Stopp ist an: Die Hintergrund-Spur startet nichts, bis du fortsetzt.</p>' : "") +
      '<form class="tk-eingang" data-eingang><label for="tkText">Neues Ticket</label>' +
      '<textarea id="tkText" rows="2" placeholder="Was soll ich erledigen? Ein Satz reicht, diktieren geht auch."></textarea>' +
      '<div class="tk-eingang-unten"><div class="tk-spur" role="radiogroup" aria-label="Spur">' +
      '<button type="button" role="radio" data-spur="sofort" aria-checked="' + (spur === "sofort") + '"><b>Sofort-Spur</b><span>startet innerhalb einer Minute</span></button>' +
      '<button type="button" role="radio" data-spur="hintergrund" aria-checked="' + (spur === "hintergrund") + '"><b>Hintergrund-Spur</b><span>nach Priorität</span></button></div>' +
      '<select aria-label="Projekt"><option value="">Projekt: ordnet Claude zu</option>' + opt + "</select>" +
      '<button type="submit" class="tk-ja">Ticket anlegen</button></div></form>' +
      (meldung ? '<div class="tk-hinweis tk-hinweis--ok" role="status"><p>' + meldung + '</p><button type="button" data-ok>OK</button></div>' : "");
    GRUPPEN.forEach(function (g) {
      var l = tickets.filter(g[2]).sort(sortieren);
      if (!l.length) return;
      var zu = g[0] === "wartet" || g[0] === "neu";
      html += '<details class="tk-gruppe tk-gruppe--' + g[0] + '"' + (zu ? "" : " open") + '><summary>' + esc(g[1]) + " <span>" + l.length + "</span></summary>" +
        '<ul class="tk-liste">' + l.map(function (t) { return zeile(t, g[0]); }).join("") + "</ul></details>";
    });
    wurzel.innerHTML = html;
  }
  function bestaetigen(text) { meldung = text; laden(); }

  wurzel.addEventListener("click", function (e) {
    var auf = e.target.closest("[data-auf]"); if (auf) { auf.classList.toggle("is-offen"); return; }
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-ok")) { meldung = ""; zeichnen(); return; }
    if (b.dataset.spur) { spur = b.dataset.spur; wurzel.querySelectorAll("[data-spur]").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); }); return; }
    if (b.hasAttribute("data-stopp")) {
      var an = !stopp; b.disabled = true;
      db.from("steuerung_schalter").update({ an: an, grund: an ? "Stopp aus dem Dashboard" : null, gesetzt_am: new Date().toISOString() }).eq("name", "stopp")
        .then(function (r) { if (r.error) { alert("Stopp konnte nicht gesetzt werden: " + r.error.message); b.disabled = false; return; }
          bestaetigen(an ? "Stopp ist an. Was gerade läuft, wird noch fertig, Neues startet erst, wenn du fortsetzt." : "Stopp ist aus. Die Hintergrund-Spur arbeitet weiter."); });
      return;
    }
    var li = b.closest(".tk-ticket"); if (!li) return;
    var id = +li.dataset.id, t = tickets.filter(function (x) { return x.id === id; })[0], form = li.querySelector(".tk-text");
    if (b.dataset.aktion === "passt") {
      b.disabled = true;
      db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", id).then(function (r) {
        if (r.error) { alert(r.error.message); b.disabled = false; return; }
        db.from("vorlagen").update({ status: "erledigt", entscheidung: "ja", entschieden_am: new Date().toISOString() }).eq("aufgabe_id", id).eq("status", "offen").then(function () {
          bestaetigen("Abgenommen: „" + esc(t.titel) + "“ ist erledigt. Hängen Folge-Tickets daran, rücken sie nach.");
        });
      });
      return;
    }
    if (b.dataset.aktion === "zurueck" || b.dataset.aktion === "antworten") {
      // ein zweiter Klick auf denselben Knopf schließt das Feld wieder – kein eigener Abbrechen-Knopf
      if (!form.hidden && form.dataset.art === b.dataset.aktion) { form.hidden = true; b.setAttribute("aria-expanded", "false"); return; }
      form.hidden = false; form.dataset.art = b.dataset.aktion; b.setAttribute("aria-expanded", "true");
      var ta = form.querySelector("textarea");
      ta.placeholder = b.dataset.aktion === "zurueck" ? "Was fehlt oder soll anders sein?" : "Deine Antwort";
      form.querySelector("[type=submit]").textContent = b.dataset.aktion === "zurueck" ? "An Claude zurückgeben" : "Antwort an Claude";
      ta.focus(); return;
    }
    if (b.dataset.aktion === "vorziehen") {
      b.disabled = true;
      db.from("aufgaben").update({ ticket_spur: "sofort", ticket_prioritaet: "hoch", ticket_herkunft: t.ticket_herkunft === "chat" ? null : t.ticket_herkunft }).eq("id", id).then(function (r) {
        if (r.error) { alert(r.error.message); b.disabled = false; return; }
        bestaetigen("Vorgezogen: „" + esc(t.titel) + "“ läuft in der Sofort-Spur und startet innerhalb einer Minute.");
      });
    }
  });

  wurzel.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.hasAttribute("data-eingang")) {
      var text = f.querySelector("textarea").value.trim(), pid = f.querySelector("select").value;
      if (!text) { f.querySelector("textarea").focus(); return; }
      var knopf = f.querySelector("[type=submit]"); knopf.disabled = true;
      var titel = text.length > 90 ? text.slice(0, 87).replace(/\s+\S*$/, "") + " …" : text;
      db.from("aufgaben").insert({
        titel: titel, beschreibung: "Aus dem Eingang (Dashboard), " + new Date().toLocaleString("de-DE") + ":\n" + text,
        projekt_id: pid ? +pid : null, status: "offen", spalte: "todo", art: "aufgabe", verantwortlich: "Claude",
        ticket_stand: "bereit", ticket_spur: spur, ticket_herkunft: "eingang", ticket_prioritaet: spur === "sofort" ? "hoch" : "mittel",
        ticket_ergebnis: text, ticket_grenzen: "Mails nur als Entwurf, pushen nur auf Daniels Branches und ins Dashboard, kein Löschen, nichts, was Geld kostet."
      }).then(function (r) {
        knopf.disabled = false;
        if (r.error) { alert("Ticket konnte nicht angelegt werden: " + r.error.message); return; }
        bestaetigen(spur === "sofort"
          ? "Ticket angelegt. Sofort-Spur: Ich starte innerhalb einer Minute. Du bekommst eine Nachricht aufs Handy, sobald das Ergebnis zur Abnahme liegt."
          : "Ticket angelegt. Es liegt in der Hintergrund-Spur und läuft nach Priorität. Das Ergebnis kommt zur Abnahme hierher und auf die Steuerung.");
      });
      return;
    }
    if (f.classList.contains("tk-text")) {
      var li = f.closest(".tk-ticket"), id = +li.dataset.id, txt = f.querySelector("textarea").value.trim();
      if (!txt) return;
      var art = f.dataset.art, heute = new Date().toLocaleDateString("de-DE");
      db.from("aufgaben").update({ ticket_stand: "bereit", ticket_rueckmeldung: (art === "zurueck" ? "Rückgabe von Daniel (" : "Antwort von Daniel (") + heute + "): " + txt }).eq("id", id).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        db.from("vorlagen").update({ status: "erledigt", entscheidung: "anders", entscheidung_text: txt, entschieden_am: new Date().toISOString() }).eq("aufgabe_id", id).eq("status", "offen").then(function () {
          bestaetigen(art === "zurueck" ? "Zurückgegeben. Ich überarbeite das Ticket mit deinem Hinweis und lege es dir wieder zur Abnahme vor." : "Antwort gespeichert. Das Ticket ist wieder bereit und läuft weiter.");
        });
      });
    }
  });
})();
