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
  /* Gliederung dichter Texte (Daniel, 18.11.2026: „strukturierter darstellen“) */
  function saetze(t) {
    t = String(t || "").trim(); if (!t) return [];
    if (t.indexOf("\n") >= 0) return t.split(/\n+/).map(function (z) { return z.replace(/^[-•]\s*/, "").trim(); }).filter(Boolean);
    return t.replace(/([.!?“])\s+(?=[A-ZÄÖÜ„])/g, "$1\u0001").split("\u0001").filter(Boolean);   /* ohne Lookbehind: läuft auch in älterem Safari */
  }
  /* Mehrzeiliger Text (Daniel, 18.11.2026: „kein kompletter Textblock … thematisch unterteilen“): Zeile mit Doppelpunkt am Ende = Zwischenüberschrift,
     „•“/„-“ = Aufzählung, „1.“ = Schritte, „Thema: Satz“ = Themenzeile mit fettem Thema */
  function zeilenText(t) {
    var h = "", liste = null, art = "";
    var zu = function () { if (liste) { h += (art === "ol" ? '<ol class="tm-schritte">' : '<ul class="tm-liste-f">') + liste.join("") + (art === "ol" ? "</ol>" : "</ul>"); liste = null; } };
    // Fett nur für ein Stichwort vor dem Doppelpunkt: in Schritten bis 90 Zeichen, in Aufzählungen bis 30 (sonst ist es ein Satz)
    var thema = function (x, max) { var m = x.match(new RegExp("^([^:]{2," + (max || 90) + "}):\\s+([\\s\\S]+)$")); return m ? "<b>" + esc(m[1]) + "</b> " + esc(m[2]) : esc(x); };
    String(t).split(/\n+/).map(function (z) { return z.trim(); }).filter(Boolean).forEach(function (z) {
      var a = /^[•\-–]\s+/.test(z) ? "ul" : /^\d+\.\s/.test(z) ? "ol" : "";
      if (a) { if (art !== a) zu(); art = a; liste = liste || []; liste.push("<li>" + thema(z.replace(/^([•\-–]|\d+\.)\s+/, ""), a === "ol" ? 90 : 30) + "</li>"); return; }
      if (/^#{1,4}\s+/.test(z)) { zu(); h += '<p class="tm-zwischen">' + esc(z.replace(/^#{1,4}\s+/, "")) + "</p>"; return; }
      zu(); h += /:$/.test(z) ? '<p class="tm-zwischen">' + esc(z.replace(/:$/, "")) + "</p>" : '<p class="tm-themenzeile">' + thema(z) + "</p>";
    });
    zu(); return h;
  }
  /* Zusammenfassung und Ziel: mehrzeilig als Themenzeilen bzw. Aufzählung; ältere Einzelabsätze in Sätze aufgeteilt */
  function themenText(t, alsListe) {
    t = String(t || "").trim();
    if (/\n/.test(t)) {
      var z = t.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      return alsListe ? '<ul class="tm-liste-f">' + z.map(function (x) { return "<li>" + esc(x.replace(/^[•\-–]\s+/, "")) + "</li>"; }).join("") + "</ul>" : zeilenText(t);
    }
    var s = saetze(t);
    return s.length >= 2 ? '<ul class="tm-liste-f">' + s.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>" + esc(t) + "</p>";
  }
  function gegliedert(t) {
    t = String(t || "").trim();
    if (/\n/.test(t) || /^[•\-–]\s/.test(t)) return zeilenText(t);
    if (/^„/.test(t)) return "<p>" + esc(t) + "</p>";   /* wörtliches Zitat (z. B. Einstieg) bleibt ein Absatz */
    var schritte = t.split(/\s*(?:^|\s)(?=\d\.\s)/).filter(function (x) { return /^\d\.\s/.test(x); });
    if (schritte.length >= 2) return '<ol class="tm-schritte">' + schritte.map(function (x) { var m = x.replace(/^\d\.\s*/, "").match(/^([^:(]{2,60}(?:\([^)]*\))?):\s*([\s\S]*)$/);
      return "<li>" + (m ? "<b>" + esc(m[1]) + "</b> " + esc(m[2]) : esc(x.replace(/^\d\.\s*/, ""))) + "</li>"; }).join("") + "</ol>";
    var fragen = t.replace(/(\?)\s+(?=[A-ZÄÖÜ„])/g, "$1\u0001").split("\u0001");
    if (fragen.length >= 2 && fragen.every(function (x) { return /\?\s*“?$/.test(x); })) return '<ul class="tm-liste-f">' + fragen.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    var l = saetze(t);
    return l.length >= 3 ? '<ul class="tm-liste-f">' + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>" + esc(t) + "</p>";
  }
  // Technische Zuordnungen (Kalender-ID, Projekt- und Termin-Nummer) sind für Claude, nicht für Daniel – nicht anzeigen
  function ohneTechnik(t) { return String(t || "").split(/\n/).filter(function (z) { return !/^\s*(graph_id|projekt_id|termin_id|ical_uid|ticket_id)\s*:/i.test(z); }).join("\n")
    .replace(/\s*\((?:termin|projekt_punkte|projekt_id|aufgabe|ereignis|ticket|id)\b[^)]*\d[^)]*\)/gi, "").trim(); }
  function absaetze(t) { return ohneTechnik(t).split(/\n+/).filter(Boolean).map(function (z) { return "<p>" + esc(z) + "</p>"; }).join(""); }
  var TYP = {
    impuls: ["Empfehlung", "cl"], nachbereitung: ["Wie lief es?", "bl"], abnahme: ["Abnahme", "cl"], rueckfrage: ["Rückfrage", "cl"], freigabe: ["Freigabe", "or"], termin: ["Termin", "bl"],
    aufgabe: ["Aufgabe", "sw"], entscheidung: ["Entscheiden", "gr"], ansehen: ["Ansehen", "gr"], info: ["Info", "gr"], wartet: ["Wartet", "gy"]
  };
  var GRUPPEN = [["heute", "Heute"], ["woche", "Diese Woche"], ["spaeter", "Später"], ["wartet", "Wartet auf andere"]];
  /* Eine Zählweise überall (Daniel, 20.11.2026: „Die Werte passen nicht zueinander“): „Wartet auf dich“ = was jetzt einen Schritt von
     Daniel braucht. Dieselbe Zahl am Menüpunkt, im Eingang (Kopf und Knopf „Heute“) und im Briefing. Termine stehen unter „Heute“, zählen nicht. */
  function wartetAufDich(e) {
    return e.typ === "impuls" || e.typ === "abnahme" || e.typ === "rueckfrage" || e.typ === "nachbereitung" || e.typ === "entscheidung" ||
      (e.typ === "freigabe" && !!e.frist && e.frist <= plus(2)) || (e.typ === "aufgabe" && !!e.frist && e.frist <= HEUTE);
  }
  function anzahl(g) { return g === "heute" ? E.filter(wartetAufDich).length : inGruppe(g).length; }
  function gruppeVon(e) {
    if (e.typ === "wartet") return "wartet";
    if (wartetAufDich(e) || e.typ === "termin") return "heute";
    if (e.frist && e.frist <= plus(7)) return "woche";
    return "spaeter";
  }
  function rang(e) { var o = { impuls: -1, abnahme: 0, rueckfrage: 0, nachbereitung: 1, freigabe: 1, aufgabe: 2, entscheidung: 4, ansehen: 5, info: 6, wartet: 7, termin: 9 }; return o[e.typ]; }
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
  // im Detail: Rot nur bei echter Frist (Aufgabe, Freigabe), sonst das Datum grau (Daniel, 21.11.2026)
  function detailFrist(e) {
    if (e.typ === "termin" || e.typ === "aufgabe" || e.typ === "freigabe" || e.typ === "wartet" || !e.frist) return frist(e);
    return e.frist < HEUTE ? "seit " + datum(e.frist) : frist(e);
  }
  function projekt(e) { var p = P[e.projekt_id]; return p ? p.name : (e.person && e.quelle === "posting" ? e.person : ""); }
  function schluessel(e) { return e.quelle + ":" + e.qid; }
  function marke(e) { var t = TYP[e.typ] || ["", "gy"]; return '<span class="e-typ e-' + t[1] + '">' + t[0] + (nr(e) ? " " + nr(e) : "") + "</span>"; }

  /* ---------- Laden ---------- */
  el.innerHTML = '<p class="e-laedt">Lädt …</p>';
  db.auth.getSession().then(function (s) {
    if (!s.data.session) { el.innerHTML = '<p class="e-hinweis">Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden, dann erscheint hier dein Eingang.</p>'; return; }
    if (art === "aufraeumen") return aufraeumenLaden();
    if (art === "lage") return lageLaden();
    if (art === "projekt") return projektLaden();
    if (art === "termine") return termineLaden();
    if (art === "strategie") return strategieLaden();
    if (art === "marketing") return marketingLaden();
    if (art === "vertrieb") return vertriebLaden();
    Promise.all([db.from("eingang").select("*"), db.from("projekte").select("id, name, marke")]).then(function (r) {
      if (r[0].error) { el.innerHTML = '<p class="e-hinweis">Eingang konnte nicht geladen werden: ' + esc(r[0].error.message) + "</p>"; return; }
      var jetztMs = Date.now();
      E = (r[0].data || []).filter(function (e) { return !(e.typ === "termin" && e.extra && new Date(e.extra.ende || e.extra.start).getTime() < jetztMs); });
      (r[1].data || []).forEach(function (p) { P[p.id] = p; });
      E.forEach(function (e) { e.gruppe = gruppeVon(e); e.extra = e.extra || {}; });
      E.sort(sortieren);
      var m = location.hash.match(/s=([a-z]+:\d+)/);
      if (m) { var z = E.filter(function (e) { return schluessel(e) === m[1]; })[0]; if (z) { gruppe = z.gruppe; auswahl = z; } }
      kennungen(zeichnen);
    });
  });
  function inGruppe(g) { return E.filter(function (e) { return e.gruppe === g; }); }
  /* Kurze Kennung je Eintrag (Daniel, 20.11.2026: „Empfehlung 36 … dass du sofort weißt, welche ich meine“): fortlaufende Nummer aus
     eingang_kennung, eindeutig über alle Arten. Neue Einträge bekommen beim ersten Anzeigen ihre Nummer. */
  var KN = {};
  function nr(e) { return KN[e.quelle + ":" + e.qid] || ""; }
  function kennung(e) { var n = nr(e); return n ? (TYP[e.typ] || ["Eintrag"])[0] + " " + n : ""; }
  function kennungen(fertig) {
    var merk = function (l) { (l || []).forEach(function (k) { KN[k.quelle + ":" + k.qid] = k.nr; }); };
    db.from("eingang_kennung").select("nr, quelle, qid").order("nr", { ascending: false }).limit(5000).then(function (r) {
      merk(r.data);
      var fehlt = E.filter(function (e) { return e.qid != null && !nr(e); }).map(function (e) { return { quelle: e.quelle, qid: e.qid }; });
      var q = db.from("eingang_kennung");
      if (!fehlt.length || typeof q.upsert !== "function") return fertig();
      q.upsert(fehlt, { onConflict: "quelle,qid", ignoreDuplicates: true }).then(function () {
        db.from("eingang_kennung").select("nr, quelle, qid").order("nr", { ascending: false }).limit(5000).then(function (r2) { merk(r2.data); fertig(); });
      });
    });
  }

  /* ---------- Detail je Art: genau die angeklickte Sache ---------- */
  function detail(e) {
    var x = e.extra, kopf = '<div class="e-d-kopf">' + marke(e) + '<span class="e-d-meta">' + esc(projekt(e)) + (detailFrist(e) ? " · " + detailFrist(e) : "") + "</span></div><h2>" + esc(e.titel) + "</h2>";
    var inhalt = "", knoepfe = "";
    if (e.typ === "impuls") {
      inhalt = '<div class="e-block e-vorschlag"><h3>Empfehlung von Claude als Stabschef</h3>' + absaetze(e.kern) + "</div>" +
        (x.knopf ? '<p class="e-klein">Mit „' + esc(x.knopf) + '“ setzt Claude die Empfehlung um, als Ticket in der Sofort-Spur.</p>' : "");
      knoepfe = '<button class="e-k e-k-voll" data-a="ja">' + esc(x.knopf || "Passt, umsetzen") + '</button><button class="e-k" data-a="text" data-modus="anders">Anders</button>';
    } else if (e.typ === "nachbereitung") {
      inhalt = '<div class="e-block"><h3>Termin</h3><p>' + datum(e.frist) + ", " + uhr(x.start) + " bis " + uhr(x.ende) + (e.person ? " · mit " + esc(e.person) : "") + "</p></div>" +
        '<div class="e-block e-vorschlag"><h3>Wie lief es?</h3><p>Diktiere kurz, was besprochen und entschieden wurde und wer was bis wann macht. Claude legt daraus Protokollpunkte und Aufgaben im Projekt an.</p></div>';
      knoepfe = '<button class="e-k e-k-voll" data-a="text" data-modus="protokoll">Protokoll diktieren</button><button class="e-k" data-a="nichts">Nichts festzuhalten</button>';
    } else if (e.typ === "abnahme") {
      inhalt = '<div class="e-block"><h3>Ergebnis</h3>' + absaetze(x.ergebnis || e.kern) + "</div>" +
        (x.ablage ? '<div class="e-block e-ablage"><h3>Ablage</h3><p>' + esc(ohneTechnik(x.ablage)) + "</p></div>" : "") +
        (x.link ? '<p><a class="e-link" href="' + esc(x.link) + '" target="_blank" rel="noopener">Ergebnis öffnen</a></p>' : "");
      knoepfe = '<button class="e-k e-k-voll" data-a="passt">Passt</button><button class="e-k" data-a="text" data-modus="zurueck">Überarbeiten</button>';
    } else if (e.typ === "rueckfrage") {
      inhalt = '<div class="e-block e-frage"><h3>Claude fragt</h3>' + absaetze(x.rueckmeldung || e.kern || "Die Rückfrage ist leer. Schreibe Claude, was fehlt.") + "</div>";
      knoepfe = '<button class="e-k e-k-voll" data-a="text" data-modus="antwort">Antworten</button>';
    } else if (e.typ === "freigabe") {
      inhalt = '<div class="e-block e-posting">' + absaetze(e.kern) + "</div>" + (x.bild ? '<div class="e-block"><h3>Bild</h3><p>' + esc(x.bild) + "</p></div>" : "") +
        '<p class="e-klein">' + esc(x.kanal || "") + (x.zeit ? " · erscheint " + datum(String(x.zeit).slice(0, 10)) + " " + uhr(x.zeit) : "") + "</p>";
      knoepfe = '<button class="e-k e-k-voll" data-a="freigeben">Freigeben</button><button class="e-k" data-a="text" data-modus="hinweis">Überarbeiten</button>';
    } else if (e.typ === "termin") {
      inhalt = '<div class="e-block"><h3>Wann</h3><p>' + uhr(x.start) + " bis " + uhr(x.ende) + (x.ort ? " · " + esc(x.ort) : "") + " · " + ((x.kalender === "Aufgaben" || x.kalender === "Block") ? "dein Arbeitsblock" : "Kalender " + esc(x.postfach || "")) + "</p></div>" +
        (e.person ? '<div class="e-block"><h3>Mit</h3><p>' + esc(e.person) + "</p></div>" : "") +
        '<div class="e-block"><h3>Vorbereitung</h3><p>' + ({ offen: "Noch nicht vorbereitet.", laeuft: "Vorbereitung läuft.", vorbereitet: "Vorbereitet.", nicht_noetig: "Keine Vorbereitung nötig." }[e.kern] || "Keine Vorbereitung hinterlegt.") + "</p>" + absaetze(e.vorschlag) + "</div>";
      knoepfe = '<button class="e-k e-k-voll" data-a="text" data-modus="hinweis">Hinweis an Claude</button>' + (e.projekt_id ? '<a class="e-k" href="/strategie/projekte.html#p=' + e.projekt_id + '">Projekt öffnen</a>' : "");
    } else if (e.typ === "aufgabe" || e.typ === "wartet") {
      inhalt = (e.kern ? '<div class="e-block">' + absaetze(e.kern) + "</div>" : "") + (e.vorschlag ? '<div class="e-block"><h3>Hinweis</h3>' + absaetze(e.vorschlag) + "</div>" : "") +
        (e.typ === "wartet" ? '<div class="e-block"><h3>Wartet auf</h3><p>' + esc(e.person || "nicht eingetragen") + (x.gesendet ? " · Mail gesendet am " + datum(String(x.gesendet).slice(0, 10)) : "") + "</p></div>" : "") +
        (x.mail_entwurf ? '<p class="e-klein">Ein Mail-Entwurf liegt in Outlook. Gesendet wird erst, wenn du im Chat „senden“ sagst.</p>' : "");
      knoepfe = '<button class="e-k e-k-voll" data-a="erledigt">' + (e.typ === "wartet" ? "Antwort ist da" : "Erledigt") + '</button><button class="e-k" data-a="text" data-modus="hinweis">' + (e.typ === "wartet" ? "Nachhaken lassen" : "Hinweis an Claude") + "</button>" +
        (e.projekt_id ? '<a class="e-k" href="/strategie/projekte.html#p=' + e.projekt_id + '">Projekt öffnen</a>' : "");
    } else {
      var punkte = Array.isArray(x.punkte) ? x.punkte : [];
      inhalt = '<div class="e-block">' + absaetze(e.kern) + "</div>" + (e.vorschlag ? '<div class="e-block e-vorschlag"><h3>Vorschlag von Claude</h3>' + absaetze(e.vorschlag) + "</div>" : "") +
        (punkte.length ? '<ul class="e-punkte">' + punkte.map(function (p) { return "<li>" + esc(typeof p === "string" ? p : (p.text || p.titel || JSON.stringify(p))) + "</li>"; }).join("") + "</ul>" : "") +
        (x.link ? '<p><a class="e-link" href="' + esc(x.link) + '" target="_blank" rel="noopener">Öffnen</a></p>' : "");
      knoepfe = e.typ === "info" ? '<button class="e-k e-k-voll" data-a="gelesen">Gelesen</button><button class="e-k" data-a="text" data-modus="anders">Antworten</button>'
        : '<button class="e-k e-k-voll" data-a="ja">' + esc(x.knopf || "Passt") + '</button><button class="e-k" data-a="text" data-modus="anders">Anders</button>';
    }
    return '<article class="e-detail" data-s="' + esc(schluessel(e)) + '">' + kopf + '<div class="e-inhalt">' + inhalt + '</div><div class="e-knoepfe">' + knoepfe +
      '</div><form class="e-text" hidden><textarea rows="4" placeholder="Diktieren oder schreiben"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></article>';
  }

  /* ---------- Knöpfe: schreiben wie die bestehenden Seiten ---------- */
  function jetzt() { return new Date().toISOString(); }
  function ticket(e, text, titel) {
    titel = titel || (text.length > 80 ? text.slice(0, 77).replace(/\s+\S*$/, "") + " …" : text);
    if (titel.length > 90) titel = titel.slice(0, 87).replace(/\s+\S*$/, "") + " …";
    return db.from("aufgaben").insert({
      titel: titel, beschreibung: "Aus dem Eingang (Dashboard), " + new Date().toLocaleString("de-DE") + ", zu „" + e.titel + "“ (" + e.quelle + " " + e.qid + (kennung(e) ? ", " + kennung(e) : "") + "):\n" + text,
      projekt_id: e.projekt_id || null, status: "offen", spalte: "todo", art: "aufgabe", verantwortlich: "Claude",
      ticket_stand: "bereit", ticket_spur: "sofort", ticket_herkunft: "eingang", ticket_prioritaet: "hoch",
      ticket_ergebnis: text + "\n\nBezug: „" + e.titel + "“ (" + e.quelle + " " + e.qid + ").",
      ticket_grenzen: "Mails nur als Entwurf, pushen nur auf Daniels Branches und ins Dashboard, kein Löschen, nichts, was Geld kostet."
    });
  }
  function protokollTicket(t, pid, txt) {
    var nach = new Date(t.ende).getTime() < Date.now();
    return ticket({ titel: t.betreff, quelle: "termin", qid: t.id, projekt_id: pid || null },
      (nach ? "Protokoll" : "Input") + " von Daniel zum Termin „" + t.betreff + "“ am " + datum(iso2(t.start)) + " " + uhr(t.start) + ":\n\n" + txt +
      "\n\ngraph_id: " + (t.graph_id || "") + "\nprojekt_id: " + (pid || "unbekannt") + "\ntermin_id: " + t.id,
      (nach ? "Protokoll: " : "Input: ") + t.betreff);
  }
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
    else if (e.quelle === "briefing" && (a === "ja" || a === "text"))
      q = ticket(e, a === "ja" ? "Auftrag von Daniel: Ja zur Empfehlung „" + e.titel + "“ (" + (e.extra.knopf || "umsetzen") + "). Setze sie um. Inhalt: " + (e.kern || "") : "Auftrag von Daniel zur Empfehlung „" + e.titel + "“ – so soll es gemacht werden: " + txt,
        (a === "ja" ? (e.extra.knopf || "Umsetzen") + ": " : "Anders: ") + (a === "ja" ? e.titel : txt)).then(function (r) {
        return r.error ? r : db.from("briefing").update({ entscheidung: a === "ja" ? "ja" : "anders", entscheidung_text: txt || null, entschieden_am: jetzt() }).eq("id", e.qid); });
    else if (e.quelle === "nachbereitung" && a === "text")
      q = protokollTicket({ betreff: e.titel, start: e.extra.start, ende: e.extra.ende, graph_id: e.extra.graph_id, id: e.qid }, e.projekt_id, txt).then(function (r) {
        return r.error ? r : db.from("termine").update({ nachbereitet: true }).eq("id", e.qid); });
    else if (e.quelle === "nachbereitung" && a === "nichts") q = db.from("termine").update({ nachbereitet: true }).eq("id", e.qid);
    else if (a === "text" && (e.quelle === "posting" || e.quelle === "termin" || e.quelle === "aufgabe" || e.quelle === "wartet"))
      q = ticket(e, (e.quelle === "posting" ? "Posting überarbeiten: " : e.quelle === "wartet" ? "Nachhaken: " : "Hinweis von Daniel: ") + txt);
    return q;
  }
  var MELDUNG = {
    passt: "Abgenommen. Das Ticket ist erledigt; hängen Folge-Tickets daran, rücken sie nach.",
    zurueck: "Zurückgegeben. Claude überarbeitet mit deinem Hinweis und legt es wieder zur Abnahme vor.",
    antwort: "Antwort gespeichert. Das Ticket läuft weiter.",
    ja: "Entschieden. Claude setzt es bei der nächsten Prüfung um.",
    anders: "Gespeichert. Claude setzt deinen Hinweis bei der nächsten Prüfung um.",
    protokoll: "Übergeben. Claude legt Protokollpunkte und Aufgaben im Projekt an und legt dir das Ergebnis zur Abnahme vor.",
    nichts: "Vermerkt: zu diesem Termin ist nichts festzuhalten.",
    hinweis: "Dein Hinweis ist als Ticket bei Claude (Sofort-Spur). Das Ergebnis kommt zur Abnahme in den Eingang.",
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
  /* Bestätigung bleibt sichtbar, auch wenn die Liste neu aufgebaut wird */
  function toast(text) {
    var t = document.createElement("div"); t.className = "e-toast"; t.setAttribute("role", "status"); t.textContent = text;
    document.body.appendChild(t); setTimeout(function () { t.classList.add("weg"); setTimeout(function () { t.remove(); }, 400); }, 4000);
  }
  function ausfuehren(d, e, a, txt, meldung, weiter) {
    d.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    var q = handeln(e, a, txt);
    if (!q) { d.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); return; }
    q.then(function (r) {
      if (r && r.error) { alert("Nicht gespeichert: " + r.error.message); d.querySelectorAll("button").forEach(function (b) { b.disabled = false; }); return; }
      var ok = d.querySelector(".e-ok"); ok.textContent = (e.quelle === "briefing" ? "Auftrag an Claude (Sofort-Spur). Claude setzt ihn um und schließt ihn ab, ohne ihn dir noch einmal vorzulegen." : MELDUNG[meldung] || "Gespeichert."); ok.hidden = false;
      E = E.filter(function (x) { return x !== e; });
      toast(ok.textContent);
      setTimeout(function () { weiter(e); }, 900);
    });
  }

  /* ---------- Gemeinsame Kopfzeile mit Gruppen ---------- */
  function reiter(kl) {
    return '<nav class="' + kl + '">' + GRUPPEN.map(function (g) {
      var n = anzahl(g[0]);
      return '<button type="button" data-g="' + g[0] + '" aria-pressed="' + (g[0] === gruppe) + '">' + g[1] + "<span>" + n + "</span></button>";
    }).join("") + "</nav>";
  }
  function reiterVerdrahten(fn) {
    el.querySelectorAll("[data-g]").forEach(function (b) { b.onclick = function () { gruppe = b.getAttribute("data-g"); auswahl = null; fn(); }; });
  }
  function zeichnen() { zahlImMenue(); if (art === "liste") liste(); else if (art === "fokus") fokus(); else if (art === "plan") plan(); else if (art === "klar") klar(); }
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


  /* =============== Variante 4 · Klar (Stil sofortsichtbar Story 7: Apple-Basis, Verlauf Cyan → Violett nur als Akzent) =============== */
  // Legende und Punkte stimmen überein (Daniel, 21.11.2026): rot nur, wenn eine echte Frist (Aufgabe, Freigabe) überschritten ist
  function k7Farbe(e) {
    if ((e.typ === "aufgabe" || e.typ === "freigabe") && e.frist && e.frist < HEUTE) return "rot";
    return { impuls: "cl", abnahme: "cl", rueckfrage: "cl", freigabe: "ma", aufgabe: "tinte", termin: "cy", nachbereitung: "cy" }[e.typ] || "grau";
  }
  // Datum in der Liste nur bei echten Fristen und Terminen, ohne Alarmfarbe; „seit …“ steht nur rechts im Detail
  function listenFrist(e) {
    if (e.typ === "termin") return frist(e);
    if (!(e.typ === "aufgabe" || e.typ === "freigabe" || e.typ === "wartet") || !e.frist) return "";
    return e.frist < HEUTE ? "fällig " + datum(e.frist) : frist(e);
  }
  function k7Etikett(e) {
    var t = TYP[e.typ] || ["", ""];
    return '<span class="k7-etikett k7-e-' + k7Farbe(e) + '">' + t[0] + "</span>";
  }
  var KL = { gezeigt: null, listeY: 0 };
  function klar() {
    var altListe = el.querySelector(".k7-liste"), listePos = altListe ? altListe.scrollTop : 0;
    var altDetail = el.querySelector(".k7-detail"), detailPos = altDetail && KL.gezeigt === auswahl ? altDetail.scrollTop : 0;
    var l = inGruppe(gruppe);
    if (!auswahl || l.indexOf(auswahl) < 0) auswahl = window.innerWidth > 900 ? l[0] || null : null;
    var dran = E.filter(wartetAufDich).length;
    var datumLang = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" });
    el.innerHTML = '<div class="k7"><header class="k7-kopf"><div class="k7-titel"><h1>Eingang</h1><span>' + esc(datumLang) + '</span></div>' +
      '<p class="k7-stand"><b>' + dran + '</b> ' + (dran === 1 ? "Sache wartet" : "Dinge warten") + " auf dich</p>" +
      '<nav class="k7-pillen">' + GRUPPEN.map(function (g) {
        return '<button type="button" data-g="' + g[0] + '" aria-pressed="' + (g[0] === gruppe) + '">' + g[1] + " <span>" + anzahl(g[0]) + "</span></button>";
      }).join("") + "</nav>" +
      '<p class="k7-legende"><i class="k7-f-cl"></i>Claude braucht dich<i class="k7-f-ma"></i>geht nach außen<i class="k7-f-tinte"></i>deine Aufgabe<i class="k7-f-cy"></i>Termin<i class="k7-f-grau"></i>ansehen oder warten<i class="k7-f-rot"></i>überfällig</p></header>' +
      '<section class="k7-band"><div class="k7-raster' + (auswahl ? " hat-detail" : "") + '"><ul class="k7-liste">' + (l.length ? l.map(function (e, i) {
        // Zeile (Daniel, 18.11.2026): oben klein Art · Projekt · Frist, darunter der volle Titel – beim Durchscrollen sehen, worum es geht
        var f = k7Farbe(e), trenn = gruppe === "heute" && e.typ === "termin" && (i === 0 || l[i - 1].typ !== "termin") ? '<li class="k7-trenn">Heute im Kalender · zählt nicht mit</li>' : "";
        return trenn + '<li data-s="' + esc(schluessel(e)) + '"' + (e === auswahl ? ' aria-current="true"' : "") + '><div class="k7-z-kopf"><i class="k7-f-' + f + '"></i><span class="k7-art">' + (TYP[e.typ] || [""])[0] + (nr(e) ? ' <span class="k7-nr">' + nr(e) + "</span>" : "") + "</span>" +
          (projekt(e) ? '<span class="k7-proj">· ' + esc(projekt(e)) + "</span>" : "") + (listenFrist(e) ? '<span class="k7-frist">' + listenFrist(e) + "</span>" : "") + "</div><b>" + esc(e.titel) + "</b></li>";
      }).join("") : '<li class="e-leer">Nichts in dieser Gruppe.</li>') + "</ul>" +
      '<div class="k7-detail">' + (auswahl ? '<button type="button" class="e-zurueck" data-zurueck>‹ Eingang</button>' + detail(auswahl) : '<p class="e-leer">Wähle links einen Eintrag.</p>') + "</div></div></section></div>";
    reiterVerdrahten(klar);
    el.querySelectorAll(".k7-liste [data-s]").forEach(function (li) { li.onclick = function () {
      if (window.innerWidth <= 900) KL.listeY = window.scrollY;   // für „‹ Eingang“ zurück an dieselbe Stelle
      auswahl = E.filter(function (x) { return schluessel(x) === li.getAttribute("data-s"); })[0]; klar();
      if (window.innerWidth <= 900) window.scrollTo(0, el.querySelector(".k7-band").offsetTop - 70); }; });
    var z = el.querySelector("[data-zurueck]"); if (z) z.onclick = function () { auswahl = null; klar(); window.scrollTo(0, KL.listeY); };
    // Zwei Scrollbereiche: Liste behält ihre Position, ein neu gewählter Eintrag beginnt oben
    var nl = el.querySelector(".k7-liste"), nd = el.querySelector(".k7-detail");
    if (nl) nl.scrollTop = listePos;
    if (nd) nd.scrollTop = detailPos;
    if (KL.gezeigt !== auswahl && window.innerWidth > 900 && nd && nd.getBoundingClientRect().top < 60) window.scrollTo(0, 0);
    KL.gezeigt = auswahl;
    if (!verdrahtet) { verdrahtet = true; verdrahten(el, function () { var l2 = inGruppe(gruppe); auswahl = window.innerWidth > 900 ? l2[0] || null : null; klar(); }); }
  }


  /* Zahl dessen, was auf Daniel wartet, am Menüpunkt „Eingang“ */
  function zahlImMenue() {
    var n = E.filter(wartetAufDich).length;
    document.querySelectorAll('.hn a[href*="eingang-klar"]').forEach(function (a) {
      var z = a.querySelector(".d3-zahl"); if (!z) { z = document.createElement("span"); z.className = "d3-zahl"; a.appendChild(z); }
      z.textContent = n; z.hidden = !n;
    });
  }

  /* =============== Lage – das Briefing des Stabschefs (CEO-Blick) =============== */
  var L = null, ST = [];
  function lageLaden() {
    Promise.all([
      db.from("eingang").select("*"), db.from("projekte").select("id, name, marke, typ, organisationen(name, gruppe)").eq("status", "läuft"),
      db.from("lage").select("*").not("gilt_fuer", "is", null).order("gilt_fuer", { ascending: false }).limit(1),
      db.from("projekt_status").select("*").gte("gilt_fuer", plus(-3)).order("gilt_fuer", { ascending: false }),
      db.from("briefing").select("id, begruendung, art, projekt_id, ebene, marke").is("entscheidung", null)
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Briefing konnte nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      E = r[0].data || []; (r[1].data || []).forEach(function (p) { P[p.id] = p; });
      E.forEach(function (e) { e.gruppe = gruppeVon(e); e.extra = e.extra || {}; }); E.sort(sortieren);
      var br = {}; (r[4].data || []).forEach(function (b) { br[b.id] = b; });
      E.forEach(function (e) { if (e.quelle === "briefing" && br[e.qid]) { e.begruendung = br[e.qid].begruendung; e.art = br[e.qid].art; e.projekt_id = br[e.qid].projekt_id; e.ebene = br[e.qid].ebene || "operativ"; e.marke = br[e.qid].marke; } });
      L = (r[2].data || [])[0] || null;
      var gesehen = {}; ST = (r[3].data || []).filter(function (s) { if (gesehen[s.projekt_id] || !P[s.projekt_id]) return false; gesehen[s.projekt_id] = 1; return true; });
      kennungen(lage);
    });
  }
  function liste2(t) { try { var l = typeof t === "string" ? JSON.parse(t) : t; return Array.isArray(l) ? l : []; } catch (x) { return t ? [t] : []; } }
  var AMPEL = { kritisch: ["Kritisch", 0], achtung: ["Achtung", 1], im_plan: ["Im Plan", 2], ruht: ["Ruht", 3] };
  var ARTE = { entscheidung: "Entscheidung", risiko: "Risiko", chance: "Chance" };
  /* Projektzeile, zugeklappt (Daniel, 18.11.2026): „im ersten Moment sehen, um welches Projekt es sich handelt … aufklappen, erstes Summary,
     dann ins Detail springen“. Genutzt auf Lage und Projekte. */
  function projektZeilen(liste, stati, mitMarke) {
    return '<ul class="pz-zeilen">' + liste.map(function (x) {
      var s = stati[x.id] || {}, org = x.organisationen ? (x.organisationen.gruppe || x.organisationen.name) : "";
      var neben = [mitMarke ? x.marke : "", x.typ === "Kunde" ? (org || "Kunde") : ""].filter(Boolean).join(" · ");
      return '<li><details><summary><i class="lg-a-' + (s.ampel || "ruht") + '" title="' + (s.ampel ? AMPEL[s.ampel][0] : "kein Stand") + '"></i><b>' + esc(x.name) + "</b>" +
        (neben ? "<span>" + esc(neben) + "</span>" : "") + '<em aria-hidden="true"></em></summary><div class="pz-auf">' +
        (s.satz ? "<p>" + esc(s.satz) + "</p>" : '<p class="e-leer">Noch kein Stand.</p>') +
        (s.naechster_schritt ? '<p class="pz-naechst"><span>Nächster Schritt</span>' + esc(s.naechster_schritt) + (s.bei ? " · " + esc(s.bei) : "") +
          (s.faellig ? " · " + (s.faellig < HEUTE ? '<span class="e-spaet">seit ' + datum(s.faellig) + "</span>" : "bis " + datum(s.faellig)) : "") + "</p>" : "") +
        '<a class="e-k" href="/strategie/projekt.html#p=' + x.id + '">Zum Projekt</a></div></details></li>';
    }).join("") + "</ul>";
  }
  function lage() {
    zahlImMenue();
    var datumLang = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: "Europe/Berlin" });
    var alleEmp = E.filter(function (e) { return e.typ === "impuls"; });
    var emp = alleEmp.filter(function (e) { return reiterVon(e) === EBENE; });
    var reiter = '<div class="lg-reiter" role="tablist">' + REITER.map(function (r) {
      var n = alleEmp.filter(function (e) { return reiterVon(e) === r[0]; }).length;
      return '<button type="button" role="tab" data-ebene="' + r[0] + '" aria-selected="' + (r[0] === EBENE) + '">' + r[1] + " <span>" + n + "</span></button>"; }).join("") + "</div>";
    var zaehl = function (f) { return E.filter(f).length; };
    var w = function (f) { return zaehl(function (e) { return wartetAufDich(e) && f(e); }); };
    var wartet = [
      ["Empfehlungen", w(function (e) { return e.typ === "impuls"; }), "cl"], ["Abnahmen", w(function (e) { return e.typ === "abnahme"; }), "cl"],
      ["Rückfragen", w(function (e) { return e.typ === "rueckfrage"; }), "cl"], ["„Wie lief es?“", w(function (e) { return e.typ === "nachbereitung"; }), "cy"],
      ["Freigaben bis übermorgen", w(function (e) { return e.typ === "freigabe"; }), "ma"], ["Aufgaben fällig bis heute", w(function (e) { return e.typ === "aufgabe"; }), "rot"],
      ["Entscheidungen", w(function (e) { return e.typ === "entscheidung"; }), "grau"]
    ].filter(function (x) { return x[1]; });
    var wartetSumme = zaehl(wartetAufDich);
    var stand = L && L.gilt_fuer ? (L.gilt_fuer === HEUTE ? "Briefing von heute" : "Briefing vom " + datum(L.gilt_fuer) + ", das heutige fehlt noch") : "Noch kein Briefing";
    var st = ST.slice().sort(function (a, b) { return AMPEL[a.ampel][1] - AMPEL[b.ampel][1] || String(P[a.projekt_id].name).localeCompare(P[b.projekt_id].name); });
    el.innerHTML = '<div class="k7 lage lage-start"><header class="k7-kopf"><div class="k7-titel"><h1>Briefing</h1><span>' + esc(datumLang) + '</span></div><p class="k7-stand">' + esc(stand) + "</p></header>" +
      '<section class="k7-band"><div class="lg-raster">' +
      '<div class="lg-kern"><h2 class="lg-kern-titel">Was heute zählt</h2>' + (L ? '<ul class="lg-kern-liste">' + saetze(L.text).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<p>Der Stabschef hat heute noch kein Briefing geschrieben.</p>") + "</div>" +
      '<div class="lg-links"><div class="lg-emp-titel"><h2>Meine Empfehlungen</h2>' + reiter + "</div>" + (emp.length ? emp.map(function (e) {
        return '<article class="e-detail lg-emp" data-s="' + esc(schluessel(e)) + '"><div class="lg-emp-kopf"><span class="lg-art lg-art-' + (ARTE[e.art] ? e.art : "empfehlung") + '">' + (ARTE[e.art] || "Empfehlung") + "</span>" +
          (nr(e) ? '<span class="lg-nr">Empfehlung ' + nr(e) + "</span>" : "") +
          (P[e.projekt_id] ? '<span class="lg-proj">' + esc(P[e.projekt_id].name) + " · " + esc(P[e.projekt_id].marke) + "</span>" : e.marke ? '<span class="lg-proj">' + esc(e.marke) + "</span>" :
            /^Stoßrichtung: ([^:]{2,40}):/.test(e.begruendung || "") ? '<span class="lg-proj">' + esc(e.begruendung.match(/^Stoßrichtung: ([^:]{2,40}):/)[1]) + "</span>" : "") + "</div><h3>" + esc(e.titel) + "</h3>" + (e.kern ? "<p>" + esc(e.kern) + "</p>" : "") +
          (e.begruendung ? '<details class="lg-warum"><summary>Warum jetzt</summary><p>' + esc(e.begruendung) + "</p></details>" : "") +
          '<div class="e-knoepfe"><button class="e-k e-k-voll" data-a="ja">' + esc(e.extra.knopf || "Passt, umsetzen") + '</button><button class="e-k" data-a="text" data-modus="anders">Anders</button></div>' +
          '<form class="e-text" hidden><textarea rows="3" placeholder="Was soll ich stattdessen tun?"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></article>';
      }).join("") : '<p class="e-leer lg-alle-ent">Alle Empfehlungen ' + reiterText(EBENE, "in") + ' sind entschieden.</p>') + nachschubHtml() + "</div>" +
      '<aside class="lg-rechts"><div class="lg-kasten"><h2>Wartet auf dich <span class="lg-summe">' + wartetSumme + "</span></h2>" + (wartet.length ? '<ul class="lg-wartet">' + wartet.map(function (w) {
        return '<li><i class="k7-f-' + w[2] + '"></i><b>' + w[1] + "</b> " + w[0] + "</li>"; }).join("") + "</ul>" : '<p class="e-leer">Nichts.</p>') +
      '<a class="e-k e-k-voll lg-zum-eingang" href="/strategie/eingang-klar.html">Zum Eingang</a></div>' +
      '<div class="lg-kasten"><h2>Seit gestern</h2>' + (L && liste2(L.fortschritt).length ? "<ul>" + liste2(L.fortschritt).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="e-leer">Keine Angaben.</p>') + "</div>" +
      '<div class="lg-kasten"><h2>Diese Woche</h2>' + (L && liste2(L.woche).length ? "<ul>" + liste2(L.woche).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="e-leer">Keine Angaben.</p>') + "</div></aside>" +
      '<div class="lg-projekte"><h2>Projektstände</h2><p class="lg-p-hinweis">Alle laufenden Projekte, die dringlichsten zuerst: kritisch, Achtung, im Plan, ruht. Aufklappen zeigt den Stand vom Stabschef.</p>' +
      (st.length ? '<div class="pz-kasten">' + projektZeilen(st.map(function (s) { return P[s.projekt_id]; }), (function () { var m = {}; st.forEach(function (s) { m[s.projekt_id] = s; }); return m; })(), true) + "</div>" : '<p class="e-leer">Noch keine Projektstände.</p>') + "</div>" +
      "</div></section></div>";
    if (!verdrahtet) { verdrahtet = true; verdrahten(el, function () { lage(); }); nachschubVerdrahten(); }
  }
  /* „Nächste Empfehlungen“ (Daniel, 18.11.2026): Wenn ich Zeit habe, mit dem Stabschef Themen abzuarbeiten, hole ich mir weitere
     Empfehlungen. Der Knopf legt einen Anstoß an; der Mac sieht jede Minute nach und lässt den Stabschef drei neue schreiben. */
  var NS = null;   // null = bereit, sonst Zeitpunkt des Anstoßes
  /* Fünf Knöpfe (Daniel, 20.11.2026): „Top 3“ vorbelegt – die drei Empfehlungen mit der größten Wirkung, egal aus welcher Marke –,
     dann die strategischen Themen je Marke (empiria und sofortsichtbar zuerst, das sind die wichtigsten), zuletzt Operativ. */
  var REITER = [["top", "Top 3"], ["empiria", "empiria"], ["sofortsichtbar", "sofortsichtbar"], ["ms", "Müller&Ströbel."], ["operativ", "Operativ"]];
  var EBENE = "top";
  function reiterVon(e) {
    if (e.ebene === "marketing") return "";   // gehören auf die Seite Marketing
    if (e.ebene === "top" || e.ebene === "operativ") return e.ebene;
    var m = e.marke || (P[e.projekt_id] || {}).marke || ((e.begruendung || "").match(/^Stoßrichtung: ([^:]{2,40}):/) || [])[1] || "";
    m = m.toLowerCase();
    return m.indexOf("sofort") === 0 ? "sofortsichtbar" : m.indexOf("müller") === 0 || m.indexOf("m&s") === 0 ? "ms" : m.indexOf("empiria") === 0 ? "empiria" : "top";
  }
  function reiterText(r, art) {
    var m = { top: ["Top 3", "unter Top 3"], empiria: ["strategische für empiria", "für empiria"], sofortsichtbar: ["strategische für sofortsichtbar", "für sofortsichtbar"],
      ms: ["strategische für Müller&Ströbel.", "für Müller&Ströbel."], operativ: ["operative", "unter Operativ"] }[r] || ["", ""];
    return art === "in" ? m[1] : m[0];
  }
  function reiterQuelle(r) { return r === "top" || r === "operativ" ? r : "strategisch:" + (r === "ms" ? "Müller&Ströbel." : r); }
  function nachschubHtml() {
    return '<div class="lg-nachschub">' + (NS ? '<p class="lg-ns-laeuft"><span class="lg-ns-punkt"></span>Der Stabschef schreibt drei weitere Empfehlungen (' + esc(reiterText(NS_EBENE)) + '). Das dauert etwa drei Minuten, die Seite aktualisiert sich selbst.</p>'
      : '<button type="button" class="e-k" data-nachschub>Nächste Empfehlungen ' + (EBENE === "top" ? "mit größter Wirkung" : EBENE === "operativ" ? "operativ" : reiterText(EBENE, "in")) + ' holen</button><span class="lg-ns-hinweis">Drei weitere, die sich von den heutigen unterscheiden</span>') + "</div>";
  }
  function nachschubPruefen() {
    db.from("anstoesse").select("id, status, angelegt_am, quelle").eq("art", "empfehlungen").in("status", ["offen", "läuft"]).order("id", { ascending: false }).limit(1).then(function (r) {
      var offen = (r.data || [])[0];
      if (offen) { if (!NS) { NS = offen.angelegt_am; NS_EBENE = (function (q) { q = String(q || "").replace(/^lage:/, ""); return q.indexOf("strategisch:") === 0 ? reiterVon({ ebene: "strategisch", marke: q.slice(12) }) : q === "top" ? "top" : "operativ"; })(offen.quelle); lage(); } setTimeout(nachschubPruefen, 15000); }
      else if (NS) { NS = null; lageLaden(); toast("Neue Empfehlungen sind da."); }
    });
  }
  var NS_EBENE = "";
  function nachschubVerdrahten() {
    el.addEventListener("click", function (ev) {
      var r = ev.target.closest("[data-ebene]");
      if (r) { EBENE = r.getAttribute("data-ebene"); lage(); return; }
      var b = ev.target.closest("[data-nachschub]"); if (!b || NS) return;
      b.disabled = true;
      NS_EBENE = EBENE;
      db.from("anstoesse").insert({ art: "empfehlungen", quelle: "lage:" + reiterQuelle(EBENE) }).then(function (r) {
        if (r && r.error) { b.disabled = false; toast("Konnte den Stabschef nicht anstoßen: " + r.error.message); return; }
        NS = new Date().toISOString(); lage(); setTimeout(nachschubPruefen, 15000);
      });
    });
    nachschubPruefen();
  }



  /* =============== Strategie – je Marke: Wofür wir stehen · Zielbild · Zwischenziel · Stoßrichtungen · Überlegungen ===============
     Daniel, 18.11.2026: „einen eigenen Punkt, wo ich meine strategischen Überlegungen hinterlegen kann und wo die strukturiert abgelegt
     sind … Stoßrichtungen und Stränge … das darf nicht wegbrechen und muss so dargestellt sein, dass man es nutzen, weiterentwickeln
     und verstehen kann.“ Logik: Selbstverständnis → Vision als Zielbild → Strategie (Stoßrichtungen, Stränge) → Projekte und Gates. */
  var SG = { marke: (function () { try { return localStorage.getItem("strategie-marke") || "empiria"; } catch (x) { return "empiria"; } })() };
  var SG_MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
  function strategieLaden() {
    Promise.all([
      db.from("marken_strategie").select("*"),
      db.from("projekte").select("id, name, marke, typ, phase, naechstes_gate, gate_datum, status").eq("status", "läuft"),
      db.from("projekt_status").select("*").gte("gilt_fuer", plus(-7)).order("gilt_fuer", { ascending: false }),
      db.from("projekt_straenge").select("id, projekt_id, eltern_id, titel, erklaerung, reihenfolge, verantwortlich, projekt_ids"),
      db.from("strategie_notizen").select("*").order("angelegt_am", { ascending: false }),
      db.from("eingang").select("typ, frist")
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Strategie konnte nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      SG.ms = {}; (r[0].data || []).forEach(function (m) { SG.ms[m.marke] = m; });
      SG.pr = r[1].data || []; SG.pr.forEach(function (p) { P[p.id] = p; });
      SG.st = {}; (r[2].data || []).forEach(function (s) { if (!SG.st[s.projekt_id]) SG.st[s.projekt_id] = s; });
      SG.str = r[3].data || []; SG.no = r[4].data || []; E = r[5].data || [];
      strategieSeite();
    });
  }
  function sgStoss(m, nurMarkenstrategie) {
    // Stoßrichtungen: aus dem Strategieprojekt der Marke (Stoßrichtung → Stränge), sonst aus marken_strategie
    var sp = nurMarkenstrategie ? null : SG.pr.filter(function (p) { return p.marke === SG.marke && p.typ === "strategie"; })[0];
    if (sp) {
      var alle = SG.str.filter(function (s) { return s.projekt_id === sp.id; }), ober = alle.filter(function (s) { return !s.eltern_id; }).sort(function (a, b) { return a.reihenfolge - b.reihenfolge; });
      return { quelle: "Strategieprojekt „" + sp.name + "“", projekt: sp, liste: ober.map(function (o) {
        return { titel: o.titel.replace(/^\d+\s*/, ""), nr: (o.titel.match(/^(\d+)/) || [])[1], text: o.erklaerung, straenge: alle.filter(function (s) { return s.eltern_id === o.id; }).sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }) };
      }) };
    }
    var roh = (m && m.stossrichtungen) || [];
    if (typeof roh === "string") { try { roh = JSON.parse(roh.replace(/'/g, '"')); } catch (x) { roh = []; } }
    return { quelle: "Markenstrategie", liste: roh.map(function (s) { return { titel: s.titel, text: s.beschreibung, stand: s.stand, wer: s.verantwortlich, projekte: s.projekte || [] }; }) };
  }
  function strategieSeite() {
    zahlImMenue();
    var m = SG.ms[SG.marke] || {}, st = sgStoss(m);
    var reiter = '<nav class="k7-pillen">' + SG_MARKEN.map(function (mk) { return '<button type="button" data-sg-marke="' + esc(mk) + '" aria-pressed="' + (mk === SG.marke) + '">' + esc(mk) + "</button>"; }).join("") + "</nav>";
    var leer = function (t) { return '<p class="e-leer">' + t + "</p>"; };
    var ueberholt = m.zwischenziel && /bis Baden-Baden|18\.–20\.10\./.test(m.zwischenziel);
    var projektZeile = function (id) { var p = P[id]; if (!p) return ""; var s = SG.st[id] || {};
      return '<li><a href="/strategie/projekt.html#p=' + id + '"><i class="lg-a-' + (s.ampel || "ruht") + '"></i><span>' + esc(p.name) + "</span></a></li>"; };
    var notizen = SG.no.filter(function (n) { return n.marke === SG.marke; });
    el.innerHTML = '<div class="k7 lage"><header class="k7-kopf"><div class="k7-titel"><h1>Strategie</h1><span>' + esc(SG.marke) + (m.stand ? " · Stand " + datum(String(m.stand).slice(0, 10)) : "") + "</span></div>" + reiter + "</header>" +
      '<section class="k7-band"><div class="sg">' +
      // 1 Wofür wir stehen  2 Zielbild
      '<div class="sg-zwei"><div class="lg-kasten"><h2>Wofür wir stehen</h2>' + (m.selbstverstaendnis ? themenText(m.selbstverstaendnis, false) : leer("Noch nicht formuliert. Diktiere es unten als Überlegung, Claude legt es hier ab.")) + "</div>" +
      '<div class="lg-kasten"><h2>Zielbild</h2>' + (m.vision ? themenText(m.vision, false) : leer("Noch kein Zielbild.")) +
        (m.geschaeftsmodell ? '<h3 class="sg-unter">Geschäftsmodell</h3>' + themenText(m.geschaeftsmodell, false) : "") + "</div></div>" +
      // 3 Zwischenziel
      '<div class="lg-kasten sg-ziel"><h2>Nächstes Zwischenziel</h2>' + (m.ziel_kurz ? '<p class="sg-ziel-kurz">' + esc(m.ziel_kurz) + "</p>" : "") +
        (m.zwischenziel ? themenText(m.ziel_kurz ? String(m.zwischenziel).replace(new RegExp("^" + m.ziel_kurz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*"), "") : m.zwischenziel, false) : leer("Noch kein Zwischenziel.")) +
        (ueberholt ? '<p class="sg-warn">Das Datum ist vorbei. Das Zwischenziel sollte neu gesetzt werden.</p>' : "") + "</div>" +
      // 4 Stoßrichtungen
      '<div class="sg-stoss-kopf"><h2>Stoßrichtungen</h2><span>aus: ' + esc(st.quelle) + "</span></div>" +
      (st.liste.length ? '<div class="sg-stoss">' + st.liste.map(function (s, i) {
        return '<article class="lg-kasten sg-sr"><p class="sg-nr">' + (s.nr || String(i + 1).padStart(2, "0")) + (s.stand ? ' · <span class="sg-stand sg-stand-' + esc(s.stand.replace(/\s+/g, "-")) + '">' + esc(s.stand) + "</span>" : "") + '</p><h3>' + esc(s.titel) + "</h3>" +
          (s.text ? '<p class="sg-text">' + esc(s.text) + "</p>" : "") +
          (s.straenge && s.straenge.length ? '<ul class="sg-straenge">' + s.straenge.map(function (x) { var ids = (x.projekt_ids || []).map(Number).filter(function (id) { return P[id]; });
            return "<li><b>" + esc(x.titel.replace(/^\d+\s*/, "")) + "</b>" + (x.erklaerung ? "<span>" + esc(x.erklaerung) + "</span>" : "") +
              (ids.length ? '<ul class="sg-projekte sg-strang-pr">' + ids.map(projektZeile).join("") + "</ul>" : "") + "</li>"; }).join("") + "</ul>" : "") +
          (s.projekte && s.projekte.length ? '<ul class="sg-projekte">' + s.projekte.map(projektZeile).join("") + "</ul>" : "") +
          (s.wer ? '<p class="sg-wer">' + esc(s.wer) + "</p>" : "") + "</article>";
      }).join("") + "</div>" : leer("Noch keine Stoßrichtungen.")) +
      // Erste Fassung (Markenstrategie, Stand 11.10.) zum Abgleich, wenn oben das Strategieprojekt steht – je Punkt, unter welchem Strang er einsortiert ist
      (st.projekt ? (function () { var ms = sgStoss({ stossrichtungen: m.stossrichtungen }, true); if (!ms.liste.length) return "";
        var straenge = SG.str.filter(function (x) { return x.projekt_id === st.projekt.id && x.eltern_id; });
        return '<details class="lg-kasten sg-alt"><summary><h2>Erste Fassung vom ' + (m.stand ? datum(String(m.stand).slice(0, 10)) : "11.10.") + ' zum Abgleich</h2><span>' + ms.liste.length + ' Punkte, eingeordnet in die Stränge oben</span></summary><ul class="sg-alt-liste">' +
          ms.liste.map(function (s) {
            // ausdrücklich hinterlegte Einordnung (marken_strategie.einordnung), sonst über gemeinsame Projekte
            var fest = m.einordnung && m.einordnung[s.titel];
            var ziel = straenge.filter(function (x) { return fest ? fest.map(Number).indexOf(Number(x.id)) >= 0 : (s.projekte || []).some(function (id) { return (x.projekt_ids || []).map(Number).indexOf(Number(id)) >= 0; }); }).map(function (x) { return x.titel.replace(/^\d+\s*/, ""); });
            return "<li><b>" + esc(s.titel) + "</b>" + (s.wer ? ' <span class="sg-wer">· ' + esc(s.wer) + "</span>" : "") + (s.text ? "<p>" + esc(s.text) + "</p>" : "") +
              '<p class="sg-einsortiert">' + (ziel.length ? "Einsortiert unter: " + esc(ziel.join(" · ")) : "Noch keinem Strang zugeordnet") + "</p></li>"; }).join("") + "</ul></details>"; })() : "") +
      // Laufende Projekte der Marke, die keiner Stoßrichtung zugeordnet sind
      (function () {
        var zugeordnet = {}; [st].forEach(function (x) { x.liste.forEach(function (s) { (s.projekte || []).forEach(function (id) { zugeordnet[id] = 1; }); }); });
        if (st.projekt) { zugeordnet[st.projekt.id] = 1; SG.str.forEach(function (x) { if (x.projekt_id === st.projekt.id) (x.projekt_ids || []).forEach(function (id) { zugeordnet[Number(id)] = 1; }); }); }
        var ohne = SG.pr.filter(function (p) { return p.marke === SG.marke && !zugeordnet[p.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
        return ohne.length ? '<div class="lg-kasten"><h2>Projekte ohne Stoßrichtung</h2><p class="sg-hinweis">Laufende Projekte von ' + esc(SG.marke) + ', die noch keiner Stoßrichtung zugeordnet sind.</p><ul class="sg-projekte sg-ohne">' + ohne.map(function (p) { return projektZeile(p.id); }).join("") + "</ul></div>" : "";
      })() +
      // 5 Überlegungen
      '<div class="lg-kasten sg-notizen"><h2>Strategische Überlegungen</h2><p class="sg-hinweis">Diktiere oder tippe, was dir zur Strategie von ' + esc(SG.marke) + ' durch den Kopf geht. Claude legt es mit Datum ab und arbeitet es oben ein: Wofür wir stehen, Zielbild, Zwischenziel oder Stoßrichtungen.</p>' +
        '<form class="sg-form"><textarea rows="4" placeholder="Überlegung diktieren oder tippen …"></textarea><button class="e-k e-k-voll" type="submit">Hinterlegen</button></form>' +
        (notizen.length ? '<ul class="sg-liste">' + notizen.map(function (n) {
          return '<li><p class="sg-n-kopf">' + datum(String(n.angelegt_am).slice(0, 10)) + " · " + (n.eingearbeitet_am ? '<span class="sg-ok">eingearbeitet</span>' : '<span class="sg-offen">wird eingearbeitet</span>') + "</p><p>" + esc(n.text) + "</p>" +
            (n.ergebnis ? '<p class="sg-ergebnis">' + esc(n.ergebnis) + "</p>" : "") + "</li>"; }).join("") + "</ul>" : "") + "</div>" +
      "</div></section></div>";
    el.querySelectorAll("[data-sg-marke]").forEach(function (b) { b.onclick = function () { SG.marke = b.getAttribute("data-sg-marke"); try { localStorage.setItem("strategie-marke", SG.marke); } catch (x) {} strategieSeite(); }; });
    var fo = el.querySelector(".sg-form");
    fo.onsubmit = function (ev) {
      ev.preventDefault(); var ta = fo.querySelector("textarea"), txt = ta.value.trim(); if (!txt) return;
      fo.querySelector("button").disabled = true;
      db.from("strategie_notizen").insert({ marke: SG.marke, text: txt, quelle: "Dashboard Strategie" }).select("id").then(function (r) {
        if (r && r.error) { toast("Nicht gespeichert: " + r.error.message); fo.querySelector("button").disabled = false; return; }
        var nid = r && r.data && r.data[0] ? r.data[0].id : null;
        ticket({ titel: "Strategie " + SG.marke, quelle: "strategie", qid: nid, projekt_id: null },
          "Strategische Überlegung von Daniel zu " + SG.marke + " (strategie_notizen " + nid + "):\n\n" + txt + "\n\nEinarbeiten in marken_strategie (selbstverstaendnis, vision, geschaeftsmodell, zwischenziel, stossrichtungen) oder in die Stränge des Strategieprojekts; danach strategie_notizen.eingearbeitet_am und ergebnis (ein Satz in Klartext, was wo geändert wurde) setzen.",
          "Strategie einarbeiten: " + txt.slice(0, 60)).then(function () {
          toast("Hinterlegt. Claude arbeitet die Überlegung ein."); strategieLaden(); });
      });
    };
  }

  /* =============== Marketing – Arbeitsplatz des Marketing- und Vertriebsstrategen ===============
     Daniel, 18.11.2026: „Der Marketing- und Vertriebsstratege muss übersetzen, wo wir aus der Strategie hinwollen, Signale aus dem Internet
     ziehen und auf die Analysen schauen … im Reiter Marketing stehen die strategischen Empfehlungen aus seiner Sicht.“
     Inhalte schreibt ~/AlwaysOn/stabschef/marketing_stratege.py (briefing ebene 'marketing', marketing_lage). */
  var MK = { marke: (function () { try { return localStorage.getItem("marketing-marke") || "alle"; } catch (x) { return "alle"; } })(), ns: null };
  function marketingLaden() {
    Promise.all([
      db.from("eingang").select("*"),
      db.from("projekte").select("id, name, marke, typ").eq("status", "läuft"),
      db.from("briefing").select("id, begruendung, art, projekt_id, ebene, marke").is("entscheidung", null).eq("ebene", "marketing"),
      db.from("marketing_lage").select("*").order("gilt_fuer", { ascending: false }).limit(1),
      db.from("beitraege").select("id, marke, geplant_am, status, kernaussage").in("status", ["entwurf", "geplant", "freigegeben"]).gte("geplant_am", new Date(Date.now() - 864e5).toISOString()).lte("geplant_am", new Date(Date.now() + 14 * 864e5).toISOString()).order("geplant_am"),
      db.from("kampagnen").select("id, name, marke, status, zeitraum, naechster_schritt"),
      db.from("marketing_massnahmen").select("id, konto, quelle, bereich, titel, massnahme").eq("status", "offen").order("rang", { ascending: true })
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Marketing konnte nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      E = r[0].data || []; (r[1].data || []).forEach(function (p) { P[p.id] = p; });
      var br = {}; (r[2].data || []).forEach(function (b) { br[b.id] = b; });
      E.forEach(function (e) { e.gruppe = gruppeVon(e); e.extra = e.extra || {}; if (e.quelle === "briefing" && br[e.qid]) { e.begruendung = br[e.qid].begruendung; e.art = br[e.qid].art; e.projekt_id = br[e.qid].projekt_id; e.ebene = br[e.qid].ebene; e.marke = br[e.qid].marke; } });
      MK.lage = (r[3].data || [])[0] || null; MK.plan = r[4].data || []; MK.kamp = r[5].data || []; MK.mass = r[6].data || [];
      marketingSeite();
    });
  }
  var KONTO_MARKE = { empiria: "empiria", sofortsichtbar: "sofortsichtbar", "mueller-stroebel": "Müller&Ströbel.", uebergreifend: "" };
  function marketingSeite() {
    zahlImMenue();
    var passt = function (mk) { return MK.marke === "alle" || !mk || mk === MK.marke; };
    var emp = E.filter(function (e) { return e.typ === "impuls" && e.ebene === "marketing" && passt(e.marke); });
    var L = MK.lage || {}, wirkung = liste2(L.wirkung).filter(function (w) { return passt(w.marke); }), signale = liste2(L.signale).filter(function (s) { return passt(s.marke); });
    var plan = MK.plan.filter(function (b) { return passt(b.marke); }), kamp = MK.kamp.filter(function (k) { return passt(k.marke); }), mass = MK.mass.filter(function (m) { return passt(KONTO_MARKE[m.konto]); });
    var stand = L.gilt_fuer ? (L.gilt_fuer === HEUTE ? "Stand heute" : "Stand " + datum(L.gilt_fuer)) : "Noch keine Auswertung";
    var reiter = '<nav class="k7-pillen">' + [["alle", "Alle Marken"]].concat(SG_MARKEN.map(function (m) { return [m, m]; })).map(function (m) {
      return '<button type="button" data-mk-marke="' + esc(m[0]) + '" aria-pressed="' + (m[0] === MK.marke) + '">' + esc(m[1]) + "</button>"; }).join("") + "</nav>";
    var leer = function (t) { return '<p class="e-leer">' + t + "</p>"; };
    el.innerHTML = '<div class="k7 lage lage-start"><header class="k7-kopf"><div class="k7-titel"><h1>Marketing</h1><span>Marketing- und Vertriebsstratege · ' + esc(stand) + "</span></div>" + reiter + "</header>" +
      '<section class="k7-band"><div class="lg-raster">' +
      // Empfehlungen
      '<div class="lg-links"><div class="lg-emp-titel"><h2>Empfehlungen des Strategen</h2></div>' + (emp.length ? emp.map(function (e) {
        return '<article class="e-detail lg-emp" data-s="' + esc(schluessel(e)) + '"><div class="lg-emp-kopf"><span class="lg-art lg-art-' + (ARTE[e.art] ? e.art : "empfehlung") + '">' + (ARTE[e.art] || "Empfehlung") + "</span>" +
          '<span class="lg-proj">' + esc([e.marke, P[e.projekt_id] && P[e.projekt_id].name].filter(Boolean).join(" · ")) + "</span></div><h3>" + esc(e.titel) + "</h3>" + (e.kern ? "<p>" + esc(e.kern) + "</p>" : "") +
          (e.begruendung ? '<details class="lg-warum"><summary>Beleg und Stoßrichtung</summary><p>' + esc(e.begruendung) + "</p></details>" : "") +
          '<div class="e-knoepfe"><button class="e-k e-k-voll" data-a="ja">' + esc(e.extra.knopf || "Passt, umsetzen") + '</button><button class="e-k" data-a="text" data-modus="anders">Anders</button></div>' +
          '<form class="e-text" hidden><textarea rows="3" placeholder="Was soll ich stattdessen tun?"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></article>';
      }).join("") : leer("Keine offenen Marketing-Empfehlungen.")) +
      '<div class="lg-nachschub">' + (MK.ns ? '<p class="lg-ns-laeuft"><span class="lg-ns-punkt"></span>Der Stratege schreibt drei weitere Empfehlungen. Das dauert etwa drei Minuten, die Seite aktualisiert sich selbst.</p>'
        : '<button type="button" class="e-k" data-mk-nachschub>Nächste Marketing-Empfehlungen holen</button>') + "</div></div>" +
      // Wirkung je Marke
      '<aside class="lg-rechts">' + (wirkung.length ? wirkung.map(function (w) { return '<div class="lg-kasten"><h2>Wirkung · ' + esc(w.marke) + "</h2><ul>" + liste2(w.saetze).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>"; }).join("")
        : '<div class="lg-kasten"><h2>Wirkung</h2>' + leer("Noch keine Auswertung.") + "</div>") + "</aside>" +
      // Signale
      '<div class="lg-projekte"><h2>Signale aus dem Markt</h2><p class="lg-p-hinweis">Was in der Branche und bei Kunden passiert, und wofür es taugt.</p>' + (signale.length ? '<div class="mk-signale">' + signale.map(function (s) {
        return '<article class="lg-kasten mk-signal"><p class="mk-wofuer"><span class="mk-tag mk-tag-' + esc(String(s.wofuer || "").toLowerCase()) + '">' + esc(s.wofuer || "") + "</span>" + esc(s.marke || "") + "</p><h3>" + esc(s.titel) + "</h3><p>" + esc(s.satz || "") + "</p>" +
          (s.link ? '<a class="mk-link" href="' + esc(s.link) + '" target="_blank" rel="noopener">Quelle öffnen</a>' : "") + "</article>"; }).join("") + "</div>" : leer("Keine Signale.")) + "</div>" +
      // Nach außen: Redaktionsplan, Kampagnen, Maßnahmen
      '<div class="lg-projekte"><h2>Nach außen</h2><div class="mk-aussen">' +
        '<div class="lg-kasten"><h3 class="mk-h3">Redaktionsplan · 14 Tage</h3>' + (plan.length ? '<ul class="mk-liste">' + plan.slice(0, 7).map(function (b) {
          return '<li><span class="mk-d">' + datum(String(b.geplant_am).slice(0, 10)) + '</span><span>' + esc(String(b.kernaussage || "").slice(0, 110)) + '</span><small>' + esc(b.marke) + " · " + esc({ entwurf: "Entwurf, nicht freigegeben", geplant: "geplant", freigegeben: "freigegeben" }[b.status] || b.status) + "</small></li>"; }).join("") + "</ul>" + (plan.length > 7 ? '<p class="mk-mehr">und ' + (plan.length - 7) + " weitere in den nächsten 14 Tagen</p>" : "") : leer("Nichts geplant.")) + "</div>" +
        '<div class="lg-kasten"><h3 class="mk-h3">Kampagnen</h3>' + (kamp.length ? '<ul class="mk-liste">' + kamp.map(function (k) {
          return "<li><b>" + esc(k.name) + "</b><small>" + esc([k.marke, k.status, k.zeitraum].filter(Boolean).join(" · ")) + "</small>" + (k.naechster_schritt ? '<span class="mk-naechst">' + esc(k.naechster_schritt) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : leer("Keine Kampagnen.")) + "</div>" +
        '<div class="lg-kasten"><h3 class="mk-h3">Offene Maßnahmen von Noah und Claude <span>' + mass.length + "</span></h3>" + (mass.length ? '<ul class="mk-liste">' + mass.slice(0, 6).map(function (m) {
          return "<li><b>" + esc(m.titel) + "</b><small>" + esc([KONTO_MARKE[m.konto] || "übergreifend", m.bereich, m.quelle === "noah" ? "von Noah" : "von Claude"].filter(Boolean).join(" · ")) + "</small></li>"; }).join("") + "</ul>" : leer("Keine offenen Maßnahmen.")) +
          '<a class="e-k mk-alle" href="/strategie/marketing.html">Alle Maßnahmen entscheiden</a></div>' +
      "</div></div>" +
      "</div></section></div>";
    el.querySelectorAll("[data-mk-marke]").forEach(function (b) { b.onclick = function () { MK.marke = b.getAttribute("data-mk-marke"); try { localStorage.setItem("marketing-marke", MK.marke); } catch (x) {} marketingSeite(); }; });
    var nb = el.querySelector("[data-mk-nachschub]");
    if (nb) nb.onclick = function () { nb.disabled = true; db.from("anstoesse").insert({ art: "empfehlungen", quelle: "marketing" }).then(function (r) {
      if (r && r.error) { nb.disabled = false; toast("Konnte den Strategen nicht anstoßen: " + r.error.message); return; }
      MK.ns = true; marketingSeite(); setTimeout(mkNachschubPruefen, 15000); }); };
    if (!verdrahtet) { verdrahtet = true; verdrahten(el, function () { marketingSeite(); }); mkNachschubPruefen(); }
  }
  function mkNachschubPruefen() {
    db.from("anstoesse").select("id, status").eq("art", "empfehlungen").eq("quelle", "marketing").in("status", ["offen", "läuft"]).limit(1).then(function (r) {
      if ((r.data || []).length) { if (!MK.ns) { MK.ns = true; marketingSeite(); } setTimeout(mkNachschubPruefen, 15000); }
      else if (MK.ns) { MK.ns = null; marketingLaden(); toast("Neue Marketing-Empfehlungen sind da."); }
    });
  }
  /* =============== Projekt – Projektleiter-Blick (Kunden- und interne Projekte) =============== */
  var PJ = {};
  function projektLaden() {
    Promise.all([
      db.from("projekte").select("id, name, marke, typ, phase, ziel, naechstes_gate, gate_datum, projektseite, workshop, fahrplan, organisationen(name, gruppe)").eq("status", "läuft"),
      db.from("projekt_status").select("*").gte("gilt_fuer", plus(-7)).order("gilt_fuer", { ascending: false }),
      db.from("aufgaben").select("id, projekt_id, titel, beschreibung, verantwortlich, faellig_am, ticket_stand, ticket_rueckmeldung, spalte, art, status, erledigt_am, warten_auf, hinweis")
        .or("status.eq.offen,erledigt_am.gte." + plus(-14)),
      db.from("vorlagen").select("id, projekt_id, titel, kern, art").eq("status", "offen"),
      db.from("termine").select("id, ical_uid, start, ende, betreff, kalender, postfach, projekt_id, vorbereitung, graph_id").eq("im_kalender", true).gte("start", plus(-365)).order("start"),
      db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel, aktivitaet_extern").gte("datum", plus(-30)).lte("datum", plus(120)).order("datum"),
      db.from("eingang").select("typ, frist"),
      db.from("projekt_verlauf").select("projekt_id, datum, titel, inhalt").eq("art", "arbeitsstand").order("datum", { ascending: false }).limit(200)
    ]).then(function (r) {
      E = r[6].data || [];
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Projekte konnten nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      PJ = { arbeitsstaende: r[7].data || [], projekte: r[0].data || [], aufgaben: r[2].data || [], vorlagen: r[3].data || [], termine: r[4].data || [], ereignisse: r[5].data || [], status: {} };
      PJ.projekte.forEach(function (p) { P[p.id] = p; });
      (r[1].data || []).forEach(function (s) { if (!PJ.status[s.projekt_id]) PJ.status[s.projekt_id] = s; });
      projektSeite();
      window.addEventListener("hashchange", projektSeite);
    });
  }
  function wer2(a) { return a.verantwortlich === "Claude" ? "claude" : /^Daniel( |$)/.test(a.verantwortlich || "") ? "du" : "andere"; }
  function istGate2(a) { return a.art === "gate" || a.art === "projektgate"; }
  function aZeile(a) {
    var dran = a.verantwortlich === "Claude" && (a.ticket_stand === "zur_abnahme" || a.ticket_stand === "rueckfrage");
    var stand = dran ? (a.ticket_stand === "rueckfrage" ? "Rückfrage an dich" : "liegt zur Abnahme") : a.verantwortlich === "Claude" ? ({ bereit: "als Nächstes", in_arbeit: "läuft", wartet: "wartet" }[a.ticket_stand] || "") : "";
    return '<li class="pj-a" data-aid="' + a.id + '"><div class="pj-a-zeile"><b>' + esc(a.titel) + "</b><small>" + [wer2(a) === "andere" ? esc(a.verantwortlich) : "", stand, a.spalte === "backlog" ? "zurückgestellt" : "",
      a.faellig_am ? (a.faellig_am < HEUTE ? '<span class="e-spaet">seit ' + datum(a.faellig_am) + "</span>" : "bis " + datum(a.faellig_am)) : ""].filter(Boolean).join(" · ") + "</small></div>" +
      '<div class="pj-a-auf" hidden>' + (a.beschreibung ? '<div class="e-block">' + absaetze(String(a.beschreibung).slice(0, 900)) + "</div>" : "") +
      (a.hinweis ? '<div class="e-block e-vorschlag"><h3>Hinweis</h3>' + absaetze(a.hinweis) + "</div>" : "") +
      '<div class="e-knoepfe">' + (dran ? '<a class="e-k e-k-voll" href="/strategie/eingang-klar.html#s=ticket:' + a.id + '">' + (a.ticket_stand === "rueckfrage" ? "Antworten" : "Abnehmen") + "</a>" :
        wer2(a) === "du" ? '<button class="e-k e-k-voll" data-pa="erledigt">Erledigt</button>' : "") +
      '<button class="e-k" data-pa="hinweis">' + (wer2(a) === "andere" ? "Nachhaken lassen" : "Hinweis an Claude") + "</button></div>" +
      '<form class="e-text" hidden><textarea rows="3" placeholder="Was soll Claude tun?"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></div></li>';
  }
  /* Termine und Protokolle (Daniel, 20.11.2026: „manche Sachen sind anklickbar, manche nicht … ich komme an meine Infos nicht ran“):
     eine Liste mit allen Terminen, Workshops und Meilensteinen des Projekts – kommend und bisher, ohne Zeitgrenze. Jeder Eintrag öffnet
     daneben (am Telefon darunter) Vorbereitung, Protokoll, Entscheidungen und Aufgaben, wie in der bisherigen Projektansicht. */
  var TP = {};
  function tpZeit(ts) { var u = uhr(ts); return u && u !== "00:00" ? u : ""; }
  function tpTag(ts) { var d = iso2(ts); return new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: d.slice(0, 4) === HEUTE.slice(0, 4) ? undefined : "2-digit", timeZone: "Europe/Berlin" }); }
  function tpLaden(pid, ter) {
    TP = { pid: pid, l: null, punkte: [], aufgaben: [], wahl: null, br: {} };
    // Briefings der Termine (Stabschef oder von Daniel vorgegeben) gehören als Vorbereitung an den Termin (Daniel, 26.11.2026)
    var uids = ter.map(function (t) { return t.ical_uid; }).filter(Boolean);
    var brLaden = uids.length ? db.from("termin_briefing").select("ical_uid, zusammenfassung, ziel, punkte, fragen").in("ical_uid", uids) : Promise.resolve({ data: [] });
    brLaden.then(function (rb) { if (TP.pid !== pid) return; (rb.data || []).forEach(function (b) { if (uids.indexOf(b.ical_uid) >= 0) TP.br[b.ical_uid] = b; }); if (TP.l) tpZeichnen(); });
    db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel, aktivitaet_extern, format, ort, teilnehmer").eq("projekt_id", pid).order("datum", { ascending: false }).then(function (r) {
      if (TP.pid !== pid) return;
      var ere = (r.data || []).filter(function (e) { return e.projekt_id === pid; });
      var l = ere.map(function (e) { var g = e.aktivitaet_extern && e.aktivitaet_extern.indexOf("kalender:") === 0 ? e.aktivitaet_extern.slice(9) : null;
        return { e: e, ts: e.datum, titel: e.titel, art: e.art, gid: g, t: g && ter.filter(function (t) { return t.graph_id === g; })[0] }; });
      ter.forEach(function (t) { if (!l.some(function (x) { return x.gid && x.gid === t.graph_id; })) l.push({ t: t, ts: t.start, titel: t.betreff, art: "Termin", gid: t.graph_id }); });
      l.sort(function (x, y) { return new Date(y.ts) - new Date(x.ts); });
      TP.l = l;
      var ids = ere.map(function (e) { return e.id; });
      if (!ids.length) return tpZeichnen();
      Promise.all([
        db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am").in("ereignis_id", ids).order("angelegt_am").order("id"),
        db.from("aufgaben").select("id, ereignis_id, titel, verantwortlich, faellig_am, status").in("ereignis_id", ids)
      ]).then(function (q) {
        if (TP.pid !== pid) return;
        TP.punkte = (q[0].data || []).filter(function (x) { return x.art !== "Ersetzt" && ids.indexOf(x.ereignis_id) >= 0; });
        TP.aufgaben = (q[1].data || []).filter(function (x) { return ids.indexOf(x.ereignis_id) >= 0; });
        tpZeichnen();
      });
    });
  }
  function tpInhalt(x) {
    var id = x.e && x.e.id, pk = TP.punkte.filter(function (p) { return p.ereignis_id === id; }), au = TP.aufgaben.filter(function (a) { return a.ereignis_id === id; });
    return { vorb: pk.filter(function (p) { return p.art === "Vorbereitung"; }), prot: pk.filter(function (p) { return p.art === "Protokoll"; }),
      ent: pk.filter(function (p) { return p.art === "Entscheidung"; }), auf: au, br: x.t && TP.br[x.t.ical_uid] || null };
  }
  function tpZeile(x, i) {
    var c = tpInhalt(x), was = [c.vorb.length || c.br ? "Vorbereitung" : "", c.prot.length ? "Protokoll" : "", c.ent.length ? "Entscheidungen" : "", c.auf.length ? "Aufgaben" : ""].filter(Boolean);
    return '<li><button type="button" class="tp-zeile' + (TP.wahl === i ? " an" : "") + (TP.naechster === i ? " tp-naechster" : "") + '" data-tp="' + i + '"><span class="tp-d">' + tpTag(x.ts) + (tpZeit(x.ts) && x.art !== "Meilenstein" ? " · " + tpZeit(x.ts) : "") + "</span>" +
      "<b>" + esc(x.titel) + "</b><small>" + esc(x.art || "Termin") + (was.length ? " · " + was.join(", ") : " · noch nichts festgehalten") + "</small></button></li>";
  }
  function tpPunkte(l) {
    return '<ul class="tm-pp">' + l.map(function (p) { var m = String(p.text).match(/^([^:]{2,40}):\s*([\s\S]*)$/);
      return "<li>" + (m ? "<b>" + esc(m[1]) + "</b>" + gegliedert(m[2]) : gegliedert(p.text)) + "</li>"; }).join("") + "</ul>";
  }
  function tpDetail(x) {
    if (!x) return '<p class="e-leer">Wähle links einen Eintrag.</p>';
    var c = tpInhalt(x), e = x.e || {}, ms = new Date(x.ts).getTime();
    var imTermin = x.gid && ms >= new Date(HEUTE + "T00:00:00").getTime() && ms < Date.now() + 7 * 864e5, vorbei = ms < new Date(HEUTE + "T00:00:00").getTime();
    var meta = [esc(x.art || "Termin"), e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + esc(e.ort) : "") : e.format ? esc(e.format) : ""].filter(Boolean).join(" · ");
    var teil = (e.teilnehmer || []).join(", ");
    var h = '<p class="tp-d">' + tmTagName(iso2(x.ts), true) + (tmTagName(iso2(x.ts)) === "heute" || tmTagName(iso2(x.ts)) === "morgen" ? ", " + datum(iso2(x.ts)) : "") + (tpZeit(x.ts) && x.art !== "Meilenstein" ? " · " + tpZeit(x.ts) : "") + "</p>" +
      "<h3>" + esc(x.titel) + '</h3><p class="tp-meta">' + meta + (teil ? "<br>" + esc(teil) : "") + "</p>" +
      (imTermin ? '<a class="e-k tp-termin" href="/strategie/termine-tag.html#g=' + encodeURIComponent(x.gid) + '">In Termine öffnen →</a>' : "");
    var block = function (titel, inhalt) { return inhalt ? '<div class="e-block"><h4>' + titel + "</h4>" + inhalt + "</div>" : ""; };
    var liste = function (v) { return (Array.isArray(v) ? v : []).length ? '<ul class="tm-liste-f">' + v.map(function (z) { return "<li>" + esc(z) + "</li>"; }).join("") + "</ul>" : ""; };
    var zw = function (t) { return '<p class="tp-zw">' + t + "</p>"; };
    var br = c.br ? (c.br.zusammenfassung ? themenText(c.br.zusammenfassung, false) : "") + (c.br.ziel ? zw("Was du herausholen solltest") + themenText(c.br.ziel, true) : "") +
      (liste(c.br.punkte) ? zw("Worauf du achtest") + liste(c.br.punkte) : "") + (liste(c.br.fragen) ? zw("Leitfragen") + liste(c.br.fragen) : "") : "";
    var vorb = (c.vorb.length ? tpPunkte(c.vorb) : "") + br;
    // Vorbei: erst Protokoll, Entscheidungen und Aufgaben, die Vorbereitung zugeklappt am Ende; kommend: Vorbereitung zuerst
    var teile = (vorbei ? "" : block("Vorbereitung", vorb)) +
      block("Protokoll", c.prot.length ? tpPunkte(c.prot) : "") + block("Entscheidungen", c.ent.length ? tpPunkte(c.ent) : "") +
      block("Aufgaben", c.auf.length ? '<ul class="tm-pp">' + c.auf.map(function (a) { return "<li>" + esc(a.titel) + ' <span class="tp-wer">· ' + esc(a.verantwortlich || "offen") +
        (a.faellig_am ? ", bis " + datum(a.faellig_am) : "") + (a.status === "erledigt" ? " · erledigt" : "") + "</span></li>"; }).join("") + "</ul>" : "") +
      (vorbei && vorb ? (c.prot.length || c.ent.length || c.auf.length ? '<details class="e-block tp-vorb"><summary><h4>Vorbereitung</h4></summary>' + vorb + "</details>" : block("Vorbereitung", vorb)) : "");
    return h + (teile || '<p class="e-leer">Noch nichts festgehalten. Diktiere mir, was vorbereitet oder besprochen wurde.</p>');
  }
  function tpZeichnen() {
    var ziel = el.querySelector(".tp"); if (!ziel || !TP.l) return;
    var l = TP.l, heute0 = new Date(HEUTE + "T00:00:00").getTime();
    // durchgängige Zeitachse (Daniel, 20.11.2026): ganz oben der Termin, der am weitesten in der Zukunft liegt, ganz unten der älteste;
    // der nächste anstehende Termin trägt die farbige Klammer links
    var jetzt = Date.now();
    var kommend = l.map(function (x, i) { return i; }).filter(function (i) { return new Date(l[i].ts).getTime() >= jetzt; });
    TP.naechster = kommend.length ? kommend[kommend.length - 1] : null;
    var bisher = l.map(function (x, i) { return i; }).filter(function (i) { return new Date(l[i].ts).getTime() < jetzt; });
    // geöffnet ist immer der nächste anstehende Termin (Daniel, 20.11.2026); nur ohne künftigen Termin der letzte vergangene
    if (TP.wahl == null) TP.wahl = TP.naechster != null ? TP.naechster : bisher.length ? bisher[0] : null;
    if (!l.length) { ziel.innerHTML = '<p class="e-leer">Noch keine Termine im Projekt.</p>'; return; }
    ziel.innerHTML = '<div class="tp-liste">' + (kommend.length ? '<h3>Kommend</h3><ul>' + kommend.map(function (i) { return tpZeile(l[i], i); }).join("") + "</ul>" : "") +
      (bisher.length ? '<h3>Bisher</h3><ul>' + bisher.map(function (i) { return tpZeile(l[i], i); }).join("") + "</ul>" : "") + '</div><div class="tp-detail">' + tpDetail(l[TP.wahl]) + "</div>";
    tpPlatz();
    // die Liste so scrollen, dass der nächste Termin sichtbar ist
    var nb = ziel.querySelector(".tp-naechster"), li = ziel.querySelector(".tp-liste");
    if (nb && li && li.scrollHeight > li.clientHeight) li.scrollTop = Math.max(0, nb.offsetTop - li.offsetTop - 120);
    ziel.querySelectorAll("[data-tp]").forEach(function (b) { b.onclick = function () {
      TP.wahl = +b.getAttribute("data-tp");
      ziel.querySelectorAll(".tp-zeile.an").forEach(function (x) { x.classList.remove("an"); }); b.classList.add("an");
      var d = ziel.querySelector(".tp-detail"); d.innerHTML = tpDetail(l[TP.wahl]); d.scrollTop = 0; tpPlatz();
      if (window.innerWidth <= 900) d.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }; });
  }
  // Am Telefon und iPad mini steht die Ansicht direkt unter dem gewählten Eintrag, sonst daneben
  function tpPlatz() {
    var ziel = el.querySelector(".tp"); if (!ziel) return;
    var d = ziel.querySelector(".tp-detail"), b = ziel.querySelector(".tp-zeile.an");
    if (window.innerWidth <= 900 && b) b.parentNode.appendChild(d); else if (d.parentNode !== ziel) ziel.appendChild(d);
  }
  window.addEventListener("resize", function () { if (el.querySelector(".tp")) tpPlatz(); });
  // Höhe des eingebetteten Fahrplans
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data) return;
    var w = el.querySelector(".pj-plan-wisch");
    // Volle Breite im eingebetteten Plan: Rahmen über das ganze Fenster (Daniel, 20.11.2026)
    if (typeof ev.data.fahrplanWeit === "boolean" && w) {
      w.classList.toggle("pj-plan-voll", ev.data.fahrplanWeit); document.documentElement.classList.toggle("pj-plan-voll-offen", ev.data.fahrplanWeit);
      if (!ev.data.fahrplanWeit && PJ.zuNachWeit) { PJ.zuNachWeit = false; var dz = el.querySelector(".pj-fp"); if (dz) dz.open = false; }
      return;
    }
    if (ev.data.planGroesse) { var o = el.querySelector(".pj-plan-pill output"); if (o) o.textContent = ev.data.planGroesse + " %"; return; }
    if (!ev.data.fahrplanHoehe) return;
    if (!PJ.planBereit) { PJ.planBereit = true; if (PJ.planWarte) { planSenden(PJ.planWarte); PJ.planWarte = null; } }
    var f = el.querySelector(".pj-plan-rahmen"); if (f) f.style.height = Math.max(200, ev.data.fahrplanHoehe) + "px";
  });
  // Knöpfe der Leiste im Kopf: Klick wirkt im eingebetteten Plan; der Fahrplan geht dafür auf, „volle Breite“ zeigt sofort das große Fenster
  function planSenden(a) { var f = el.querySelector(".pj-plan-rahmen"); try { f.contentWindow.postMessage({ planAktion: a }, location.origin); } catch (x) {} }
  el.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-pp]"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var a = b.getAttribute("data-pp"), d = el.querySelector(".pj-fp"), w = el.querySelector(".pj-plan-wisch"); if (!d || !w) return;
    if (a === "weit") { if (!d.open) PJ.zuNachWeit = true; w.classList.add("pj-plan-voll"); document.documentElement.classList.add("pj-plan-voll-offen"); }
    if (!d.open) d.open = true;
    if (PJ.planBereit) planSenden(a); else PJ.planWarte = a;
  }, true);
  document.addEventListener("keydown", function (ev) {
    var w = el.querySelector(".pj-plan-wisch.pj-plan-voll"); if (ev.key !== "Escape" || !w) return;
    if (!PJ.planBereit) { w.classList.remove("pj-plan-voll"); document.documentElement.classList.remove("pj-plan-voll-offen"); PJ.planWarte = null; if (PJ.zuNachWeit) { PJ.zuNachWeit = false; el.querySelector(".pj-fp").open = false; } return; }
    var f = w.querySelector("iframe"); try { f.contentWindow.postMessage({ fahrplanWeitZu: true }, location.origin); } catch (x) {}
  });
  function projektSeite() {
    zahlImMenue();
    var m = location.hash.match(/p=(\d+)/), pid = m ? +m[1] : null, p = pid && P[pid];
    var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
    var waehler = '<select class="pj-waehler" aria-label="Projekt wählen"><option value="">Alle Projekte</option>' + MARKEN.map(function (mk) {
      return '<optgroup label="' + esc(mk) + '">' + PJ.projekte.filter(function (x) { return x.marke === mk; }).sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (x) { return '<option value="' + x.id + '"' + (x.id === pid ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</optgroup>";
    }).join("") + "</select>";
    if (!p) {
      /* Übersicht als Portfolio (Daniel, 20.11.2026: „wirkt nicht wie meine Übersicht über die Projekte … die hässlichen orangen, grünen Punkte“):
         Kundenprojekte als Karten mit Stand, nächstem Termin und nächstem Schritt; Status als ruhig getöntes Wort; interne Projekte als Liste. */
      var STATUS = { kritisch: "Kritisch", achtung: "Achtung", im_plan: "Im Plan", ruht: "Ruht" };
      var etikett = function (s) { return s && STATUS[s.ampel] ? '<span class="pp-st pp-st-' + s.ampel + '">' + STATUS[s.ampel] + "</span>" : '<span class="pp-st">Kein Stand</span>'; };
      var jetztMs = Date.now();
      var naechster = function (x) {
        var kl = x.name.toLowerCase().replace(/\s*\(.*\)$/, "").split(/ [·–] /)[0];
        var l = PJ.termine.filter(function (t) { return (t.projekt_id === x.id || String(t.betreff || "").toLowerCase().indexOf(kl) >= 0) && new Date(t.start).getTime() >= jetztMs; })
          .map(function (t) { return { ts: t.start, titel: t.betreff }; })
          .concat(PJ.ereignisse.filter(function (e) { return e.projekt_id === x.id && new Date(e.datum).getTime() >= jetztMs; }).map(function (e) { return { ts: e.datum, titel: e.titel }; }));
        l.sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
        return l[0];
      };
      var tag = function (ts) { var d = iso2(ts); return d === HEUTE ? "heute" : d === plus(1) ? "morgen" : new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }); };
      var karte = function (x) {
        var s = PJ.status[x.id], org = x.organisationen ? (x.organisationen.gruppe || x.organisationen.name) : "", n = naechster(x);
        return '<a class="pp-karte" href="#p=' + x.id + '"><div class="pp-kopf"><b>' + esc(x.name) + "</b>" + etikett(s) + "</div>" +
          (org ? '<span class="pp-org">' + esc(org) + "</span>" : "") +
          (s && s.satz ? '<p class="pp-satz">' + esc(s.satz) + "</p>" : '<p class="pp-satz pp-leer">Noch kein Stand vom Stabschef.</p>') +
          '<dl class="pp-fuss"><div><dt>Nächster Termin</dt><dd>' + (n ? tag(n.ts) + " · " + esc(n.titel) : "keiner geplant") + "</dd></div>" +
          "<div><dt>Nächster Schritt</dt><dd>" + (s && s.naechster_schritt ? esc(s.naechster_schritt) + (s.bei ? " · " + esc(s.bei) : "") : "nicht festgelegt") + "</dd></div></dl></a>";
      };
      var zeile = function (x) {
        var s = PJ.status[x.id];
        return '<li><a href="#p=' + x.id + '"><b>' + esc(x.name) + "</b>" + '<span class="pp-z-schritt">' + (s && s.naechster_schritt ? esc(s.naechster_schritt) : "") + "</span>" + etikett(s) + "</a></li>";
      };
      PJ.marke = PJ.marke || (function () { try { return localStorage.getItem("projekte-marke") || "alle"; } catch (x) { return "alle"; } })();
      var pillen = '<nav class="k7-pillen pp-pillen">' + [["alle", "Alle Marken"]].concat(MARKEN.map(function (m) { return [m, m]; })).map(function (m) {
        return '<button type="button" data-pp-marke="' + esc(m[0]) + '" aria-pressed="' + (m[0] === PJ.marke) + '">' + esc(m[1]) + "</button>"; }).join("") + "</nav>";
      el.innerHTML = '<div class="k7 lage"><header class="k7-kopf"><div class="k7-titel"><h1>Projekte</h1><span>' + PJ.projekte.length + ' laufend</span></div>' + pillen +
        // Methodenkoffer als eigene Pill neben den Marken (Daniel, 23.11.2026: „Ich komme an meine Methoden nicht mehr ran“)
        '<div class="pj-wege pp-wege"><a class="e-k" href="/strategie/methoden.html">Methodenkoffer</a>' + waehler + "</div></header>" +
        '<section class="k7-band"><div class="pj-uebersicht">' +
        MARKEN.filter(function (mk) { return PJ.marke === "alle" || PJ.marke === mk; }).map(function (mk) {
          var l = PJ.projekte.filter(function (x) { return x.marke === mk; }).sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });
          var kunden = l.filter(function (x) { return x.typ === "Kunde"; }), intern = l.filter(function (x) { return x.typ !== "Kunde"; });
          return '<section class="pj-marke"><h2>' + esc(mk) + "</h2>" +
            (kunden.length ? '<h3 class="pp-gruppe">Kundenprojekte</h3><div class="pp-karten">' + kunden.map(karte).join("") + "</div>" : "") +
            (intern.length ? '<h3 class="pp-gruppe">Interne Projekte</h3><ul class="pp-liste">' + intern.map(zeile).join("") + "</ul>" : "") + "</section>";
        }).join("") + "</div></section></div>";
      el.querySelectorAll("[data-pp-marke]").forEach(function (b) { b.onclick = function () { PJ.marke = b.getAttribute("data-pp-marke"); try { localStorage.setItem("projekte-marke", PJ.marke); } catch (x) {} projektSeite(); }; });
    } else {
      var s = PJ.status[pid] || null;
      var auf = PJ.aufgaben.filter(function (a) { return a.projekt_id === pid; });
      var offen = auf.filter(function (a) { return a.status === "offen" && !istGate2(a); }).sort(function (a, b) { return (a.spalte === "backlog") - (b.spalte === "backlog") || String(a.faellig_am || "9").localeCompare(String(b.faellig_am || "9")); });
      var gates = auf.filter(function (a) { return a.status === "offen" && istGate2(a); }).sort(function (a, b) { return String(a.faellig_am || "9").localeCompare(String(b.faellig_am || "9")); });
      var erledigt = auf.filter(function (a) { return a.status !== "offen"; }).sort(function (a, b) { return String(b.erledigt_am).localeCompare(String(a.erledigt_am)); });
      // je Spalte zuerst vier Einträge, der Rest auf Klick (Daniel, 20.11.2026: „bei anderen … dadurch wird es extrem hoch“)
      var spalte = function (titel, kl, l) { return '<div class="pj-spalte' + (l.length ? "" : " pj-spalte-leer") + '"><h3><i class="k7-f-' + kl + '"></i>' + titel + " <span>" + l.length + "</span></h3>" +
        (l.length ? '<ul class="pj-liste">' + l.map(function (a, i) { return i < 4 ? aZeile(a) : aZeile(a).replace('<li class="pj-a"', '<li class="pj-a pj-mehr" hidden'); }).join("") + "</ul>" +
          (l.length > 4 ? '<button type="button" class="pj-alle" data-pj-alle>Alle ' + l.length + " zeigen</button>" : "") : "") + "</div>"; };
      var ent = PJ.vorlagen.filter(function (v) { return v.projekt_id === pid; });
      // Kalendertermine über den Namen zuordnen; Zusätze nach „ · “ oder „ – “ gehören nicht in den Betreff (z. B. „SV Akademie · Strategie“)
      var nameKlein = p.name.toLowerCase().replace(/\s*\(.*\)$/, "").split(/ [·–] /)[0];
      var ter = PJ.termine.filter(function (t) { return t.projekt_id === pid || String(t.betreff || "").toLowerCase().indexOf(nameKlein) >= 0; });
      el.innerHTML = '<div class="k7 lage"><header class="k7-kopf"><div class="k7-titel"><h1>' + esc(p.name) + "</h1><span>" + esc(p.marke) + " · " + (p.typ === "Kunde" ? "Kundenprojekt" : "internes Projekt") + (p.phase ? " · " + esc(p.phase) : "") + "</span></div>" +
        // Absprung zur Kundenprojektseite und Methodenkoffer (Daniel, 20.11.2026)
        '<nav class="pj-wege"><button type="button" class="e-k" data-pj-ansicht aria-pressed="' + (pjAnsicht() === "brief") + '">Neue Ansicht</button><a class="e-k" href="/strategie/methoden.html">Methodenkoffer</a></nav>' + waehler + "</header>" +
        // Projektseite mit allen Verknüpfungen wie im alten Dashboard: Seite, Teile (z. B. „Live“), Repository (Daniel, 21.11.2026: „Die Links brauche ich unbedingt“)
        (function (s) { if (!s || !s.url) return ""; var raus = function (u) { return u.charAt(0) === "/" ? "" : ' target="_blank" rel="noopener"'; };
          return '<nav class="pj-seite" aria-label="Projektseite"><span>Projektseite</span><a href="' + esc(s.url) + '"' + raus(s.url) + "><b>" + esc(s.titel || "Website") + "</b> " + (s.url.charAt(0) === "/" ? "→" : "↗") + "</a>" +
            (s.teile || []).map(function (x) { return '<a href="' + esc(x.url) + '"' + raus(x.url) + ">" + esc(x.titel) + " ↗</a>"; }).join("") +
            (s.repo ? '<a href="https://github.com/' + esc(s.repo) + (s.zweig ? "/tree/" + esc(s.zweig) : "") + '" target="_blank" rel="noopener">Repository ' + esc(s.repo.split("/").pop()) + (s.zweig ? " · " + esc(s.zweig) : "") + " ↗</a>" : "") + "</nav>";
        })(p.projektseite) +
        '<section class="k7-band"><div class="lg-raster">' +
        '<div class="lg-kern pj-stand">' + (s ? '<p class="pj-ampel"><i class="lg-a-' + s.ampel + '"></i>' + AMPEL[s.ampel][0] + " · Stand " + datum(s.gilt_fuer) + "</p><p>" + esc(s.satz) + "</p>" +
          (s.naechster_schritt ? '<p class="pj-naechst">Nächster Schritt: <b>' + esc(s.naechster_schritt) + "</b>" + (s.bei ? " · " + esc(s.bei) : "") + (s.faellig ? " · bis " + datum(s.faellig) : "") + "</p>" : "") : "<p>Für dieses Projekt hat der Stabschef noch keinen Stand geschrieben.</p>") +
          "</div>" +
        // Worum es geht (Daniel, 20.11.2026: „ich muss sagen können, um was es bei dem Projekt geht … wer sind die Projektteilnehmer?“)
        '<section class="lg-kasten pj-steckbrief" data-steckbrief><p class="e-leer">Lädt …</p></section>' +
        '<div class="pj-mehr" data-pj-mehr></div>' +
        // Fahrplan (Daniel, 20.11.2026: „eine der wichtigsten Informationen im Projekt“) – derselbe Linienplan wie auf der bisherigen Projektseite
        (p.name === "Operative Aufgaben" || p.workshop || p.fahrplan === false ? "" : '<details class="lg-kasten pj-fahrplan pj-fp"><summary><h2>Fahrplan</h2><span>Linienplan mit Stoßrichtungen, Arbeitspaketen und Meilensteinen</span>' +
          // Größe, volle Breite und Legende schon im zugeklappten Zustand (Daniel, 20.11.2026); volle Breite öffnet sofort das große Fenster
          '<span class="pj-plan-pill"><button type="button" data-pp="minus" aria-label="Plan kleiner">&minus;</button><output>' + (function () { try { return localStorage.getItem("sv-plan-groesse") || "100"; } catch (x) { return "100"; } })() + ' %</output><button type="button" data-pp="plus" aria-label="Plan größer">+</button><i></i>' +
          '<button type="button" data-pp="weit" aria-label="Plan in voller Breite" title="Plan in voller Breite"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><i></i>' +
          '<button type="button" data-pp="legende">Legende</button></span></summary>' +
          '<div class="pj-plan-wisch"><iframe class="pj-plan-rahmen" src="' + (location.pathname.indexOf("/.pruefung/") === 0 ? "/.pruefung/" : "/strategie/") + 'projekte.html?nurplan#p=' + pid + '" title="Fahrplan" loading="lazy"></iframe></div></details>') +
        // zugeklappt wie der Fahrplan (Daniel, 20.11.2026)
        '<details class="lg-kasten pj-fahrplan pj-tp"><summary><h2>Termine und Protokolle</h2><span>Alle Termine mit Vorbereitung, Protokoll, Entscheidungen und Aufgaben</span></summary><div class="tp"><p class="e-leer">Lädt …</p></div></details>' +
        '<div class="pj-mehr" data-pj-verlauf></div>' +
        '<div class="lg-links"><div class="pj-spalten">' + spalte("Bei dir", "tinte", offen.filter(function (a) { return wer2(a) === "du"; })) +
          spalte("Bei Claude", "cl", offen.filter(function (a) { return wer2(a) === "claude"; })) + spalte("Bei anderen", "grau", offen.filter(function (a) { return wer2(a) === "andere"; })) + "</div>" +
          (erledigt.length ? '<details class="lg-kasten pj-erledigt"><summary><h2>Zuletzt erledigt</h2><span>' + erledigt.length + "</span></summary><ul class=\"pj-zeit\">" + erledigt.map(function (a) {
            return "<li><span>" + datum(String(a.erledigt_am).slice(0, 10)) + "</span>" + esc(a.titel) + "</li>"; }).join("") + "</ul></details>" : "") +
          (ent.length ? '<div class="lg-kasten"><h2>Offene Entscheidungen</h2><ul class="pj-einfach">' + ent.map(function (v) { return '<li><a href="/strategie/eingang-klar.html#s=vorlage:' + v.id + '">' + esc(v.titel) + "</a></li>"; }).join("") + "</ul></div>" : "") + "</div>" +
        '<aside class="lg-rechts">' + (function () {
          var as = (PJ.arbeitsstaende || []).filter(function (v) { return v.projekt_id === pid; }).slice(0, 5);
          return '<div class="lg-kasten"><h2>Arbeitsstände</h2>' + (as.length ? '<ul class="pj-stand-liste">' + as.map(function (v) {
            var i = v.inhalt || {};
            // zugeklappt: Titel und Datum; aufgeklappt Text und Ablageort (Daniel, 20.11.2026: „Arbeitsstände sind hier viel zu viel“)
            return '<li><details><summary><b>' + esc(v.titel) + "</b><small>" + datum(String(v.datum).slice(0, 10)) + "</small></summary>" + (i.text ? "<p>" + esc(i.text) + "</p>" : "") +
              (i.link && /^https?:/.test(i.link) ? '<a class="e-link" href="' + esc(i.link) + '" target="_blank" rel="noopener">Öffnen</a>' : "") +
              (finderPfad(i.ablage || i.link) ? '<a class="e-link" href="empiria-finder://zeigen?pfad=' + encodeURIComponent(finderPfad(i.ablage || i.link)) + '">Im Finder zeigen</a>' : "") +
              (i.ablage ? '<p class="pj-ablage">' + esc(i.ablage) + "</p>" : "") + "</details></li>"; }).join("") + "</ul>" : '<p class="e-leer">Noch keine Arbeitsstände.</p>') + "</div>";
        })() +
          // Meilensteine nur, wenn es keinen Fahrplan gibt – sonst stehen sie dort als Ergebnisstufen (Daniel, 20.11.2026)
          (!(p.name === "Operative Aufgaben" || p.workshop || p.fahrplan === false) ? "" : '<div class="lg-kasten"><h2>Meilensteine</h2>' + (gates.length ? '<ul class="pj-zeit">' + gates.slice(0, 6).map(function (a) { return "<li><span>" + (a.faellig_am ? datum(a.faellig_am) + a.faellig_am.slice(2, 4) : "offen") + "</span>" + esc(a.titel) + "</li>"; }).join("") + "</ul>" : '<p class="e-leer">Keine hinterlegt.</p>') + "</div>") +

          '<a class="e-k lage-alt" href="/strategie/projekte.html#p=' + pid + '">Bisherige Projektseite (Plan, Protokolle)</a></aside>' +
        "</div></section></div>";
      if (pjAnsicht() === "brief") projektBrief(offen, ter);
      var ab = el.querySelector("[data-pj-ansicht]");
      if (ab) ab.onclick = function () { try { localStorage.setItem("projekt-ansicht", pjAnsicht() === "brief" ? "bisher" : "brief"); } catch (x) {} projektSeite(); };
    }
    var w = el.querySelector(".pj-waehler"); if (w) w.onchange = function () { location.hash = w.value ? "p=" + w.value : ""; };
    if (p) { tpLaden(pid, ter); steckbriefLaden(p); }
    el.querySelectorAll("[data-pj-alle]").forEach(function (b) { b.onclick = function () { var s = b.closest(".pj-spalte"), zu = !!s.querySelector(".pj-mehr[hidden]");
      s.querySelectorAll(".pj-mehr").forEach(function (x) { x.hidden = !zu; }); b.textContent = zu ? "Weniger zeigen" : "Alle " + s.querySelectorAll(".pj-a").length + " zeigen"; }; });
    PJ.planBereit = false; PJ.planWarte = null; PJ.zuNachWeit = false;
    el.querySelectorAll(".pj-a-zeile").forEach(function (z) { z.onclick = function () { var a = z.nextElementSibling; a.hidden = !a.hidden; z.parentNode.classList.toggle("ist-offen", !a.hidden); }; });
    el.querySelectorAll("[data-pa]").forEach(function (b) {
      b.onclick = function () {
        var li = b.closest(".pj-a"), a = PJ.aufgaben.filter(function (x) { return x.id === +li.getAttribute("data-aid"); })[0], ok = li.querySelector(".e-ok");
        if (b.getAttribute("data-pa") === "hinweis") { var fo = li.querySelector(".e-text"); fo.hidden = !fo.hidden; if (!fo.hidden) fo.querySelector("textarea").focus(); return; }
        b.disabled = true;
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", a.id).then(function (r) {
          ok.hidden = false; ok.textContent = r.error ? "Nicht gespeichert: " + r.error.message : "Erledigt."; if (!r.error) { a.status = "erledigt"; a.erledigt_am = new Date().toISOString(); toast("Erledigt: " + a.titel); setTimeout(projektSeite, 900); }
        });
      };
    });
    el.querySelectorAll(".pj-a .e-text").forEach(function (fo) {
      fo.onsubmit = function (ev) {
        ev.preventDefault(); var txt = fo.querySelector("textarea").value.trim(); if (!txt) return;
        var li = fo.closest(".pj-a"), a = PJ.aufgaben.filter(function (x) { return x.id === +li.getAttribute("data-aid"); })[0], ok = li.querySelector(".e-ok");
        fo.querySelector("button").disabled = true;
        ticket({ titel: a.titel, quelle: "aufgabe", qid: a.id, projekt_id: a.projekt_id }, (wer2(a) === "andere" ? "Nachhaken bei " + a.verantwortlich + ": " : "Hinweis von Daniel: ") + txt).then(function (r) {
          ok.hidden = false; ok.textContent = r.error ? "Nicht gespeichert: " + r.error.message : "Dein Hinweis ist als Ticket bei Claude (Sofort-Spur).";
          if (!r.error) toast("Hinweis an Claude: " + a.titel);
        });
      };
    });
  }

  /* Worum es geht: Ziel mit Zieldetails, Stoßrichtungen mit Strängen, Projektteam (Kunde | empiria und Partner) */
  function steckbriefLaden(p) {
    var pid = p.id;
    Promise.all([
      db.from("projekte").select("id, ziel, ziel_details, thema, workshop, statusbericht, ueberlegungen").eq("id", pid),
      db.from("projekt_straenge").select("id, projekt_id, titel, erklaerung, eltern_id, reihenfolge").eq("projekt_id", pid).order("reihenfolge"),
      db.from("projekt_beteiligte").select("id, projekt_id, kontakt_id, name, seite, rolle, kontakte(id, vorname, nachname, position, organisationen(name))").eq("projekt_id", pid),
      db.from("projekt_verlauf").select("projekt_id, datum, art, titel, inhalt").eq("projekt_id", pid).neq("art", "arbeitsstand").order("datum", { ascending: false }).limit(200)
    ]).then(function (r) {
      var z = el.querySelector("[data-steckbrief]"); if (!z || (location.hash.match(/p=(\d+)/) || [])[1] != pid) return;
      var pr = (r[0].data || []).filter(function (x) { return x.id === pid; })[0] || p;
      var st = (r[1].data || []).filter(function (x) { return x.projekt_id === pid; }), bet = (r[2].data || []).filter(function (x) { return x.projekt_id === pid; });
      var zd = Array.isArray(pr.ziel_details) ? pr.ziel_details : [];
      var name = function (b) { return b.kontakte ? ((b.kontakte.vorname || "") + " " + (b.kontakte.nachname || "")).trim() : b.name || ""; };
      var person = function (b) { var info = [b.rolle, b.kontakte && b.kontakte.position].filter(Boolean).join(" · ");
        return "<li>" + (b.kontakte ? '<a href="/strategie/kontakte.html#k=' + b.kontakte.id + '">' + esc(name(b)) + "</a>" : "<b>" + esc(name(b)) + "</b>") + (info ? "<span>" + esc(info) + "</span>" : "") +
          '<button type="button" class="vt-p-weg" data-bet-weg="' + b.id + '" aria-label="Aus dem Team nehmen">×</button></li>'; };
      var seite = function (titel, l) { return '<div class="pj-team-teil"><h3>' + titel + "</h3>" + (l.length ? "<ul>" + l.map(person).join("") + "</ul>" : '<p class="e-leer">Noch niemand eingetragen.</p>') + "</div>"; };
      // Grundinfo sofort, Details auf Klick (Daniel, 20.11.2026: „oben so eine Grundinfo, worum geht's … dann kann ich weiter aufklappen“);
      // Stoßrichtungen stehen im Fahrplan, nicht hier
      var kunde = bet.filter(function (b) { return b.seite === "Kunde"; }), eigen = bet.filter(function (b) { return b.seite !== "Kunde"; });
      // Aufklapper wie der Fahrplan: Überschrift, darunter der Ziel-Satz, rechts der Pfeil; Details und Team erst aufgeklappt (Daniel, 20.11.2026)
      z.innerHTML = '<details class="pj-sb-details"' + (PJ.sbOffen ? " open" : "") + '><summary><div class="pj-sb-kopf"><h2>Worum es geht</h2>' +
        (pr.ziel ? '<p class="pj-sb-ziel">' + esc(pr.ziel) + "</p>" : pr.thema ? '<p class="pj-sb-ziel">' + esc(pr.thema) + "</p>" : '<p class="e-leer">Noch kein Projektziel hinterlegt. Diktiere es mir, dann trage ich es ein.</p>') + "</div></summary>" +
        '<div class="pj-sb-auf"><div>' + (pr.ziel && pr.thema ? "<h4>Thema</h4><p>" + esc(pr.thema) + "</p>" : "") + (zd.length ? zd.map(function (d) { return "<h4>" + esc(d.titel || "") + "</h4>" + (d.text ? "<p>" + esc(d.text) + "</p>" : "") +
          ((d.punkte || []).length ? "<ul>" + d.punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""); }).join("") : '<p class="e-leer">Keine weiteren Details zum Ziel.</p>') + "</div>" +
        '<div class="pj-sb-team"><h3 class="pj-sb-team-titel">Projektteam</h3>' + (p.typ === "Kunde" ? seite("Beim Kunden", kunde) + seite("empiria und Partner", eigen) : seite("Beteiligte", bet)) +
        '<div class="vt-p-neu pj-team-neu"><input type="search" placeholder="Person hinzufügen" autocomplete="off"><select aria-label="Seite">' +
          (p.typ === "Kunde" ? '<option value="Kunde">beim Kunden</option><option value="empiria">empiria</option><option value="Partner">Partner</option>' : '<option value="Partner">Partner</option><option value="empiria">empiria</option><option value="Kunde">extern</option>') +
          '</select><ul class="vt-treffer"></ul></div></div></div></details>';
      z.querySelector(".pj-sb-details").addEventListener("toggle", function (ev) { PJ.sbOffen = ev.target.open; });
      inhalteZeichnen(p, pr, (r[3].data || []).filter(function (v) { return v.projekt_id === pid; }));
      z.querySelectorAll("[data-bet-weg]").forEach(function (b) { b.onclick = function () {
        db.from("projekt_beteiligte").delete().eq("id", +b.getAttribute("data-bet-weg")).then(function (x) { if (x && x.error) { toast("Nicht gespeichert: " + x.error.message); return; } steckbriefLaden(p); }); }; });
      var such = z.querySelector(".pj-team-neu input"), wahl = z.querySelector(".pj-team-neu select"), warte;
      such.oninput = function () { clearTimeout(warte); var s = such.value.trim(), ziel = z.querySelector(".pj-team-neu .vt-treffer"); if (s.length < 2) { ziel.innerHTML = ""; return; }
        warte = setTimeout(function () { vtSuche(s, ziel, function (k) {
          db.from("projekt_beteiligte").insert({ projekt_id: pid, kontakt_id: k.id, seite: wahl.value }).then(function (x) { if (x && x.error) { toast("Nicht gespeichert: " + x.error.message); return; } toast("Im Team."); steckbriefLaden(p); }); }); }, 250); };
    });
  }

  /* Inhalte aus der bisherigen Projektansicht (Daniel, 22.11.2026, Eskalation: „Ich brauche diese Ausarbeitungen aus der alten Sicht
     bei allen Projekten in der neuen Sicht“): Ausarbeitung (Workshop), Lagebericht, Überlegungen, Verlauf – je als Aufklapper. */
  // Ablage im Finder zeigen: Ordner öffnen, Dokument markiert (Daniel, 22.11.2026). Hilfsprogramm „empiria Finder“ auf dem Mac nimmt den Link an.
  function finderPfad(a) {
    a = String(a || "").trim();
    if (a.indexOf("/Users/danielstroebel/nextcloud_EMP/") === 0) return a.slice(36);
    if (/^claude\//.test(a)) return "empiria GmbH - Intern/" + a;
    if (/^empiria GmbH - [^/]+\//.test(a)) return a;
    return "";
  }
  function klappKasten(kl, titel, unter, inhalt, offen) {
    return '<details class="lg-kasten pj-fahrplan pj-klapp ' + kl + '"' + (offen ? " open" : "") + '><summary><h2>' + titel + "</h2>" + (unter ? "<span>" + esc(unter) + "</span>" : "") + '</summary><div class="pj-klapp-inhalt">' + inhalt + "</div></details>";
  }
  function wsText(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function wsListe(l, tag) { return "<" + tag + ' class="ws-liste">' + l.map(function (y) { return "<li>" + wsText(y) + "</li>"; }).join("") + "</" + tag + ">"; }
  function ausarbeitungHtml(w) {
    return (w.stand ? '<p class="pj-ws-stand">' + esc(w.stand) + "</p>" : "") + (w.abschnitte || []).map(function (a) {
      return '<section class="pj-ws-teil"><h3>' + esc(a.titel) + "</h3>" + (a.inhalt || []).map(function (x) {
        if (x.p) return "<p>" + wsText(x.p) + "</p>";
        if (x.liste) return wsListe(x.liste, "ul");
        if (x.nummern) return wsListe(x.nummern, "ol");
        if (x.tabelle) return '<table class="pj-ws-tabelle"><thead><tr>' + x.tabelle.kopf.map(function (k) { return "<th>" + esc(k) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          x.tabelle.zeilen.map(function (z) { return "<tr>" + z.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
        if (x.agenda) return '<div class="pj-ag">' + x.agenda.map(function (b) {
          var zeit = '<p class="pj-ag-zeit">' + esc(b.von) + "–" + esc(b.bis) + "</p>";
          if (b.pause) return '<div class="pj-ag-block pj-ag-pause">' + zeit + "<p>" + esc(b.block) + "</p></div>";
          var text = [].concat(b.text || []).map(function (s) { return s && s.liste ? wsListe(s.liste, "ul") : "<p>" + wsText(s) + "</p>"; }).join("");
          var mk = (b.methoden || []).map(function (id) { var m = (window.METHODEN || []).filter(function (y) { return y.id === id; })[0];
            return '<a class="pj-ag-methode-link" href="/strategie/methoden.html#' + esc(id) + '">Methode ' + esc(m ? m.titel : id) + " →</a>"; }).join("");
          var bild = b.bild && window.WorkshopBilder && window.WorkshopBilder[b.bild] ? '<div class="pj-ag-bild">' + window.WorkshopBilder[b.bild] + "</div>" : "";
          return '<div class="pj-ag-block">' + zeit + '<div class="pj-ag-inhalt"><p class="pj-ag-titel">' + esc(b.block) + "</p>" +
            (b.methode && b.methode !== "–" ? '<p class="pj-ag-methode">' + esc(b.methode) + "</p>" : "") +
            '<div class="pj-ag-koerper"><div>' + text + (mk ? '<p class="pj-ag-links">' + mk + "</p>" : "") + "</div>" + bild + "</div></div></div>";
        }).join("") + "</div>";
        return "";
      }).join("") + "</section>";
    }).join("");
  }
  function inhalteZeichnen(p, pr, verlauf) {
    var oben = el.querySelector("[data-pj-mehr]"), unten = el.querySelector("[data-pj-verlauf]"); if (!oben || !unten) return;
    var h = "";
    var w = pr.workshop;
    if (w && (w.abschnitte || []).length) h += klappKasten("pj-ausarbeitung", "Ausarbeitung", w.titel || (w.abschnitte || []).map(function (a) { return String(a.titel).replace(/^\d+\.\s*/, ""); }).join(" · "), ausarbeitungHtml(w));
    var s = pr.statusbericht, bl = s && s.bloecke ? s.bloecke : [];
    if (bl.length) h += klappKasten("pj-lagebericht", "Lagebericht", s.stand ? "Stand " + datum(s.stand) + s.stand.slice(2, 4) : "", bl.map(function (x) {
      return "<h3>" + esc(x.titel) + "</h3>" + wsListe(x.punkte || [], "ul"); }).join(""));
    var ueb = String(pr.ueberlegungen || "").split("\n").map(function (x) { return x.replace(/^[•\-–]\s*/, "").trim(); }).filter(Boolean);
    if (ueb.length) h += klappKasten("pj-ueberlegungen", "Überlegungen", ueb.length + (ueb.length === 1 ? " Punkt" : " Punkte"), wsListe(ueb, "ul"));
    oben.innerHTML = h;
    var ART = { aufgabe: "Aufgabe", gate: "Meilenstein", projektgate: "Meilenstein", notiz: "Notiz", status: "Status" };
    unten.innerHTML = verlauf.length ? klappKasten("pj-verlauf", "Verlauf", verlauf.length + " Einträge – was im Projekt passiert ist", '<ul class="pj-verlauf-liste">' + verlauf.map(function (v, i) {
      var tx = v.inhalt && typeof v.inhalt === "object" ? v.inhalt.text : typeof v.inhalt === "string" ? v.inhalt : "";
      return "<li" + (i >= 25 ? ' class="pj-mehr-verlauf" hidden' : "") + "><span>" + datum(String(v.datum).slice(0, 10)) + String(v.datum).slice(2, 4) + "</span><div><b>" + esc(v.titel || "") + "</b>" +
        '<small>' + esc(ART[v.art] || v.art || "") + "</small>" + (tx ? "<p>" + esc(String(tx).slice(0, 600)) + "</p>" : "") + "</div></li>"; }).join("") + "</ul>" +
      (verlauf.length > 25 ? '<button type="button" class="pj-alle" data-verlauf-alle>Alle ' + verlauf.length + " zeigen</button>" : "")) : "";
    briefNachladen();
    var va = unten.querySelector("[data-verlauf-alle]");
    if (va) va.onclick = function () { unten.querySelectorAll(".pj-mehr-verlauf").forEach(function (x) { x.hidden = false; }); va.remove(); };
  }
  /* Neue Ansicht der Projektseite (Daniel, 26.11.2026: „Information Overkill … ich sehe nicht das, was mich schlau macht zum Projekt“).
     Aufgebaut wie die Projektübersicht in Projektwerkzeugen (Linear, Asana, Basecamp): Worum es geht → wie es steht → was als Nächstes passiert
     (Termine und fällige Aufgaben auf einer Zeitachse) → Termine mit Protokollen → Fahrplan; rechts Aufgaben, Entscheidungen, Unterlagen.
     Der Lagebericht steht im Stand statt daneben; Verlauf und „Zuletzt erledigt“ entfallen in dieser Ansicht. Umschaltbar, bisherige Anordnung bleibt Standard. */
  function pjAnsicht() { try { return localStorage.getItem("projekt-ansicht") || "bisher"; } catch (x) { return "bisher"; } }
  function projektBrief(offen, ter) {
    var raster = el.querySelector(".lg-raster"); if (!raster) return;
    var q = function (sel) { return el.querySelector(sel); };
    var kasten = function (titel) { return [].slice.call(el.querySelectorAll(".lg-rechts > .lg-kasten, .lg-links > .lg-kasten")).filter(function (k) { var h = k.querySelector("h2"); return h && h.textContent === titel; })[0]; };
    // Als Nächstes: Termine der nächsten vier Wochen und Aufgaben mit Frist (auch überfällige), nach Datum
    var jetzt = Date.now(), grenze = jetzt + 28 * 864e5;
    var VB = { offen: "Vorbereitung offen", laeuft: "Vorbereitung läuft", vorbereitet: "vorbereitet" };
    var l = ter.filter(function (t) { var ms = new Date(t.ende || t.start).getTime(); return ms >= jetzt && new Date(t.start).getTime() <= grenze; })
      .map(function (t) { return { ts: t.start, titel: t.betreff, zeit: tpZeit(t.start), was: "Termin" + (VB[t.vorbereitung] ? " · " + VB[t.vorbereitung] : "") }; })
      .concat(offen.filter(function (a) { return a.faellig_am && new Date(a.faellig_am + "T12:00:00").getTime() <= grenze && (a.faellig_am >= HEUTE || wer2(a) !== "andere"); }).map(function (a) {
        var w = wer2(a), ueber = a.faellig_am < HEUTE;
        return { ts: a.faellig_am + "T12:00:00", titel: a.titel, zeit: "", ueber: ueber, was: "Aufgabe · " + (w === "du" ? "bei dir" : w === "claude" ? "bei Claude" : esc(a.verantwortlich || "offen")) + (ueber ? " · überfällig" : "") }; }))
      .sort(function (x, y) { return new Date(x.ts) - new Date(y.ts); });
    var naechstes = document.createElement("section"); naechstes.className = "lg-kasten pb-naechstes";
    naechstes.innerHTML = "<h2>Als Nächstes</h2>" + (l.length ? '<ul class="pb-liste">' + l.slice(0, 8).map(function (x) {
      return '<li' + (x.ueber ? ' class="pb-ueber"' : "") + '><span class="pb-d">' + tpTag(x.ts) + (x.zeit ? "<small>" + x.zeit + "</small>" : "") + "</span><div><b>" + esc(x.titel) + "</b><small>" + x.was + "</small></div></li>"; }).join("") + "</ul>" +
      (l.length > 8 ? '<p class="pb-mehr">Weitere ' + (l.length - 8) + " in den nächsten vier Wochen – alle Aufgaben rechts, alle Termine unten.</p>" : "") : '<p class="e-leer">In den nächsten vier Wochen steht nichts an.</p>');
    var haupt = document.createElement("div"); haupt.className = "pb-haupt";
    var seite = document.createElement("aside"); seite.className = "pb-seite";
    var tp = q(".pj-tp"); if (tp) tp.open = true;
    [q(".pj-steckbrief"), q(".pj-stand"), naechstes, kasten("Meilensteine"), tp, q(".pj-fp")].forEach(function (x) { if (x) haupt.appendChild(x); });
    var unt = kasten("Arbeitsstände"); if (unt) { unt.querySelector("h2").textContent = "Unterlagen"; var ps = q(".pj-seite"); if (ps) unt.appendChild(ps); var alt = q(".lage-alt"); if (alt) unt.appendChild(alt); }
    [q(".pj-spalten"), kasten("Offene Entscheidungen"), unt, q("[data-pj-mehr]")].forEach(function (x) { if (x) seite.appendChild(x); });
    // ausgeblendet, aber im Dokument: der Verlauf-Platzhalter wird beim Nachladen noch gebraucht
    [q(".pj-erledigt"), q("[data-pj-verlauf]")].forEach(function (x) { if (x) { x.hidden = true; x.style.display = "none"; seite.appendChild(x); } });
    raster.innerHTML = ""; raster.className = "pb"; raster.appendChild(haupt); raster.appendChild(seite);
  }
  // Lagebericht in den Stand holen (er ist der ausführliche Stand, kein eigener Bereich)
  function briefNachladen() {
    if (pjAnsicht() !== "brief") return;
    var lb = el.querySelector(".pj-lagebericht"), st = el.querySelector(".pb .pj-stand");
    if (lb && st) { lb.classList.add("pb-lagebericht"); lb.classList.remove("lg-kasten"); var h = lb.querySelector("summary h2"); if (h) h.textContent = "Ausführlicher Lagebericht"; st.appendChild(lb); }
  }
  function iso2(ts) { return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); }


  /* =============== Termine – Management-Blick auf den laufenden Tag =============== */
  var TM = { tag: "heute", liste: [], br: {}, wahl: null, cache: {} };
  function termineLaden() {
    var von = new Date(HEUTE + "T00:00:00"), bis = new Date(von.getTime() + 7 * 864e5);   // die nächsten 7 Tage (Daniel, 18.11.2026)
    Promise.all([
      db.from("termine").select("id, ical_uid, graph_id, betreff, start, ende, kalender, postfach, ort, teilnehmer, extern, projekt_id, vorbereitung, abgesagt, ganztags, nachbereitet").eq("im_kalender", true)
        .gte("start", von.toISOString()).lt("start", bis.toISOString()).order("start"),
      db.from("termin_briefing").select("*").gte("gilt_fuer", HEUTE),
      db.from("projekte").select("id, name, marke").eq("status", "läuft"),
      db.from("eingang").select("typ, frist")
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Termine konnten nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      TM.liste = (r[0].data || []).filter(function (t) { return !t.abgesagt && !t.ganztags; });
      (r[1].data || []).forEach(function (b) { TM.br[b.ical_uid] = b; });
      (r[2].data || []).forEach(function (p) { P[p.id] = p; });
      E = r[3].data || [];
      TM.punkte = {};
      var schl = TM.liste.filter(function (t) { return t.graph_id; }).map(function (t) { return "kalender:" + t.graph_id; });
      if (schl.length) {
        db.from("projekt_ereignisse").select("id, aktivitaet_extern").in("aktivitaet_extern", schl).then(function (re) {
          var ids = {}; (re.data || []).forEach(function (e) { if (e.aktivitaet_extern) ids[e.id] = e.aktivitaet_extern.slice(9); });
          var eids = Object.keys(ids).map(Number); if (!eids.length) return;
          db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am").in("ereignis_id", eids).order("angelegt_am").order("id").then(function (rp) {
            if (rp && rp.data) rp.data.sort(function (a, b) { return String(a.angelegt_am).localeCompare(String(b.angelegt_am)) || a.id - b.id; });   // gleiche Uhrzeit: Reihenfolge des Anlegens
            (rp.data || []).forEach(function (p) { var g = ids[p.ereignis_id]; (TM.punkte[g] = TM.punkte[g] || []).push(p); });
            if (TM.wahl) termine();
          });
        });
      }
      var jetztMs = Date.now(), heute = TM.liste.filter(function (t) { return iso2(t.start) === HEUTE; });
      var naechster = heute.filter(function (t) { return new Date(t.ende).getTime() > jetztMs; })[0];
      TM.wahl = naechster || TM.liste.filter(function (t) { return new Date(t.ende).getTime() > jetztMs; })[0] || TM.liste[0] || null;
      var gh = location.hash.match(/g=([^&]+)/);   // Sprung aus dem Projekt in einen bestimmten Termin
      if (gh) { var gz = TM.liste.filter(function (t) { return t.graph_id === decodeURIComponent(gh[1]); })[0]; if (gz) TM.wahl = gz; }
      TM.ersterSprung = true;   // beim Öffnen: aktueller Termin steht oben in der Liste (Daniel, 18.11.2026)
      termine();
    });
  }
  function tmArt(t) {
    var b = (t.betreff || "").toLowerCase();
    if (/^(anfahrt|rückfahrt|anreise|abreise|fahrt)/.test(b)) return ["Fahrt", "grau"];
    if (t.kalender === "Aufgaben" || t.kalender === "Block" || !(t.teilnehmer || []).length) return ["Arbeitsblock", "tinte"];
    return ["Termin", "cy"];
  }
  function termine() {
    zahlImMenue();
    // Zwei eigene Scrollbereiche (Daniel, 18.11.2026): die Liste behält ihre Position, ein neu gewählter Termin beginnt oben
    var altListe = el.querySelector(".tm-liste"), listePos = altListe ? altListe.scrollTop : 0;
    var altDetail = el.querySelector(".tm-detail"), detailPos = altDetail && TM.gezeigt === TM.wahl ? altDetail.scrollTop : 0;
    var l = TM.liste, tage = [];
    l.forEach(function (t) { var d = iso2(t.start); if (tage.indexOf(d) < 0) tage.push(d); });
    var jetztMs = Date.now(), letzterTag = "";
    el.innerHTML = '<div class="k7 lage"><header class="k7-kopf"><div class="k7-titel"><h1>Termine</h1><span>die nächsten 7 Tage</span></div>' +
      '<nav class="k7-pillen tm-tage">' + tage.map(function (d) { return '<button type="button" data-sprung="' + d + '">' + esc(d === HEUTE || d === plus(1) ? tmTagName(d, true) : new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })) + "</button>"; }).join("") + "</nav></header>" +
      '<section class="k7-band"><div class="k7-raster' + (TM.wahl ? " hat-detail" : "") + '"><ul class="k7-liste tm-liste">' + (l.length ? l.map(function (t) {
        var a = tmArt(t), b = TM.br[t.ical_uid] || {}, vorbei = new Date(t.ende).getTime() < jetztMs, d = iso2(t.start);
        var kopf = d !== letzterTag ? '<li class="tm-tag" data-tag-kopf="' + d + '">' + esc(tmTagName(d, true)) + (d === HEUTE || d === plus(1) ? '<span>' + esc(new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })) + "</span>" : "") + "</li>" : "";
        letzterTag = d;
        var bezug = [P[b.projekt_id] ? P[b.projekt_id].name : "", tmMarke(t, b)].filter(Boolean).join(" · ");
        return kopf + '<li data-tid="' + t.id + '"' + (t === TM.wahl ? ' aria-current="true"' : "") + (vorbei ? ' class="tm-vorbei"' : "") + '><p class="tm-zeit"><b>' + uhr(t.start) + "–" + uhr(t.ende) + '</b><span class="k7-etikett k7-e-' + a[1] + '">' + a[0] + "</span></p>" +
          "<b>" + esc(t.betreff) + "</b>" + (b.zusammenfassung ? '<p class="tm-kurz">' + esc(String(b.zusammenfassung).replace(/^[^:\n\d]{2,40}:\s+/, "")) + "</p>" : "") +
          (bezug ? "<small>" + esc(bezug) + "</small>" : "") + "</li>";
      }).join("") : '<li class="e-leer">Keine Termine in den nächsten 7 Tagen.</li>') + "</ul>" +
      '<div class="k7-detail tm-detail">' + (TM.wahl ? '<button type="button" class="e-zurueck" data-zurueck>‹ Termine</button>' + tmDetail(TM.wahl) : '<p class="e-leer">Wähle links einen Termin.</p>') + "</div></div></section></div>";
    // Sprung zu einem Tag: Liste dorthin scrollen (auf dem Tablet in der Liste, auf dem Telefon auf der Seite)
    el.querySelectorAll("[data-sprung]").forEach(function (b) { b.onclick = function () {
      var k = el.querySelector('[data-tag-kopf="' + b.getAttribute("data-sprung") + '"]'), li = el.querySelector(".tm-liste");
      if (window.innerWidth <= 900 && TM.wahl) { TM.wahl = null; termine(); k = el.querySelector('[data-tag-kopf="' + b.getAttribute("data-sprung") + '"]'); li = el.querySelector(".tm-liste"); }
      if (!k) return;
      // Gemessen am ersten Termin des Tages: die Überschrift selbst haftet oben und meldet dann ihre Haftposition statt ihrer Stelle in der Liste
      var erster = k.nextElementSibling || k;
      if (window.innerWidth > 900) li.scrollTo({ top: erster.getBoundingClientRect().top - li.getBoundingClientRect().top + li.scrollTop - k.offsetHeight - 4, behavior: "smooth" }); else window.scrollTo({ top: k.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
    }; });
    el.querySelectorAll(".tm-liste [data-tid]").forEach(function (li) { li.onclick = function () { TM.wahl = TM.liste.filter(function (t) { return t.id === +li.getAttribute("data-tid"); })[0]; termine(); if (window.innerWidth <= 900) window.scrollTo(0, 0); }; });
    var z = el.querySelector("[data-zurueck]"); if (z) z.onclick = function () { TM.wahl = null; termine(); };
    var nl = el.querySelector(".tm-liste"), nd = el.querySelector(".tm-detail");
    if (nl) nl.scrollTop = listePos;
    if (nd) nd.scrollTop = detailPos;
    // Beim Öffnen der Seite: Liste so weit, dass der aktuelle oder nächste Termin oben steht (unter der Tagesüberschrift);
    // erledigte Termine von heute bleiben darüber und sind mit einem Zug nach unten sichtbar
    if (TM.ersterSprung && nl && TM.wahl && window.innerWidth > 900) {
      var ziel = nl.querySelector('[data-tid="' + TM.wahl.id + '"]'), kopf = nl.querySelector(".tm-tag");
      if (ziel) nl.scrollTop = ziel.getBoundingClientRect().top - nl.getBoundingClientRect().top + nl.scrollTop - (kopf ? kopf.offsetHeight + 4 : 0);
    }
    TM.ersterSprung = false;
    if (TM.gezeigt !== TM.wahl && window.innerWidth > 900 && nd && nd.getBoundingClientRect().top < 60) window.scrollTo(0, 0);   // Kopf des Termins sichtbar
    TM.gezeigt = TM.wahl;
    if (TM.wahl) tmTiefer(TM.wahl);
    tmKnoepfe();
  }
  // Tag als „heute“, „morgen“ oder „Freitag, 20.11.“; Marke aus dem Projekt, sonst aus dem Kalenderkonto
  function tmTagName(d, gross) {
    if (d === HEUTE) return gross ? "Heute" : "heute";
    if (d === plus(1)) return gross ? "Morgen" : "morgen";
    return new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
  }
  function tmMarke(t, b) {
    var p = P[(b || {}).projekt_id] || P[t.projekt_id];
    return p ? p.marke : ({ empiria: "empiria", sofortsichtbar: "sofortsichtbar", "Müller&Ströbel.": "Müller&Ströbel.", ms: "Müller&Ströbel.", ss: "sofortsichtbar" }[t.postfach] || t.postfach || "");
  }
  function tmDetail(t) {
    var a = tmArt(t), b = TM.br[t.ical_uid] || {}, punkte = liste2(b.punkte), unt = liste2(b.unterlagen);
    return '<article class="e-detail" data-tid="' + t.id + '"><div class="e-d-kopf"><span class="k7-etikett k7-e-' + a[1] + '">' + a[0] + '</span><span class="e-d-meta">' +
      tmTagName(iso2(t.start)) + " " + uhr(t.start) + "–" + uhr(t.ende) + (t.ort ? " · " + esc(t.ort) : "") + " · " + esc(tmMarke(t, b)) + "</span></div><h2>" + esc(t.betreff) + "</h2>" +
      '<div class="e-inhalt">' + (b.zusammenfassung ? '<div class="e-block e-vorschlag"><h3>Worum es geht</h3>' + themenText(b.zusammenfassung, false) + "</div>" : '<div class="e-block"><p>Für diesen Termin hat der Stabschef noch keine Zusammenfassung geschrieben.</p></div>') +
      (b.ziel ? '<div class="e-block"><h3>Was du herausholen solltest</h3>' + themenText(b.ziel, true) + "</div>" : "") +
      (punkte.length ? '<div class="e-block"><h3>Offene Punkte</h3><ul class="e-punkte">' + punkte.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>" : "") +
      (liste2(b.fragen).length ? '<div class="e-block tm-fragen"><h3>' + (tmArt(t)[0] === "Termin" ? "Ziel- und Impulsfragen" : "Leitfragen für dich") + '</h3><ul>' + liste2(b.fragen).map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul></div>" : "") +
      (function () {
        var pp = (TM.punkte || {})[t.graph_id] || [], h = "";
        [["Vorbereitung", "Gesprächsvorbereitung", " tm-vorb"], ["Protokoll", "Protokoll", ""], ["Entscheidung", "Entscheidungen", ""]].forEach(function (a) {
          var l = pp.filter(function (p) { return p.art === a[0]; }); if (!l.length) return;
          h += '<div class="e-block' + a[2] + '"><h3>' + a[1] + '</h3><ul class="tm-pp">' + l.map(function (p) {
            var m = String(p.text).match(/^([^:]{2,40}):\s*([\s\S]*)$/);
            return "<li>" + (m ? "<b>" + esc(m[1]) + "</b>" + gegliedert(m[2]) : gegliedert(p.text)) + "</li>"; }).join("") + "</ul></div>";
        });
        return h;
      })() +
      (unt.length ? '<div class="e-block e-ablage"><h3>Unterlagen</h3>' + unt.map(function (u) { return /^https?:/.test(u) ? '<p><a class="e-link" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + "</a></p>" : "<p>" + esc(u) + "</p>"; }).join("") + "</div>" : "") +
      '</div><div class="tm-tiefer" data-tiefer><p class="e-leer">Details werden geladen …</p></div>' +
      '<div class="tm-input"><h3>' + (new Date(t.ende).getTime() < Date.now() ? "Wie lief es? Protokoll" : "Dein Input zu diesem Termin") + '</h3><p>Diktieren oder einfügen. Claude legt daraus Punkte und Aufgaben im Projekt an.</p>' +
        '<form class="tm-protokoll"><textarea rows="4" placeholder="' + (new Date(t.ende).getTime() < Date.now() ? "Was wurde besprochen, entschieden, wer macht was bis wann?" : "Was ist dir für den Termin wichtig, was willst du erreichen?") + '"></textarea><button class="e-k e-k-voll" type="submit">Übergeben</button></form></div>' +
      '<div class="e-knoepfe"><button class="e-k" data-tm="hinweis">Vorbereitung anfordern</button>' + (t.vorbereitung === "offen" || t.vorbereitung === "laeuft" ? '<button class="e-k" data-tm="fertig">Ich bin vorbereitet</button>' : "") + "</div>" +
      '<form class="e-text" hidden><textarea rows="3" placeholder="Was soll Claude für diesen Termin vorbereiten?"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form><p class="e-ok" hidden></p></article>';
  }
  /* Eine Ebene tiefer: alles, was zu Teilnehmern und Projekt vorliegt */
  function tmTiefer(t) {
    var b = TM.br[t.ical_uid] || {}, ids = b.kontakt_ids || [], pid = b.projekt_id || t.projekt_id, ziel = el.querySelector("[data-tiefer]");
    var key = t.ical_uid;
    function zeigen(d) {
      if (!ziel || !el.contains(ziel)) return;
      var teil = (d.kontakte || []).map(function (k) {
        return '<li><b>' + esc((k.vorname || "") + " " + (k.nachname || "")) + "</b><small>" + [esc(k.position || ""), esc((k.organisationen || {}).name || ""), k.beziehungsstatus ? "Beziehung: " + esc(k.beziehungsstatus) : "", k.letzter_kontakt ? "letzter Kontakt " + datum(String(k.letzter_kontakt).slice(0, 10)) : ""].filter(Boolean).join(" · ") + "</small>" +
          (k.kontaktbriefing ? '<p><span class="tm-label">Kontaktplan im CRM:</span> ' + esc(String(k.kontaktbriefing).slice(0, 500)) + "</p>" : "") + "</li>"; }).join("");
      var andere = (t.teilnehmer || []).filter(function (n) { return !(d.kontakte || []).some(function (k) { return n.indexOf(k.nachname) >= 0 || n.toLowerCase().indexOf(String(k.nachname).toLowerCase()) >= 0; }); });
      var akt = (d.aktivitaeten || []).map(function (x) { return "<li><span>" + datum(String(x.datum).slice(0, 10)) + "</span>" + esc([x.kanal, x.anlass, x.ergebnis].filter(Boolean).join(" · ")) + "</li>"; }).join("");
      var aufg = (d.aufgaben || []).map(function (x) { return "<li><span>" + (x.faellig_am ? datum(x.faellig_am) : "–") + "</span>" + esc(x.titel) + " · " + esc(x.verantwortlich || "") + "</li>"; }).join("");
      var prot = (d.punkte || []).map(function (x) { return "<li><span>" + datum(String(x.angelegt_am).slice(0, 10)) + "</span>" + esc(String(x.text).slice(0, 220)) + "</li>"; }).join("");
      var st = d.status;
      ziel.innerHTML = '<h3 class="tm-ebene">Eine Ebene tiefer</h3>' +
        '<details class="tm-auf" open><summary>Teilnehmer</summary>' + (teil || andere.length ? '<ul class="tm-personen">' + teil + andere.map(function (n) { return "<li><b>" + esc(n) + "</b><small>nicht in den Kontakten</small></li>"; }).join("") + "</ul>" : '<p class="e-leer">Keine Teilnehmer, eigener Arbeitsblock.</p>') + "</details>" +
        (pid && P[pid] ? '<details class="tm-auf"><summary>Projekt: ' + esc(P[pid].name) + "</summary>" + (st ? '<p class="tm-stand"><i class="lg-a-' + st.ampel + '"></i>' + esc(st.satz) + "</p>" + (st.naechster_schritt ? '<p class="lg-naechst">Nächster Schritt: ' + esc(st.naechster_schritt) + "</p>" : "") : "") +
          (aufg ? '<h4>Offene Aufgaben</h4><ul class="pj-zeit">' + aufg + "</ul>" : "") + (prot ? '<h4>Letzte Protokollpunkte</h4><ul class="pj-zeit">' + prot + "</ul>" : "") +
          '<p><a class="lage-alt" href="/strategie/projekt.html#p=' + pid + '">Projekt öffnen</a></p></details>' : "") +
        (akt ? '<details class="tm-auf"><summary>Letzte Kontakte</summary><ul class="pj-zeit">' + akt + "</ul></details>" : "");
    }
    if (TM.cache[key]) return zeigen(TM.cache[key]);
    var q = [
      ids.length ? db.from("kontakte").select("id, vorname, nachname, position, beziehungsstatus, letzter_kontakt, kontaktbriefing, organisationen(name)").in("id", ids) : Promise.resolve({ data: [] }),
      ids.length ? db.from("aktivitaeten").select("kontakt_id, datum, kanal, anlass, ergebnis").in("kontakt_id", ids).order("datum", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
      pid ? db.from("projekt_status").select("ampel, satz, naechster_schritt, gilt_fuer").eq("projekt_id", pid).order("gilt_fuer", { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
      pid ? db.from("aufgaben").select("titel, verantwortlich, faellig_am, spalte, art").eq("projekt_id", pid).eq("status", "offen").order("faellig_am").limit(10) : Promise.resolve({ data: [] }),
      pid ? db.from("projekt_punkte").select("angelegt_am, text").eq("projekt_id", pid).order("angelegt_am", { ascending: false }).limit(6) : Promise.resolve({ data: [] })
    ];
    Promise.all(q).then(function (r) {
      var d = { kontakte: r[0].data || [], aktivitaeten: r[1].data || [], status: (r[2].data || [])[0], aufgaben: (r[3].data || []).filter(function (a) { return a.spalte !== "backlog" && a.art !== "gate" && a.art !== "projektgate"; }), punkte: r[4].data || [] };
      TM.cache[key] = d; zeigen(d);
    });
  }
  function tmKnoepfe() {
    var d = el.querySelector(".tm-detail .e-detail"); if (!d) return;
    var t = TM.wahl, ok = d.querySelector(".e-ok"), fo = d.querySelector(".e-text");
    d.querySelectorAll("[data-tm]").forEach(function (b) {
      b.onclick = function () {
        if (b.getAttribute("data-tm") === "hinweis") { fo.hidden = !fo.hidden; if (!fo.hidden) fo.querySelector("textarea").focus(); return; }
        b.disabled = true;
        db.from("termine").update({ vorbereitung: "vorbereitet", von_hand: true }).eq("id", t.id).then(function (r) {
          ok.hidden = false; ok.textContent = r.error ? "Nicht gespeichert: " + r.error.message : "Als vorbereitet vermerkt."; if (!r.error) { t.vorbereitung = "vorbereitet"; toast("Vorbereitet: " + t.betreff); }
        });
      };
    });
    var pf = d.querySelector(".tm-protokoll");
    if (pf) pf.onsubmit = function (ev) {
      ev.preventDefault(); var txt = pf.querySelector("textarea").value.trim(); if (!txt) return; pf.querySelector("button").disabled = true;
      protokollTicket(t, (TM.br[t.ical_uid] || {}).projekt_id || t.projekt_id, txt).then(function (r) {
        ok.hidden = false; ok.textContent = r.error ? "Nicht gespeichert: " + r.error.message : "Übergeben. Claude legt Punkte und Aufgaben im Projekt an und legt dir das Ergebnis zur Abnahme vor.";
        if (!r.error) { toast("Übergeben: " + t.betreff); pf.querySelector("textarea").value = ""; }
      });
    };
    fo.onsubmit = function (ev) {
      ev.preventDefault(); var txt = fo.querySelector("textarea").value.trim(); if (!txt) return; fo.querySelector("button").disabled = true;
      var b = TM.br[t.ical_uid] || {};
      ticket({ titel: t.betreff, quelle: "termin", qid: t.id, projekt_id: b.projekt_id || t.projekt_id }, "Vorbereitung für den Termin „" + t.betreff + "“ am " + datum(iso2(t.start)) + " um " + uhr(t.start) + ": " + txt, "Vorbereitung: " + t.betreff).then(function (r) {
        ok.hidden = false; ok.textContent = r.error ? "Nicht gespeichert: " + r.error.message : "Als Ticket bei Claude (Sofort-Spur). Die Vorbereitung kommt zur Abnahme in den Eingang.";
        if (!r.error) toast("Vorbereitung angefordert: " + t.betreff);
      });
    };
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

  /* =============== Vertrieb – Vertriebschancen vom Ansatzpunkt bis zum Projekt ===============
     Daniel, 20.11.2026: „Marketing hat den Auftrag, den Trichter zu füllen und Leads herzustellen. Vertrieb hat den Auftrag, diese
     Personen im Trichter weiterzuschieben bis zum Projekt.“ Und nachgeschärft: „Wir können nicht mit einzelnen Personen arbeiten,
     sondern im Rahmen von Vertriebschancen und Projekten … in echten Leads denken und überlegen, wer gehört zusammen.“
     Arbeitsprinzip wie in Vertriebs-Pipelines (Pipedrive, HubSpot): jede Chance hat einen nächsten Schritt; fehlt er oder ist er
     überfällig, fällt die Karte auf. Der Marketing- und Vertriebsstratege schreibt je Chance den Hebel und schlägt neue Chancen vor. */
  var VT = { l: [], marke: (function () { try { return localStorage.getItem("vertrieb-marke") || "alle"; } catch (x) { return "alle"; } })(), wahl: null };
  // vier Stufen, jede mit einem Kriterium, ab wann die Chance weiterrückt (Daniel, 21.11.2026)
  var VT_STUFEN = [["ansatzpunkt", "Ansatzpunkt", "Anlass erkannt – weiter, wenn ein Gespräch zum Bedarf vereinbart ist"],
    ["bedarf", "Bedarf geklärt", "Problem, Entscheider, Zeit und Budget bekannt – weiter, wenn das Angebot rausgeht"],
    ["angebot", "Angebot beim Kunden", "Angebot liegt vor, Verhandlung – weiter mit der Zusage"],
    ["projekt", "Projekt", "Auftrag läuft – Folgeauftrag und Empfehlung gewinnen"]];
  // Ist es zum Projekt gekommen, trägt die Chance den echten Projekttitel (Daniel, 20.11.2026)
  function vtTitel(c) { return c.stufe === "projekt" && c.projekt_id && P[c.projekt_id] ? P[c.projekt_id].name : c.titel; }
  function vtPersonen(c) { return (c.vertriebschance_personen || []).filter(function (p) { return p.kontakte; }); }
  function vtPName(p) { var k = p.kontakte || {}; return ((k.vorname || "") + " " + (k.nachname || "")).trim(); }
  function vtFirma(c) { return c.organisationen ? c.organisationen.name : ""; }
  function vtStufeName(s) { return (VT_STUFEN.filter(function (x) { return x[0] === s; })[0] || ["", s])[1]; }
  function vtTage(d) { return Math.max(0, Math.round((new Date(HEUTE) - new Date(String(d).slice(0, 10))) / 864e5)); }
  function vtAchtung(c) { return !c.naechster_schritt ? "ohne" : c.faellig_am && c.faellig_am < HEUTE ? "spaet" : ""; }
  function vertriebLaden() {
    Promise.all([
      db.from("vertriebschancen").select("*, organisationen(name), vertriebschance_personen(kontakt_id, rolle, kontakte(id, vorname, nachname, position))").in("status", ["offen", "vorschlag"]),
      db.from("eingang").select("typ, frist, quelle, qid"),
      db.from("projekte").select("id, name, marke").eq("status", "läuft")
    ]).then(function (r) {
      var f = r.filter(function (x) { return x.error; })[0];
      if (f) { el.innerHTML = '<p class="e-hinweis">Vertrieb konnte nicht geladen werden: ' + esc(f.error.message) + "</p>"; return; }
      VT.l = (r[0].data || []).filter(function (c) { return c.status === "offen" || c.status === "vorschlag"; });
      E = r[1].data || []; (r[2].data || []).forEach(function (p) { P[p.id] = p; });
      vertriebSeite();
    });
  }
  function vtKarte(c) {
    var a = vtAchtung(c), pers = vtPersonen(c);
    return '<li><button type="button" class="vt-karte' + (VT.wahl === c.id ? " an" : "") + '" data-vt="' + c.id + '"><b>' + esc(vtTitel(c)) + "</b>" +
      (pers.length ? '<span class="vt-firma">' + esc(pers.map(vtPName).join(", ")) + "</span>" : vtFirma(c) ? '<span class="vt-firma">' + esc(vtFirma(c)) + "</span>" : "") +
      (a === "ohne" ? '<span class="vt-schritt vt-rot">Kein nächster Schritt</span>' :
        '<span class="vt-schritt' + (a === "spaet" ? " vt-rot" : "") + '">' + esc(c.naechster_schritt) + (c.faellig_am ? " · " + (a === "spaet" ? "seit " : "bis ") + datum(c.faellig_am) : "") + "</span>") +
      '<span class="vt-fuss">' + (VT.marke === "alle" ? esc(c.marke) + " · " : "") + "seit " + (vtTage(c.seit) === 0 ? "heute" : vtTage(c.seit) + (vtTage(c.seit) === 1 ? " Tag" : " Tagen")) + " in dieser Stufe" +
      (c.stufe_vorschlag && c.stufe_vorschlag !== c.stufe ? '</span><span class="vt-vorschlag">Claude sieht: ' + esc(vtStufeName(c.stufe_vorschlag)) : "") + "</span></button></li>";
  }
  function vertriebSeite() {
    zahlImMenue();
    var passt = function (c) { return VT.marke === "alle" || c.marke === VT.marke; };
    var l = VT.l.filter(function (c) { return c.status === "offen" && passt(c); }), vor = VT.l.filter(function (c) { return c.status === "vorschlag" && passt(c); });
    var ordnen = function (a, b) { var r = function (c) { return vtAchtung(c) === "spaet" ? 0 : vtAchtung(c) === "ohne" ? 1 : 2; };
      return r(a) - r(b) || String(a.faellig_am || "9").localeCompare(String(b.faellig_am || "9")) || vtTitel(a).localeCompare(vtTitel(b), "de"); };
    var pillen = '<nav class="k7-pillen">' + [["alle", "Alle Marken"]].concat(SG_MARKEN.map(function (m) { return [m, m]; })).map(function (m) {
      return '<button type="button" data-vt-marke="' + esc(m[0]) + '" aria-pressed="' + (m[0] === VT.marke) + '">' + esc(m[1]) + "</button>"; }).join("") + "</nav>";
    el.innerHTML = '<div class="k7 lage"><header class="k7-kopf"><div class="k7-titel"><h1>Vertrieb</h1><span>Vertriebschancen vom Ansatzpunkt bis zum Projekt</span></div>' + pillen + "</header>" +
      '<section class="k7-band"><div class="vt">' +
      '<p class="vt-hinweis">Hier stehen nur echte Chancen mit allen, die dazugehören. Eine Chance rückt weiter, wenn das Kriterium ihrer Stufe erfüllt ist. Jede Chance braucht einen nächsten Schritt; rot heißt: fehlt oder überfällig.</p>' +
      (vor.length ? '<div class="vt-vorschlaege"><h2>Vorschläge des Strategen <span>' + vor.length + "</span></h2><p>Neue Chancen aus den letzten Kontakten. Aufnehmen setzt sie auf das Board, Verwerfen merkt sich der Stratege.</p><ul>" + vor.map(function (c) {
        return '<li><div><b>' + esc(c.titel) + "</b><span>" + esc([vtStufeName(c.stufe), c.marke, vtPersonen(c).map(vtPName).join(", ")].filter(Boolean).join(" · ")) + "</span>" + (c.begruendung ? "<small>" + esc(c.begruendung) + "</small>" : "") +
          '</div><div class="vt-v-knoepfe"><button type="button" class="e-k e-k-voll" data-vt-auf="' + c.id + '">Aufnehmen</button><button type="button" class="e-k" data-vt-weg="' + c.id + '">Verwerfen</button></div></li>'; }).join("") + "</ul></div>" : "") +
      '<div class="vt-board">' + VT_STUFEN.map(function (s) {
        var k = l.filter(function (c) { return c.stufe === s[0]; }).sort(ordnen);
        return '<section class="vt-spalte"><header><h2>' + s[1] + " <span>" + k.length + '</span></h2><p>' + s[2] + "</p></header>" +
          (k.length ? '<ul class="vt-karten">' + k.map(vtKarte).join("") + "</ul>" : '<p class="e-leer">Keine Chance in dieser Stufe.</p>') + "</section>";
      }).join("") + "</div>" +
      '<button type="button" class="e-k vt-neu" data-vt-neu>Chance anlegen</button></div></section>' +
      '<div class="vt-schleier" hidden></div><aside class="vt-detail" hidden aria-label="Vertriebschance"></aside></div>';
    el.querySelectorAll("[data-vt-marke]").forEach(function (b) { b.onclick = function () { VT.marke = b.getAttribute("data-vt-marke"); try { localStorage.setItem("vertrieb-marke", VT.marke); } catch (x) {} vertriebSeite(); }; });
    el.querySelectorAll("[data-vt]").forEach(function (b) { b.onclick = function () { vtOeffnen(+b.getAttribute("data-vt")); }; });
    el.querySelectorAll("[data-vt-auf]").forEach(function (b) { b.onclick = function () { var c = vtChance(+b.getAttribute("data-vt-auf"));
      vtSpeichern(c, { status: "offen", seit: HEUTE }, "aufgenommen").then(function (r) { if (!r || !r.error) { toast("Aufgenommen: " + c.titel); vertriebSeite(); } }); }; });
    el.querySelectorAll("[data-vt-weg]").forEach(function (b) { b.onclick = function () { var c = vtChance(+b.getAttribute("data-vt-weg"));
      vtSpeichern(c, { status: "ruht", ergebnis_grund: "Vorschlag von Daniel verworfen" }, "verworfen").then(function (r) { if (!r || !r.error) { VT.l = VT.l.filter(function (x) { return x !== c; }); toast("Verworfen."); vertriebSeite(); } }); }; });
    el.querySelector("[data-vt-neu]").onclick = vtAnlegen;
    el.querySelector(".vt-schleier").onclick = vtSchliessen;
    if (VT.wahl) vtOeffnen(VT.wahl);
    if (!VT.tasten) { VT.tasten = true; document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && el.querySelector(".vt-detail:not([hidden])")) vtSchliessen(); }); }
  }
  function vtChance(id) { return VT.l.filter(function (x) { return x.id === id; })[0]; }
  function vtSchliessen() { VT.wahl = null; var d = el.querySelector(".vt-detail"), s = el.querySelector(".vt-schleier"); if (d) d.hidden = true; if (s) s.hidden = true;
    el.querySelectorAll(".vt-karte.an").forEach(function (x) { x.classList.remove("an"); }); document.documentElement.classList.remove("vt-offen"); }
  function vtSpeichern(c, felder, notiz) {
    var alt = c.stufe; felder.geaendert_am = new Date().toISOString();
    if (felder.stufe && felder.stufe !== alt) { felder.seit = HEUTE; felder.stufe_vorschlag = null; felder.begruendung = null; }
    return db.from("vertriebschancen").update(felder).eq("id", c.id).then(function (r) {
      if (r && r.error) { toast("Nicht gespeichert: " + r.error.message); return r; }
      Object.keys(felder).forEach(function (k) { c[k] = felder[k]; });
      if (felder.stufe && felder.stufe !== alt || felder.status) db.from("vertriebschance_verlauf").insert({ chance_id: c.id, von: alt, nach: felder.status && felder.status !== "offen" ? felder.status : felder.stufe || alt, wer: "Daniel", notiz: notiz || null });
      return r;
    });
  }
  function vtOeffnen(id) {
    var c = vtChance(id); if (!c) return;
    VT.wahl = id;
    el.querySelectorAll(".vt-karte").forEach(function (x) { x.classList.toggle("an", +x.getAttribute("data-vt") === id); });
    var d = el.querySelector(".vt-detail"), pers = vtPersonen(c);
    d.innerHTML = '<div class="vt-d-kopf"><div><h2>' + esc(vtTitel(c)) + "</h2><p>" + esc([vtFirma(c), c.marke].filter(Boolean).join(" · ")) +
      (c.projekt_id && P[c.projekt_id] ? ' · <a href="/strategie/projekt.html#p=' + c.projekt_id + '">Zum Projekt</a>' : "") + '</p></div><button type="button" class="vt-zu" aria-label="Schließen">×</button></div>' +
      '<div class="vt-stufen" role="group" aria-label="Stufe">' + VT_STUFEN.map(function (s) { return '<button type="button" data-vt-stufe="' + s[0] + '" aria-pressed="' + (c.stufe === s[0]) + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      (c.stufe_vorschlag && c.stufe_vorschlag !== c.stufe ? '<p class="vt-d-vorschlag">Claude sieht die Chance bei „' + esc(vtStufeName(c.stufe_vorschlag)) + "“" + (c.begruendung ? ": " + esc(c.begruendung) : ".") +
        ' <button type="button" class="e-k" data-vt-stufe="' + c.stufe_vorschlag + '">Übernehmen</button></p>' : "") +
      (c.hebel ? '<div class="vt-hebel"><h3>So kommt die Chance in die nächste Stufe</h3><p>' + esc(c.hebel) + "</p>" + (c.hebel_stand ? '<small>Marketing- und Vertriebsstratege · ' + datum(c.hebel_stand) + "</small>" : "") + "</div>" : "") +
      '<form class="vt-schritt-form"><h3>Nächster Schritt</h3><input name="schritt" type="text" value="' + esc(c.naechster_schritt || "") + '" placeholder="Was passiert als Nächstes?">' +
      '<div class="vt-zeile"><input name="faellig" type="date" value="' + esc(c.faellig_am || "") + '"><button class="e-k e-k-voll" type="submit">Speichern</button></div>' +
      '<h3>Titel</h3><input name="titel" type="text" value="' + esc(vtTitel(c)) + '"' + (vtTitel(c) !== c.titel ? ' readonly title="Titel des Projekts – ändern im Projekt"' : "") + '><h3>Vorhaben</h3><textarea name="vorhaben" rows="2" placeholder="Worum geht es?">' + esc(c.vorhaben || "") + "</textarea></form>" +
      '<div class="vt-pers"><h3>Wer dazugehört</h3><ul>' + pers.map(function (p) { var k = p.kontakte;
        return '<li><a href="/strategie/kontakte.html#k=' + k.id + '">' + esc(vtPName(p)) + "</a><span>" + esc([p.rolle, k.position].filter(Boolean).join(" · ")) + '</span><button type="button" class="vt-p-weg" data-vt-pweg="' + k.id + '" aria-label="Aus der Chance nehmen">×</button></li>'; }).join("") +
      '</ul><div class="vt-p-neu"><input type="search" placeholder="Person hinzufügen" autocomplete="off"><ul class="vt-treffer"></ul></div></div>' +
      '<div class="vt-stand"><h3>Letzte Kontakte</h3><div class="vt-stand-inhalt"><p class="e-leer">Lädt …</p></div></div>' +
      (c.begruendung && !(c.stufe_vorschlag && c.stufe_vorschlag !== c.stufe) ? '<p class="vt-begr"><b>Warum diese Stufe:</b> ' + esc(c.begruendung) + "</p>" : "") +
      '<form class="vt-auftrag"><h3>Auftrag an Claude</h3><textarea rows="2" placeholder="Zum Beispiel: Bereite das Folgegespräch vor"></textarea><button class="e-k e-k-voll" type="submit">Senden</button></form>' +
      '<div class="vt-d-fuss"><span>Chance beenden:</span><button type="button" class="e-k" data-vt-ende="gewonnen">Gewonnen</button><button type="button" class="e-k" data-vt-ende="verloren">Verloren</button><button type="button" class="e-k" data-vt-ende="ruht">Ruht</button></div>';
    d.hidden = false; el.querySelector(".vt-schleier").hidden = false; document.documentElement.classList.add("vt-offen"); d.scrollTop = 0;
    d.querySelector(".vt-zu").onclick = vtSchliessen;
    d.querySelectorAll("[data-vt-stufe]").forEach(function (b) { b.onclick = function () {
      var s = b.getAttribute("data-vt-stufe"); if (s === c.stufe) return;
      vtSpeichern(c, { stufe: s }).then(function (r) { if (!r || !r.error) { toast(vtTitel(c) + ": " + vtStufeName(s)); vertriebSeite(); } }); }; });
    d.querySelector(".vt-schritt-form").onsubmit = function (ev) { ev.preventDefault(); var f = ev.target;
      vtSpeichern(c, { naechster_schritt: f.schritt.value.trim() || null, faellig_am: f.faellig.value || null, titel: vtTitel(c) !== c.titel ? c.titel : f.titel.value.trim() || c.titel, vorhaben: f.vorhaben.value.trim() || null }).then(function (r) { if (!r || !r.error) { toast("Gespeichert."); vertriebSeite(); } }); };
    d.querySelectorAll("[data-vt-pweg]").forEach(function (b) { b.onclick = function () { var kid = +b.getAttribute("data-vt-pweg");
      db.from("vertriebschance_personen").delete().eq("chance_id", c.id).eq("kontakt_id", kid).then(function (r) { if (r && r.error) { toast("Nicht gespeichert: " + r.error.message); return; }
        c.vertriebschance_personen = (c.vertriebschance_personen || []).filter(function (p) { return p.kontakt_id !== kid; }); vtOeffnen(c.id); vertriebSeite(); }); }; });
    var such = d.querySelector(".vt-p-neu input"), warte;
    such.oninput = function () { clearTimeout(warte); var s = such.value.trim(), ziel = d.querySelector(".vt-p-neu .vt-treffer"); if (s.length < 2) { ziel.innerHTML = ""; return; }
      warte = setTimeout(function () { vtSuche(s, ziel, function (k) {
        db.from("vertriebschance_personen").insert({ chance_id: c.id, kontakt_id: k.id }).then(function (r) { if (r && r.error) { toast("Nicht gespeichert: " + r.error.message); return; }
          (c.vertriebschance_personen = c.vertriebschance_personen || []).push({ kontakt_id: k.id, kontakte: k }); vtOeffnen(c.id); vertriebSeite(); }); }); }, 250); };
    d.querySelector(".vt-auftrag").onsubmit = function (ev) { ev.preventDefault(); var txt = ev.target.querySelector("textarea").value.trim(); if (!txt) return;
      ticket({ titel: "Vertrieb: " + c.titel, quelle: "vertriebschance", qid: c.id, projekt_id: c.projekt_id }, "Auftrag von Daniel (Vertriebschance „" + c.titel + "“, Stufe „" + vtStufeName(c.stufe) + "“): " + txt).then(function (r) {
        toast(r && r.error ? "Nicht gespeichert: " + r.error.message : "Auftrag an Claude (Sofort-Spur)."); if (!(r && r.error)) ev.target.querySelector("textarea").value = ""; }); };
    d.querySelectorAll("[data-vt-ende]").forEach(function (b) { b.onclick = function () { var s = b.getAttribute("data-vt-ende");
      var grund = window.prompt(s === "gewonnen" ? "Was ist beauftragt?" : s === "verloren" ? "Warum verloren?" : "Warum ruht die Chance, und bis wann?", "");
      if (grund === null) return;
      vtSpeichern(c, { status: s, ergebnis_grund: grund || null }, grund).then(function (r) { if (!r || !r.error) { VT.l = VT.l.filter(function (x) { return x !== c; }); vtSchliessen(); vertriebSeite(); toast(c.titel + ": " + s + "."); } }); }; });
    var kids = pers.map(function (p) { return p.kontakte.id; });
    if (!kids.length) { d.querySelector(".vt-stand-inhalt").innerHTML = '<p class="e-leer">Noch niemand zugeordnet.</p>'; return; }
    db.from("aktivitaeten").select("kontakt_id, datum, kanal, anlass, ergebnis").in("kontakt_id", kids).order("datum", { ascending: false }).limit(6).then(function (r) {
      var z = d.querySelector(".vt-stand-inhalt"); if (!z || VT.wahl !== id) return;
      var nm = {}; pers.forEach(function (p) { nm[p.kontakte.id] = p.kontakte.vorname || vtPName(p); });
      var ak = (r.data || []).filter(function (a) { return kids.indexOf(a.kontakt_id) >= 0; }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); }).slice(0, 6);
      z.innerHTML = ak.length ? '<ul class="vt-kontakte">' + ak.map(function (a) { return "<li><span>" + datum(String(a.datum).slice(0, 10)) + "</span>" + esc(nm[a.kontakt_id] || "") + ": " + esc(a.anlass || a.kanal || "Kontakt") +
        (a.ergebnis ? " – " + esc(String(a.ergebnis).slice(0, 180)) : "") + "</li>"; }).join("") + "</ul>" : '<p class="e-leer">Keine Kontakte erfasst.</p>';
    });
  }
  function vtSuche(s, ziel, fertig) {
    db.from("kontakte").select("id, vorname, nachname, position, organisation_id, organisationen(name)").or("nachname.ilike.%" + s + "%,vorname.ilike.%" + s + "%").limit(8).then(function (r) {
      ziel.innerHTML = (r.data || []).map(function (k) { return '<li><button type="button" data-k="' + k.id + '">' + esc((k.vorname || "") + " " + (k.nachname || "")) + (k.organisationen ? " · " + esc(k.organisationen.name) : "") + "</button></li>"; }).join("") || '<li class="e-leer">Keine Treffer.</li>';
      ziel.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { ziel.innerHTML = ""; fertig((r.data || []).filter(function (k) { return k.id === +b.getAttribute("data-k"); })[0]); }; });
    });
  }
  // Chance anlegen: Titel, Marke, Stufe, erste Person (Firma kommt von ihr), nächster Schritt
  function vtAnlegen() {
    var d = el.querySelector(".vt-detail"); VT.wahl = null;
    d.innerHTML = '<div class="vt-d-kopf"><div><h2>Chance anlegen</h2><p>Ein konkretes Vorhaben mit Auftragspotenzial und den Personen, die dazugehören.</p></div><button type="button" class="vt-zu" aria-label="Schließen">×</button></div>' +
      '<form class="vt-neu-form"><input name="titel" type="text" placeholder="Titel, z. B. „DEVK Re – Kommunikation“" required>' +
      '<input name="suche" type="search" placeholder="Erste Person suchen" autocomplete="off"><ul class="vt-treffer"></ul>' +
      '<select name="marke">' + SG_MARKEN.map(function (m) { return '<option' + (m === VT.marke ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select>" +
      '<select name="stufe">' + VT_STUFEN.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + "</option>"; }).join("") + "</select>" +
      '<input name="schritt" type="text" placeholder="Nächster Schritt"><input name="faellig" type="date"><button class="e-k e-k-voll" type="submit">Anlegen</button></form>';
    d.hidden = false; el.querySelector(".vt-schleier").hidden = false; document.documentElement.classList.add("vt-offen");
    d.querySelector(".vt-zu").onclick = vtSchliessen;
    var f = d.querySelector("form"), person = null, warte;
    f.suche.oninput = function () { clearTimeout(warte); var s = f.suche.value.trim(), ziel = f.querySelector(".vt-treffer"); if (s.length < 2) { ziel.innerHTML = ""; return; }
      warte = setTimeout(function () { vtSuche(s, ziel, function (k) { person = k; f.suche.value = (k.vorname || "") + " " + (k.nachname || "") + (k.organisationen ? " · " + k.organisationen.name : ""); }); }, 250); };
    f.onsubmit = function (ev) { ev.preventDefault(); var titel = f.titel.value.trim(); if (!titel) return;
      db.from("vertriebschancen").insert({ titel: titel, marke: f.marke.value, stufe: f.stufe.value, status: "offen", organisation_id: person ? person.organisation_id : null,
        naechster_schritt: f.schritt.value.trim() || null, faellig_am: f.faellig.value || null }).select("id").then(function (r) {
        if (r && r.error) { toast("Nicht gespeichert: " + r.error.message); return; }
        var id = (r.data || [])[0] && r.data[0].id;
        var weiter = function () { toast("Angelegt."); vtSchliessen(); vertriebLaden(); };
        if (person && id) db.from("vertriebschance_personen").insert({ chance_id: id, kontakt_id: person.id }).then(weiter); else weiter(); }); };
    f.titel.focus();
  }
})();
