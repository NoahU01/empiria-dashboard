/* Marketing → Analyse und Entscheidung: Befund → Bedeutung → Maßnahme → Erwartung → Messpunkt, entscheiden mit Ja · Anders · Später.
   Quellen: Noahs Empfehlungen je Marke (täglich übernommen) und Claudes übergreifende Analyse (Tabelle marketing_massnahmen).
   Ja → status 'entschieden', Prüfung in acht Wochen; die stündliche Prüfung macht daraus Aufgaben und prüft später die Wirkung. */
(function () {
  "use strict";
  var db = window.empiriaDb, ziel = document.querySelector("[data-mk-analyse]");
  if (!db || !ziel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var TABS = [["uebergreifend", "Übergreifend"], ["empiria", "empiria"], ["sofortsichtbar", "sofortsichtbar"], ["mueller-stroebel", "Müller&Ströbel."]];
  var BEREICH = { website: "Website", seo: "Google", linkedin: "LinkedIn", uebergreifend: "Übergreifend" };
  var wahl = "uebergreifend", M = [], OFFEN = true;
  try { wahl = localStorage.getItem("mk-analyse") || "uebergreifend"; } catch (x) {}

  db.auth.getSession().then(function (s) {
    if (!s.data.session) return;
    db.from("marketing_massnahmen").select("*").neq("status", "verworfen").order("rang").then(function (r) { M = r.data || []; zeichnen(); });
  });
  function datum(d) { return d ? new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" }) : ""; }
  function karte(m) {
    var zeile = function (k, v) { return v ? '<div class="ma-z"><dt>' + k + "</dt><dd>" + esc(v) + "</dd></div>" : ""; };
    var stand = m.status === "offen" ? (m.entscheidung === "spaeter" ? '<p class="ma-stand">Zurückgestellt</p>' : "")
      : m.status === "verworfen" ? "" : '<p class="ma-stand ma-stand--an">' + (m.entscheidung === "anders" ? "An Claude gegeben: „" + esc(m.entscheidung_text) + "“" : "Entschieden – Maßnahme läuft") + (m.pruefen_am ? " · Prüfung am " + datum(m.pruefen_am) : "") + (m.ergebnis ? "<br>Ergebnis: " + esc(m.ergebnis) : "") + "</p>";
    return '<article class="ma-k' + (m.status !== "offen" ? " ma-k--weg" : m.entscheidung === "spaeter" ? " ma-k--spaeter" : "") + '" data-ma="' + m.id + '">' +
      '<div class="ma-kopf"><span class="ma-tag">' + esc(BEREICH[m.bereich] || m.bereich || "") + '</span><span class="ma-quelle">' + (m.quelle === "noah" ? "Empfehlung aus Noahs Dashboard " + esc(m.ref || "") : "Claude · übergreifende Analyse") + "</span></div>" +
      "<h4>" + esc(m.titel) + "</h4><dl>" + zeile("Was wir sehen", m.befund) + zeile("Was es bedeutet", m.bedeutung) + zeile("Was wir tun", m.massnahme) + zeile("Was wir erwarten", m.wirkung) +
      zeile("Woran wir es messen", m.kennzahl ? m.kennzahl + (m.vorher ? " – heute: " + m.vorher : "") : "") + "</dl>" + stand +
      (m.status === "offen" ? '<div class="kp-knoepfe ma-knoepfe"><button type="button" data-ma-e="ja">Ja, machen</button><button type="button" data-ma-anders>Anders …</button><button type="button" data-ma-e="spaeter">Später</button></div>' +
        '<form class="kp-anders" hidden><textarea rows="3" placeholder="Was soll stattdessen passieren?"></textarea><div><button type="submit">An Claude geben</button><button type="button" data-kp-zu>Abbrechen</button></div></form>' : "") + "</article>";
  }
  function zeichnen() {
    var l = M.filter(function (m) { return m.konto === wahl; });
    var offen = l.filter(function (m) { return m.status === "offen"; }).sort(function (a, b) { return (a.entscheidung === "spaeter") - (b.entscheidung === "spaeter") || a.rang - b.rang; });
    var weg = l.filter(function (m) { return m.status !== "offen"; });
    var anz = function (k) { return M.filter(function (m) { return m.konto === k && m.status === "offen" && m.entscheidung !== "spaeter"; }).length; };
    ziel.innerHTML = '<section class="kt3-box kt3-breit kg-bereich' + (OFFEN ? "" : " pr-zu") + '"><h3><button type="button" class="pr-klapp" aria-expanded="' + OFFEN + '"><span>Analyse und Entscheidung</span><span class="tl-dreieck" aria-hidden="true"></span></button></h3>' +
      '<div class="kg-inhalt"><p class="kp-regel">Aus den Zahlen abgeleitet: was wir sehen, was es bedeutet, was wir tun – und woran wir in acht Wochen prüfen, ob es gewirkt hat.</p>' +
      '<div class="kp-filter">' + TABS.map(function (t) { var n = anz(t[0]); return '<button type="button" data-ma-t="' + t[0] + '" aria-pressed="' + (wahl === t[0]) + '">' + esc(t[1]) + (n ? " (" + n + ")" : "") + "</button>"; }).join("") + "</div>" +
      (offen.length ? '<div class="ma-liste">' + offen.map(karte).join("") + "</div>" : '<p class="kt3-leise">Nichts offen.</p>') +
      (weg.length ? '<h4 class="ma-h">Entschieden und in Arbeit</h4><div class="ma-liste">' + weg.map(karte).join("") + "</div>" : "") + "</div></section>";
    ziel.querySelector(".pr-klapp").onclick = function () { OFFEN = !OFFEN; zeichnen(); };
    ziel.querySelectorAll("[data-ma-t]").forEach(function (b) { b.onclick = function () { wahl = b.getAttribute("data-ma-t"); try { localStorage.setItem("mk-analyse", wahl); } catch (x) {} zeichnen(); }; });
    ziel.querySelectorAll(".ma-k").forEach(function (k) {
      var id = +k.getAttribute("data-ma"), form = k.querySelector(".kp-anders");
      k.querySelectorAll("[data-ma-e]").forEach(function (b) {
        b.onclick = function () {
          var ja = b.getAttribute("data-ma-e") === "ja", in8 = new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10);
          speichern(id, ja ? { status: "entschieden", entscheidung: "ja", entschieden_am: new Date().toISOString(), pruefen_am: in8 } : { entscheidung: "spaeter" }, k);
        };
      });
      var an = k.querySelector("[data-ma-anders]"); if (an) an.onclick = function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("textarea").focus(); };
      if (form) { form.querySelector("[data-kp-zu]").onclick = function () { form.hidden = true; };
        form.onsubmit = function (ev) { ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (t) speichern(id, { status: "entschieden", entscheidung: "anders", entscheidung_text: t, entschieden_am: new Date().toISOString() }, k); }; }
    });
  }
  function speichern(id, felder, k) {
    k.classList.add("laedt");
    db.from("marketing_massnahmen").update(felder).eq("id", id).then(function (r) {
      k.classList.remove("laedt"); if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      M.forEach(function (m) { if (m.id === id) for (var x in felder) m[x] = felder[x]; }); zeichnen();
    });
  }
})();
