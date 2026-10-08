/* Marketing → Analyse und Entscheidung – Spiegel von Noahs Empfehlungen (analytics.empiria.de → Handeln → Empfehlungen), Noah ist die Quelle.
   Je Konto: Bearbeitungsstand, Filter nach Bereich, Karten mit Messpunkt, Alter (ab 14 Tagen rot, ab 21 verfällt bei Noah),
   „Warum diese Empfehlung“ und Übernehmen · Ablehnen (mit Begründung). Die Entscheidung geht über die Datenbank (wunsch, sync='ausstehend')
   an den Mac, der sie innerhalb einer Minute an Noahs Dashboard überträgt – dort startet die Nachprüfung nach 8 Wochen.
   Zusätzlich ein eigener Reiter mit Claudes markenübergreifender Analyse (lokal, Ja/Anders/Später). */
(function () {
  "use strict";
  var db = window.empiriaDb, ziel = document.querySelector("[data-mk-analyse]");
  if (!db || !ziel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var TABS = [["empiria", "empiria"], ["sofortsichtbar", "sofortsichtbar"], ["mueller-stroebel", "Müller&Ströbel."], ["uebergreifend", "Claude: markenübergreifend"]];
  var BEREICH = { website: "Website", seo: "SEO", linkedin: "LinkedIn", uebergreifend: "Übergreifend" };
  var KAT = { reichweite: "Reichweite", verweildauer: "Verweildauer", leads: "Anfragen", sitzungen: "Kanalzuordnung" };
  var GRUENDE = ["Datenbasis zu dünn", "Passt nicht zur Positionierung", "Aufwand lohnt sich nicht", "Ist bereits anders gelöst", "Später erneut vorlegen"];
  var wahl = "empiria", bereich = "alle", M = [], OFFEN = true, auf = {};
  try { wahl = localStorage.getItem("mk-analyse") || "empiria"; } catch (x) {}
  if (!TABS.some(function (t) { return t[0] === wahl; })) wahl = "empiria";

  db.auth.getSession().then(function (s) {
    if (!s.data.session) return;
    db.from("marketing_massnahmen").select("*").order("erfasst_am", { ascending: false }).then(function (r) { M = r.data || []; zeichnen(); });
  });
  function d(x) { return x ? new Date(String(x).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" }) : ""; }
  function alter(m) { return m.erfasst_am ? Math.floor((Date.now() - new Date(m.erfasst_am + "T12:00:00")) / 864e5) : 0; }
  function fenster(f) { var p = String(f || "").split(".."); return p.length === 2 ? "Daten " + new Date(p[0] + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + "–" + d(p[1]) : ""; }
  function st(m) { return m.quelle === "noah" ? (m.noah_status || "offen") : (m.status === "offen" ? "offen" : m.status === "verworfen" ? "abgelehnt" : "umgesetzt"); }

  function karte(m) {
    var s = st(m), a = alter(m), warten = m.quelle === "noah" && m.sync === "ausstehend", fehler = m.quelle === "noah" && m.sync === "fehler";
    var belege = (m.belege || []).map(function (b) { return "<li>" + esc(b.was) + ": <b>" + esc(b.wert) + "</b></li>"; }).join("");
    var warum = '<div class="ma-warum"' + (auf[m.id] ? "" : " hidden") + ">" + (m.massnahme ? "<p><b>Was:</b> " + esc(m.massnahme) + "</p>" : "") + (m.befund ? "<p><b>Warum:</b> " + esc(m.befund) + "</p>" : "") +
      (m.bedeutung ? "<p><b>Was es bedeutet:</b> " + esc(m.bedeutung) + "</p>" : "") + (m.wirkung ? "<p><b>Erwartete Wirkung:</b> " + esc(m.wirkung) + "</p>" : "") + (belege ? '<ul class="ma-belege">' + belege + "</ul>" : "") + "</div>";
    var stand = warten ? '<p class="ma-stand">Wird an Noahs Dashboard übertragen …</p>' : fehler ? '<p class="ma-stand ma-stand--fehler">Übertragung fehlgeschlagen – ich kümmere mich darum.</p>'
      : s === "umgesetzt" ? '<p class="ma-stand ma-stand--an">Übernommen' + (m.pruefen_am ? " · Nachprüfung ab " + d(m.pruefen_am) : "") + (m.ergebnis ? " · Ergebnis: " + esc(m.ergebnis) : "") + "</p>"
      : s === "abgelehnt" ? '<p class="ma-stand">Abgelehnt' + (m.begruendung || m.entscheidung_text ? ": " + esc(m.begruendung || m.entscheidung_text) : "") + "</p>"
      : s === "verfallen" ? '<p class="ma-stand">Verfallen – niemand hat hingesehen</p>' : "";
    var kn = s === "offen" && !warten ? '<div class="ma-knoepfe"><button type="button" class="ma-ja" data-ma-ja>Übernehmen</button><button type="button" data-ma-nein>Ablehnen</button></div>' +
      '<form class="kp-anders ma-grund" hidden><div class="ma-gruende">' + GRUENDE.map(function (g) { return '<button type="button" data-ma-g="' + esc(g) + '">' + esc(g) + "</button>"; }).join("") + "</div>" +
      '<textarea rows="2" placeholder="Oder eigene Begründung – ohne sie weiß später niemand mehr, warum."></textarea><div><button type="submit">Ablehnen</button><button type="button" data-kp-zu>Abbrechen</button></div></form>' : "";
    var meta = [BEREICH[m.bereich] || m.bereich, KAT[m.kategorie] || m.kategorie, m.erfasst_am ? "erfasst " + d(m.erfasst_am) : "", s === "offen" && m.erfasst_am ? "seit " + a + (a === 1 ? " Tag" : " Tagen") + " offen" : ""].filter(Boolean);
    var warumK = '<button type="button" class="ma-warum-k" data-ma-w aria-expanded="' + !!auf[m.id] + '">Warum diese Empfehlung<span class="ma-pfeil" aria-hidden="true"></span></button>';
    return '<article class="ma-k' + (s !== "offen" ? " ma-k--weg" : "") + '" data-ma="' + m.id + '">' +
      '<p class="ma-meta">' + meta.map(esc).join(" · ") + "</p>" +
      "<h4>" + esc(m.titel) + "</h4>" +
      (m.kennzahl ? '<div class="ma-mess"><span>Messpunkt</span><p>' + esc(m.kennzahl) + (m.vorher ? " – heute: " + esc(m.vorher) : "") + "</p>" + (m.fenster ? "<small>" + esc(fenster(m.fenster)) + "</small>" : "") + "</div>" : "") +
      stand +
      '<div class="ma-aktion">' + (kn ? kn.replace(/<form[\s\S]*$/, "") : "<span></span>") + warumK + "</div>" +
      (kn.indexOf("<form") > -1 ? kn.slice(kn.indexOf("<form")) : "") + warum + "</article>";
  }
  function zeichnen() {
    var l = M.filter(function (m) { return m.konto === wahl && (wahl === "uebergreifend" ? m.quelle === "claude" : m.quelle === "noah"); });
    var n = { offen: 0, umgesetzt: 0, abgelehnt: 0, verfallen: 0 }; l.forEach(function (m) { n[st(m)] = (n[st(m)] || 0) + 1; });
    var ent = n.umgesetzt + n.abgelehnt, pz = l.length ? Math.round(ent / l.length * 100) : 0;
    var bereiche = ["alle"].concat(Object.keys(BEREICH).filter(function (b) { return l.some(function (m) { return m.bereich === b; }); }));
    if (bereiche.indexOf(bereich) < 0 && bereich !== "abgelehnt") bereich = "alle";
    var sichtbar = l.filter(function (m) { return bereich === "alle" ? st(m) !== "abgelehnt" : bereich === "abgelehnt" ? st(m) === "abgelehnt" : m.bereich === bereich && st(m) !== "abgelehnt"; })
      .sort(function (a, b) { return (st(a) !== "offen") - (st(b) !== "offen"); });
    var offenAnz = function (k) { return M.filter(function (m) { return m.konto === k && (k === "uebergreifend" ? m.quelle === "claude" : m.quelle === "noah") && st(m) === "offen"; }).length; };
    ziel.innerHTML = '<section class="kt3-box kt3-breit kg-bereich' + (OFFEN ? "" : " pr-zu") + '"><h3><button type="button" class="pr-klapp" aria-expanded="' + OFFEN + '"><span>Analyse und Entscheidung</span><span class="tl-dreieck" aria-hidden="true"></span></button></h3>' +
      '<div class="kg-inhalt"><p class="kp-regel">Empfehlungen aus Noahs Analytics-Dashboard – dort wird weiterentwickelt, hier entscheidest du. Übernehmen startet die Nachprüfung nach acht Wochen.</p>' +
      '<div class="kp-filter">' + TABS.map(function (t) { var o = offenAnz(t[0]); return '<button type="button" data-ma-t="' + t[0] + '" aria-pressed="' + (wahl === t[0]) + '">' + esc(t[1]) + (o ? " (" + o + ")" : "") + "</button>"; }).join("") + "</div>" +
      '<div class="ma-stand-leiste"><div class="ma-balken"><i style="width:' + pz + '%"></i></div><p><b>' + pz + " %</b> entschieden · " + n.umgesetzt + " übernommen · " + n.abgelehnt + " abgelehnt · " + n.offen + " offen" + (n.verfallen ? " · " + n.verfallen + " verfallen" : "") + "</p></div>" +
      '<div class="ma-bereiche">' + bereiche.concat(n.abgelehnt ? ["abgelehnt"] : []).map(function (b) { return '<button type="button" data-ma-b="' + b + '" aria-pressed="' + (bereich === b) + '">' + (b === "alle" ? "Alle" : b === "abgelehnt" ? "Abgelehnt" : BEREICH[b]) + "</button>"; }).join("") + "</div>" +
      (sichtbar.length ? '<div class="ma-liste">' + sichtbar.map(karte).join("") + "</div>" : '<p class="kt3-leise">Nichts in dieser Auswahl.</p>') +
      (wahl !== "uebergreifend" ? '<p class="wk-stand">Quelle: <a href="https://analytics.empiria.de/' + wahl + '/empfehlungen" target="_blank" rel="noopener">Noahs Dashboard → Empfehlungen</a></p>' : "") + "</div></section>";
    verdrahten();
  }
  function verdrahten() {
    ziel.querySelector(".pr-klapp").onclick = function () { OFFEN = !OFFEN; zeichnen(); };
    ziel.querySelectorAll("[data-ma-t]").forEach(function (b) { b.onclick = function () { wahl = b.getAttribute("data-ma-t"); bereich = "alle"; try { localStorage.setItem("mk-analyse", wahl); } catch (x) {} zeichnen(); }; });
    ziel.querySelectorAll("[data-ma-b]").forEach(function (b) { b.onclick = function () { bereich = b.getAttribute("data-ma-b"); zeichnen(); }; });
    ziel.querySelectorAll(".ma-k").forEach(function (k) {
      var id = +k.getAttribute("data-ma"), m = M.filter(function (x) { return x.id === id; })[0], form = k.querySelector(".ma-grund");
      k.querySelector("[data-ma-w]").onclick = function () { auf[id] = !auf[id]; zeichnen(); };
      var ja = k.querySelector("[data-ma-ja]"), nein = k.querySelector("[data-ma-nein]");
      if (ja) ja.onclick = function () { entscheiden(m, "umgesetzt", "", k); };
      if (nein) nein.onclick = function () { form.hidden = !form.hidden; };
      if (form) {
        form.querySelectorAll("[data-ma-g]").forEach(function (g) { g.onclick = function () { entscheiden(m, "abgelehnt", g.getAttribute("data-ma-g"), k); }; });
        form.querySelector("[data-kp-zu]").onclick = function () { form.hidden = true; };
        form.onsubmit = function (ev) { ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (t) entscheiden(m, "abgelehnt", t, k); };
      }
    });
  }
  function entscheiden(m, art, grund, k) {
    var felder = m.quelle === "noah"
      ? { wunsch: art, entscheidung_text: grund || null, sync: "ausstehend", entschieden_am: new Date().toISOString() }
      : (art === "umgesetzt" ? { status: "entschieden", entscheidung: "ja", entschieden_am: new Date().toISOString(), pruefen_am: new Date(Date.now() + 56 * 864e5).toISOString().slice(0, 10) }
                             : { status: "verworfen", entscheidung: "anders", entscheidung_text: grund, entschieden_am: new Date().toISOString() });
    k.classList.add("laedt");
    db.from("marketing_massnahmen").update(felder).eq("id", m.id).then(function (r) {
      k.classList.remove("laedt"); if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      for (var x in felder) m[x] = felder[x]; zeichnen();
    });
  }
})();
