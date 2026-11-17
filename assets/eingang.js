/* Eingang (Dashboard 2.0, Daniel, 17.11.2026) – Logik guter Steuerungssoftware: Eingang → Detail → Entscheidung.
   Eine Datenquelle (Datenbank-Sicht „eingang“: Tickets, Steuerungs-Karten, eigene Aufgaben, Postings, Termine, Wartendes),
   drei Darstellungen: <main data-ein="liste|fokus|plan">, dazu die Seite „Aufräumen“ (data-ein="aufraeumen").
   Die Knöpfe schreiben genau wie die bestehenden Seiten (tickets.js, steuerung.js), damit die stündliche Prüfung alles versteht. */
(function () {
  "use strict";
  var db = window.empiriaDb, el = document.querySelector("[data-ein]");
  if (!db || !el) return;
  var art = el.getAttribute("data-ein"), E = [], P = {}, auswahl = null, gruppe = "heute";
  var HEUTE = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  /* ---------- Hilfen ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function plus(n) { return new Date(new Date(HEUTE + "T12:00:00").getTime() + n * 864e5).toLocaleDateString("sv-SE"); }
  function datum(f) { return f ? f.slice(8, 10) + "." + f.slice(5, 7) + "." : ""; }
  function uhr(ts) { return ts ? new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : ""; }
  function absaetze(t) { return String(t || "").split(/\n+/).filter(Boolean).map(function (z) { return "<p>" + esc(z) + "</p>"; }).join(""); }
  var TYP = {
    abnahme: ["Abnahme", "cl"], rueckfrage: ["Rückfrage", "cl"], freigabe: ["Freigabe", "or"], termin: ["Termin", "bl"],
    aufgabe: ["Aufgabe", "sw"], entscheidung: ["Entscheiden", "gr"], ansehen: ["Ansehen", "gr"], info: ["Info", "gr"], wartet: ["Wartet", "gy"]
  };
  var GRUPPEN = [["heute", "Heute"], ["woche", "Diese Woche"], ["spaeter", "Später"], ["wartet", "Wartet auf andere"]];
  function gruppeVon(e) {
    if (e.typ === "wartet") return "wartet";
    if (e.typ === "abnahme" || e.typ === "rueckfrage" || e.typ === "termin") return "heute";
    if (e.frist && e.frist <= HEUTE) return "heute";
    if (e.typ === "freigabe" && e.frist && e.frist <= plus(2)) return "heute";
    if (e.frist && e.frist <= plus(7)) return "woche";
    return "spaeter";
  }
  function rang(e) { var o = { abnahme: 0, rueckfrage: 0, freigabe: 1, aufgabe: 2, termin: 3, entscheidung: 4, ansehen: 5, info: 6, wartet: 7 }; return o[e.typ]; }
  function sortieren(a, b) {
    if (a.typ === "termin" && b.typ === "termin") return String(a.angelegt).localeCompare(String(b.angelegt));
    return rang(a) - rang(b) || String(a.frist || "9").localeCompare(String(b.frist || "9")) || String(b.angelegt).localeCompare(String(a.angelegt));
  }
  function frist(e) {
    if (e.typ === "termin") { var s = e.extra && e.extra.start; return (s && s.slice(0, 10) === HEUTE ? "heute " : "morgen ") + uhr(s); }
    if (!e.frist) return "";
    if (e.frist < HEUTE) return '<span class="e-spaet">seit ' + datum(e.frist) + "</span>";
    if (e.frist === HEUTE) return "heute"; if (e.frist === plus(1)) return "morgen"; return "bis " + datum(e.frist);
  }
  function projekt(e) { var p = P[e.projekt_id]; return p ? p.name : (e.person && e.quelle === "posting" ? e.person : ""); }
  function schluessel(e) { return e.quelle + ":" + e.qid; }
  function marke(e) { var t = TYP[e.typ] || ["", "gy"]; return '<span class="e-typ e-' + t[1] + '">' + t[0] + "</span>"; }

  /* ---------- Laden ---------- */
  el.innerHTML = '<p class="e-laedt">Lädt …</p>';
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { el.innerHTML = '<p class="e-hinweis">Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden, dann erscheint hier dein Eingang.</p>'; return; }
    if (art === "aufraeumen") return aufraeumenLaden();
    Promise.all([db.from("eingang").select("*"), db.from("projekte").select("id, name, marke")]).then(function (r) {
      if (r[0].error) { el.innerHTML = '<p class="e-hinweis">Eingang konnte nicht geladen werden: ' + esc(r[0].error.message) + "</p>"; return; }
      var jetztMs = Date.now();
      E = (r[0].data || []).filter(function (e) { return !(e.typ === "termin" && e.extra && new Date(e.extra.ende || e.extra.start).getTime() < jetztMs); });
      (r[1].data || []).forEach(function (p) { P[p.id] = p; });
      E.forEach(function (e) { e.gruppe = gruppeVon(e); e.extra = e.extra || {}; });
      E.sort(sortieren);
      zeichnen();
    });
  });
  function inGruppe(g) { return E.filter(function (e) { return e.gruppe === g; }); }

  /* ---------- Detail je Art: genau die angeklickte Sache ---------- */
  function detail(e) {
    var x = e.extra, kopf = '<div class="e-d-kopf">' + marke(e) + '<span class="e-d-meta">' + esc(projekt(e)) + (frist(e) ? " · " + frist(e) : "") + "</span></div><h2>" + esc(e.titel) + "</h2>";
    var inhalt = "", knoepfe = "";
    if (e.typ === "abnahme") {
      inhalt = '<div class="e-block"><h3>Ergebnis</h3>' + absaetze(x.ergebnis || e.kern) + "</div>" +
        (x.ablage ? '<div class="e-block e-ablage"><h3>Ablage</h3><p>' + esc(x.ablage) + "</p></div>" : "") +
        (x.link ? '<p><a class="e-link" href="' + esc(x.link) + '" target="_blank" rel="noopener">Ergebnis öffnen</a></p>' : "");
      knoepfe = '<button class="e-k e-k-voll" data-a="passt">Passt</button><button class="e-k" data-a="text" data-modus="zurueck">Überarbeiten</button>';
    } else if (e.typ === "rueckfrage") {
      inhalt = '<div class="e-block e-frage"><h3>Claude fragt</h3>' + absaetze(x.rueckmeldung || e.kern || "Die Rückfrage ist leer. Schreibe Claude, was fehlt.") + "</div>";
      knoepfe = '<button class="e-k e-k-voll" data-a="text" data-modus="antwort">Antworten</button>';
    } else if (e.typ === "freigabe") {
      inhalt = '<div class="e-block e-posting">' + absaetze(e.kern) + "</div>" + (x.bild ? '<div class="e-block"><h3>Bild</h3><p>' + esc(x.bild) + "</p></div>" : "") +
        '<p class="e-klein">' + esc(x.kanal || "") + (x.zeit ? " · erscheint " + datum(String(x.zeit).slice(0, 10)) + " " + uhr(x.zeit) : "") + "</p>";
      knoepfe = '<button class="e-k e-k-voll" data-a="freigeben">Freigeben</button>';
    } else if (e.typ === "termin") {
      inhalt = '<div class="e-block"><h3>Wann</h3><p>' + uhr(x.start) + " bis " + uhr(x.ende) + (x.ort ? " · " + esc(x.ort) : "") + " · Kalender " + esc(x.postfach || "") + "</p></div>" +
        (e.person ? '<div class="e-block"><h3>Mit</h3><p>' + esc(e.person) + "</p></div>" : "") +
        '<div class="e-block"><h3>Vorbereitung</h3><p>' + ({ offen: "Noch nicht vorbereitet.", laeuft: "Vorbereitung läuft.", vorbereitet: "Vorbereitet.", nicht_noetig: "Keine Vorbereitung nötig." }[e.kern] || "Keine Vorbereitung hinterlegt.") + "</p>" + absaetze(e.vorschlag) + "</div>";
      knoepfe = e.projekt_id ? '<a class="e-k" href="/strategie/projekte.html#p=' + e.projekt_id + '">Projekt öffnen</a>' : "";
    } else if (e.typ === "aufgabe" || e.typ === "wartet") {
      inhalt = (e.kern ? '<div class="e-block">' + absaetze(e.kern) + "</div>" : "") + (e.vorschlag ? '<div class="e-block"><h3>Hinweis</h3>' + absaetze(e.vorschlag) + "</div>" : "") +
        (e.typ === "wartet" ? '<div class="e-block"><h3>Wartet auf</h3><p>' + esc(e.person || "nicht eingetragen") + (x.gesendet ? " · Mail gesendet am " + datum(String(x.gesendet).slice(0, 10)) : "") + "</p></div>" : "") +
        (x.mail_entwurf ? '<p class="e-klein">Ein Mail-Entwurf liegt in Outlook. Gesendet wird erst, wenn du im Chat „senden“ sagst.</p>' : "");
      knoepfe = '<button class="e-k e-k-voll" data-a="erledigt">' + (e.typ === "wartet" ? "Antwort ist da" : "Erledigt") + "</button>" +
        (e.projekt_id ? '<a class="e-k" href="/strategie/projekte.html#p=' + e.projekt_id + '">Projekt öffnen</a>' : "");
    } else {
      var punkte = Array.isArray(x.punkte) ? x.punkte : [];
      inhalt = '<div class="e-block">' + absaetze(e.kern) + "</div>" + (e.vorschlag ? '<div class="e-block e-vorschlag"><h3>Vorschlag von Claude</h3>' + absaetze(e.vorschlag) + "</div>" : "") +
        (punkte.length ? '<ul class="e-punkte">' + punkte.map(function (p) { return "<li>" + esc(typeof p === "string" ? p : (p.text || p.titel || JSON.stringify(p))) + "</li>"; }).join("") + "</ul>" : "") +
        (x.link ? '<p><a class="e-link" href="' + esc(x.link) + '" target="_blank" rel="noopener">Öffnen</a></p>' : "");
      knoepfe = e.typ === "info" ? '<button class="e-k e-k-voll" data-a="gelesen">Gelesen</button>'
        : '<button class="e-k e-k-voll" data-a="ja">' + esc(x.knopf || "Passt") + '</button><button class="e-k" data-a="text" data-modus="anders">Anders</button>';
    }
    return '<article class="e-detail" data-s="' + esc(schluessel(e)) + '">' + kopf + '<div class="e-inhalt">' + inhalt + '</div><div class="e-knoepfe">' + knoepfe +
      '</div><form class="e-text" hidden><textarea rows="4" placeholder="Diktieren oder schreiben"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></article>';
  }

  /* ---------- Knöpfe: schreiben wie die bestehenden Seiten ---------- */
  function jetzt() { return new Date().toISOString(); }
  function handeln(e, a, txt) {
    var heute = new Date().toLocaleDateString("de-DE"), q;
    if (e.quelle === "ticket" && a === "passt")
      q = db.from("aufgaben").update({ status: "erledigt", erledigt_am: jetzt() }).eq("id", e.qid).then(function (r) {
        return r.error ? r : db.from("vorlagen").update({ status: "erledigt", entscheidung: "ja", entschieden_am: jetzt() }).eq("aufgabe_id", e.qid).eq("status", "offen"); });
    else if (e.quelle === "ticket" && a === "text")
      q = db.from("aufgaben").update({ ticket_stand: "bereit", ticket_rueckmeldung: (e.typ === "abnahme" ? "Rückgabe von Daniel (" : "Antwort von Daniel (") + heute + "): " + txt }).eq("id", e.qid).then(function (r) {
        return r.error ? r : db.from("vorlagen").update({ status: "erledigt", entscheidung: "anders", entscheidung_text: txt, entschieden_am: jetzt() }).eq("aufgabe_id", e.qid).eq("status", "offen"); });
    else if (e.quelle === "vorlage" && a === "ja") q = db.from("vorlagen").update({ status: "entschieden", entscheidung: "ja", entschieden_am: jetzt() }).eq("id", e.qid);
    else if (e.quelle === "vorlage" && a === "text") q = db.from("vorlagen").update({ status: "entschieden", entscheidung: "anders", entscheidung_text: txt, entschieden_am: jetzt() }).eq("id", e.qid);
    else if (e.quelle === "vorlage" && a === "gelesen") q = db.from("vorlagen").update({ status: "erledigt", entscheidung: "gelesen", entschieden_am: jetzt() }).eq("id", e.qid);
    else if ((e.quelle === "aufgabe" || e.quelle === "wartet") && a === "erledigt") q = db.from("aufgaben").update({ status: "erledigt", erledigt_am: jetzt() }).eq("id", e.qid);
    else if (e.quelle === "posting" && a === "freigeben") q = db.from("beitraege").update({ status: "freigegeben" }).eq("id", e.qid);
    return q;
  }
  var MELDUNG = {
    passt: "Abgenommen. Das Ticket ist erledigt; hängen Folge-Tickets daran, rücken sie nach.",
    zurueck: "Zurückgegeben. Claude überarbeitet mit deinem Hinweis und legt es wieder zur Abnahme vor.",
    antwort: "Antwort gespeichert. Das Ticket läuft weiter.",
    ja: "Entschieden. Claude setzt es bei der nächsten Prüfung um.",
    anders: "Gespeichert. Claude setzt deinen Hinweis bei der nächsten Prüfung um.",
    gelesen: "Als gelesen abgelegt.", erledigt: "Erledigt.", freigeben: "Freigegeben. Das Posting erscheint wie geplant."
  };
  function verdrahten(wurzel, weiter) {
    wurzel.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-a]"); if (!b) return;
      var d = b.closest(".e-detail"), e = E.filter(function (x) { return schluessel(x) === d.getAttribute("data-s"); })[0]; if (!e) return;
      var a = b.getAttribute("data-a");
      if (a === "text") { var f = d.querySelector(".e-text"); f.hidden = !f.hidden; f.dataset.modus = b.getAttribute("data-modus"); if (!f.hidden) f.querySelector("textarea").focus(); return; }
      ausfuehren(d, e, a, null, a, weiter);
    });
    wurzel.addEventListener("submit", function (ev) {
      var f = ev.target.closest(".e-text"); if (!f) return; ev.preventDefault();
      var txt = f.querySelector("textarea").value.trim(); if (!txt) return;
      var d = f.closest(".e-detail"), e = E.filter(function (x) { return schluessel(x) === d.getAttribute("data-s"); })[0];
      ausfuehren(d, e, "text", txt, f.dataset.modus, weiter);
    });
  }
  function ausfuehren(d, e, a, txt, meldung, weiter) {
    d.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    var q = handeln(e, a, txt);
    if (!q) { d.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); return; }
    q.then(function (r) {
      if (r && r.error) { alert("Nicht gespeichert: " + r.error.message); d.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); return; }
      var ok = d.querySelector(".e-ok"); ok.textContent = MELDUNG[meldung] || "Gespeichert."; ok.hidden = false;
      E = E.filter(function (x) { return x !== e; });
      setTimeout(function () { weiter(e); }, 900);
    });
  }

  /* ---------- Gemeinsame Kopfzeile mit Gruppen ---------- */
  function reiter(kl) {
    return '<nav class="' + kl + '">' + GRUPPEN.map(function (g) {
      var n = inGruppe(g[0]).length;
      return '<button type="button" data-g="' + g[0] + '" aria-pressed="' + (g[0] === gruppe) + '">' + g[1] + "<span>" + n + "</span></button>";
    }).join("") + "</nav>";
  }
  function reiterVerdrahten(fn) {
    el.querySelectorAll("[data-g]").forEach(function (b) { b.onclick = function () { gruppe = b.getAttribute("data-g"); auswahl = null; fn(); }; });
  }
  function zeichnen() { if (art === "liste") liste(); else if (art === "fokus") fokus(); else if (art === "plan") plan(); }
  var verdrahtet = false;

  /* =============== Variante 1 · Posteingang (Liste links, Detail rechts) =============== */
  function liste() {
    var l = inGruppe(gruppe);
    if (!auswahl || l.indexOf(auswahl) < 0) auswahl = window.innerWidth > 900 ? l[0] || null : null;
    el.innerHTML = '<div class="e-l"><header class="e-l-kopf"><h1>Eingang</h1>' + reiter("e-reiter") + "</header>" +
      '<div class="e-l-raster' + (auswahl ? " hat-detail" : "") + '"><ul class="e-l-liste">' + (l.length ? l.map(function (e) {
        return '<li data-s="' + esc(schluessel(e)) + '"' + (e === auswahl ? ' aria-current="true"' : "") + ">" + marke(e) +
          '<div class="e-l-text"><b>' + esc(e.titel) + "</b><small>" + esc(projekt(e)) + "</small></div><span class=\"e-l-frist\">" + frist(e) + "</span></li>";
      }).join("") : '<li class="e-leer">Nichts in dieser Gruppe.</li>') + "</ul>" +
      '<section class="e-l-detail">' + (auswahl ? '<button type="button" class="e-zurueck" data-zurueck>‹ Eingang</button>' + detail(auswahl) : '<p class="e-leer">Wähle links einen Eintrag.</p>') + "</section></div>" +
      '<p class="e-tasten">Tasten: J und K wechseln den Eintrag.</p></div>';
    reiterVerdrahten(liste);
    el.querySelectorAll(".e-l-liste [data-s]").forEach(function (li) { li.onclick = function () { auswahl = E.filter(function (x) { return schluessel(x) === li.getAttribute("data-s"); })[0]; liste(); }; });
    var z = el.querySelector("[data-zurueck]"); if (z) z.onclick = function () { auswahl = null; liste(); };
    if (!verdrahtet) {
      verdrahtet = true;
      verdrahten(el, function (e) { var l2 = inGruppe(gruppe); auswahl = window.innerWidth > 900 ? l2[0] || null : null; liste(); });
      document.addEventListener("keydown", function (ev) {
        if (/input|textarea/i.test(ev.target.tagName)) return;
        var l2 = inGruppe(gruppe), i = l2.indexOf(auswahl);
        if (ev.key === "j" || ev.key === "ArrowDown") { auswahl = l2[Math.min(i + 1, l2.length - 1)]; liste(); ev.preventDefault(); }
        if (ev.key === "k" || ev.key === "ArrowUp") { auswahl = l2[Math.max(i - 1, 0)]; liste(); ev.preventDefault(); }
      });
    }
  }

  /* =============== Variante 2 · Fokus (eine Sache nach der anderen) =============== */
  var uebersprungen = [];
  function fokus() {
    var l = inGruppe(gruppe).filter(function (e) { return uebersprungen.indexOf(e) < 0; }).concat(inGruppe(gruppe).filter(function (e) { return uebersprungen.indexOf(e) >= 0; }));
    var e = l[0];
    el.innerHTML = '<div class="e-f"><header class="e-f-kopf">' + reiter("e-reiter e-reiter-dunkel") + "</header>" +
      (e ? '<div class="e-f-stand">' + (inGruppe(gruppe).length) + " offen in „" + GRUPPEN.filter(function (g) { return g[0] === gruppe; })[0][1] + "“</div>" +
        '<div class="e-f-karte">' + detail(e) + '<button type="button" class="e-f-weiter" data-weiter>Später ansehen</button></div>' +
        (l.length > 1 ? '<div class="e-f-danach"><h3>Danach</h3><ol>' + l.slice(1, 4).map(function (x) { return "<li>" + marke(x) + "<span>" + esc(x.titel) + "</span></li>"; }).join("") + "</ol></div>" : "")
        : '<div class="e-f-fertig"><h2>Alles erledigt.</h2><p>In dieser Gruppe liegt nichts mehr.</p></div>') + "</div>";
    reiterVerdrahten(function () { uebersprungen = []; fokus(); });
    var w = el.querySelector("[data-weiter]"); if (w) w.onclick = function () { uebersprungen.push(e); fokus(); };
    if (!verdrahtet) { verdrahtet = true; verdrahten(el, function () { fokus(); }); }
  }

  /* =============== Variante 3 · Plan (Spalten nach Zeit, Detail als Fenster) =============== */
  function plan() {
    el.innerHTML = '<div class="e-p"><header class="e-p-kopf"><h1>Eingang</h1><p>Was jetzt dran ist, was diese Woche kommt, was warten kann und was bei anderen liegt.</p></header><div class="e-p-spalten">' +
      GRUPPEN.map(function (g) {
        var l = inGruppe(g[0]);
        return '<section class="e-p-spalte e-p-' + g[0] + '"><h2>' + g[1] + "<span>" + l.length + "</span></h2>" + (l.length ? l.map(function (e) {
          return '<button type="button" class="e-p-karte" data-s="' + esc(schluessel(e)) + '">' + marke(e) + "<b>" + esc(e.titel) + "</b><small>" + esc(projekt(e)) + (frist(e) ? " · " + frist(e) : "") + "</small></button>";
        }).join("") : '<p class="e-leer">Nichts.</p>') + "</section>";
      }).join("") + '</div></div><div class="e-schleier" data-zu hidden></div><aside class="e-fenster" hidden></aside>';
    var f = el.querySelector(".e-fenster"), s = el.querySelector(".e-schleier");
    function zu() { f.hidden = true; s.hidden = true; }
    el.querySelectorAll(".e-p-karte").forEach(function (k) {
      k.onclick = function () {
        var e = E.filter(function (x) { return schluessel(x) === k.getAttribute("data-s"); })[0];
        f.innerHTML = '<button type="button" class="e-zu" aria-label="Schließen" data-zu>×</button>' + detail(e); f.hidden = false; s.hidden = false; f.scrollTop = 0;
      };
    });
    el.querySelectorAll("[data-zu]").forEach(function (z) { z.onclick = zu; });
    if (!verdrahtet) { verdrahtet = true; verdrahten(el, function () { plan(); }); document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { var x = el.querySelector(".e-fenster"); if (x) { x.hidden = true; el.querySelector(".e-schleier").hidden = true; } } }); }
  }

  /* =============== Aufräumen: Vorschlag bestätigen =============== */
  function aufraeumenLaden() {
    Promise.all([
      db.from("aufraeumen").select("vorlage_id, vorschlag, grund"),
      db.from("vorlagen").select("id, titel, angelegt_am, status").eq("status", "offen")
    ]).then(function (r) {
      if (r[0].error || r[1].error) { el.innerHTML = '<p class="e-hinweis">Konnte nicht laden: ' + esc((r[0].error || r[1].error).message) + "</p>"; return; }
      var offen = {}; (r[1].data || []).forEach(function (v) { offen[v.id] = v; });
      var l = (r[0].data || []).filter(function (a) { return offen[a.vorlage_id]; }).map(function (a) { a.v = offen[a.vorlage_id]; return a; });
      function block(vor, titel, an) {
        var x = l.filter(function (a) { return a.vorschlag === vor; }).sort(function (a, b) { return String(a.v.angelegt_am).localeCompare(String(b.v.angelegt_am)); });
        return '<section class="e-a-block"><h2>' + titel + "<span>" + x.length + "</span></h2>" + x.map(function (a) {
          return '<label class="e-a-zeile"><input type="checkbox" value="' + a.vorlage_id + '"' + (an ? " checked" : "") + '><span><b>' + esc(a.v.titel) + "</b><small>" + esc(a.grund) +
            " · Karte vom " + datum(String(a.v.angelegt_am).slice(0, 10)) + "</small></span></label>";
        }).join("") + "</section>";
      }
      el.innerHTML = '<div class="e-a"><header><h1>Aufräumen</h1><p>Mein Vorschlag zu den offenen Karten der Steuerung. Angehakt heißt: wird geschlossen. Nichts passiert, bevor du unten bestätigst.</p></header>' +
        block("schliessen", "Vorschlag: schließen", true) + block("behalten", "Vorschlag: behalten", false) +
        '<div class="e-a-fuss"><button type="button" class="e-k e-k-voll" data-schliessen>Angehakte Karten schließen</button><p class="e-ok" hidden></p></div></div>';
      el.querySelector("[data-schliessen]").onclick = function () {
        var ids = [].map.call(el.querySelectorAll(".e-a input:checked"), function (i) { return +i.value; });
        if (!ids.length) return;
        var b = this; b.disabled = true;
        db.from("vorlagen").update({ status: "erledigt", entscheidung: "gelesen", entscheidung_text: "Aufgeräumt am " + new Date().toLocaleDateString("de-DE"), entschieden_am: jetzt() }).in("id", ids).then(function (r2) {
          if (r2.error) { alert("Nicht gespeichert: " + r2.error.message); b.disabled = false; return; }
          var ok = el.querySelector(".e-a-fuss .e-ok"); ok.textContent = ids.length + " Karten geschlossen. Sie sind von der Steuerung und aus dem Eingang verschwunden."; ok.hidden = false;
          ids.forEach(function (id) { var i = el.querySelector('input[value="' + id + '"]'); if (i) i.closest("label").remove(); });
        });
      };
    });
  }
})();
