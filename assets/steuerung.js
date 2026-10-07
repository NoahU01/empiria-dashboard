/* Steuerung – das zentrale Dashboard. Beantwortet vier Fragen, alles mit Klick in die Unterseite:
     Lage-Satz (von Claude geschrieben, Tabelle lage)
     Reagieren   – Rückmeldungen da, kann starten, nachfassen, Fristen, Mail-Entwürfe zur Freigabe
     Entscheiden – Claudes offene Fragen (Tabelle fragen), Aufgaben, an denen andere hängen, was in Projekten fehlt
     Bewegung    – je laufendem Projekt: zuletzt, als Nächstes, worauf es zuläuft; Stillstand markiert
     Zeitleiste  – nächste sechs Wochen: Projekttermine, Meilensteine, Fristen; offene Vorbereitung je Termin
   Keine Zähler, keine Kennzahlen. Daten aus Supabase; Mails (optional) über BetaMail. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-steuerung]");
  if (!db || !wurzel) return;
  var B = window.BetaMail;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function tag(d) { return new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }); }
  var HEUTE = new Date(new Date().toDateString()), MORGEN = new Date(+HEUTE + 864e5);
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function tageBis(d) { return Math.round((new Date(new Date(d).toDateString()) - HEUTE) / 864e5); }
  var D = {};

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheint hier die Steuerung.</p></div>'; return; }
    var vor60 = new Date(Date.now() - 60 * 864e5).toISOString();
    Promise.all([
      db.from("projekte").select("id, name, marke, typ, status, ziel, ueberlegungen, naechstes_gate, gate_datum, angelegt_am"),
      db.from("aufgaben").select("id, titel, status, spalte, faellig_am, erledigt_am, projekt_id, vorgaenger, hinweis, hinweis_am, antwort_am, antwort_von, nachfassen_hinweis_am, warten_auf, mail_gesendet_am")
        .or("status.eq.offen,and(status.eq.erledigt,erledigt_am.gte." + vor60 + ")"),
      db.from("projekt_ereignisse").select("id, projekt_id, datum, art, titel").gte("datum", vor60),
      db.from("lage").select("text, angelegt_am").order("angelegt_am", { ascending: false }).limit(1),
      db.from("fragen").select("id, text, link, projekt_id, aufgabe_id").eq("status", "offen").order("angelegt_am")
    ]).then(function (r) {
      D = { projekte: r[0].data || [], aufgaben: r[1].data || [], ereignisse: r[2].data || [], lage: (r[3].data || [])[0], fragen: r[4].data || [], mails: null };
      zeichnen();
      mailsLaden();
    });
  });

  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }
  function zuAufgabe(a) { return a.projekt_id ? "/strategie/projekte.html#p=" + a.projekt_id : "/strategie/aufgaben.html"; }
  function herkunft(a) { var p = projekt(a.projekt_id); return p ? p.name : "Operativ"; }
  function offen() { return D.aufgaben.filter(function (a) { return a.status === "offen"; }); }
  function zeile(link, titel, unter, ton) {
    return '<li class="st2-zeile' + (ton ? " st2-" + ton : "") + '"><a href="' + esc(link) + '"><b>' + titel + "</b>" + (unter ? "<small>" + unter + "</small>" : "") + "</a></li>";
  }

  /* ---------- Reagieren ---------- */
  function reagieren() {
    var gesehen = {}, aus = [];
    function nimm(a, titel, unter, ton) { if (gesehen[a.id]) return; gesehen[a.id] = 1; aus.push(zeile(zuAufgabe(a), titel, unter, ton)); }
    offen().forEach(function (a) { if (a.antwort_am) nimm(a, esc(a.titel), esc(a.hinweis || "Rückmeldung ist da") + " · " + esc(herkunft(a)), "jetzt"); });
    offen().forEach(function (a) { if (/^Kann jetzt starten/.test(a.hinweis || "")) nimm(a, esc(a.titel), esc(a.hinweis) + " · " + esc(herkunft(a))); });
    offen().forEach(function (a) { if (a.nachfassen_hinweis_am && !a.antwort_am) nimm(a, esc(a.titel), esc(a.hinweis || "Nachfassen?") + " · " + esc(herkunft(a))); });
    offen().filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) <= iso(MORGEN); })
      .sort(function (a, b) { return a.faellig_am.localeCompare(b.faellig_am); })
      .forEach(function (a) {
        var t = tageBis(a.faellig_am), wann = t < 0 ? "überfällig seit " + tag(a.faellig_am) : t === 0 ? "fällig heute" : "fällig morgen";
        nimm(a, esc(a.titel), wann + " · " + esc(herkunft(a)), t <= 0 ? "jetzt" : "");
      });
    if (D.mails === "laedt") aus.push('<li class="st2-leise">Mails werden geprüft …</li>');
    else if (Array.isArray(D.mails) && D.mails.length) {
      D.mails.slice(0, 3).forEach(function (m) {
        aus.push(zeile("/strategie/korrespondenz-beta.html", "Entwurf an " + esc(B.absender(m)) + " freigeben", esc(m.subject || "") + " · " + esc(m.konto.name)));
      });
      if (D.mails.length > 3) aus.push('<li class="st2-mehr"><a href="/strategie/korrespondenz-beta.html">Weitere Entwürfe in der Korrespondenz →</a></li>');
    } else if (D.mails === "anmelden") aus.push('<li class="st2-leise"><button type="button" data-ms-anmelden>Mails einbeziehen – mit Microsoft anmelden</button></li>');
    return aus.length ? aus.join("") : '<li class="st2-leise">Gerade nichts, das auf dich wartet.</li>';
  }

  /* ---------- Entscheiden ---------- */
  function entscheiden() {
    var aus = D.fragen.map(function (f) { return zeile(f.link || "/strategie/aufgaben.html", esc(f.text), f.projekt_id && projekt(f.projekt_id) ? esc(projekt(f.projekt_id).name) : "", "frage"); });
    // Aufgaben, an denen andere hängen – und die nicht auf jemand anderen warten
    offen().forEach(function (a) {
      var nach = offen().filter(function (n) { return (n.vorgaenger || []).map(Number).indexOf(a.id) > -1; });
      if (!nach.length || (a.mail_gesendet_am && !a.antwort_am)) return;
      aus.push(zeile(zuAufgabe(a), esc(a.titel), "gibt frei: " + nach.map(function (n) { return esc(n.titel); }).join(", ") + " · " + esc(herkunft(a))));
    });
    D.projekte.filter(function (p) { return p.status === "wartet auf dich"; }).forEach(function (p) {
      aus.push(zeile("/strategie/projekte.html#p=" + p.id, esc(p.name), "wartet auf dich"));
    });
    var aktiv = D.projekte.filter(function (p) { return p.status !== "pausiert" && p.status !== "abgeschlossen"; });
    var ohneZiel = aktiv.filter(function (p) { return !p.ziel; }), ohneKurs = aktiv.filter(function (p) { return !p.ueberlegungen; });
    if (ohneZiel.length) aus.push(zeile("/strategie/projekte.html", "Projektziel fehlt", ohneZiel.map(function (p) { return esc(p.name); }).join(", ")));
    if (ohneKurs.length) aus.push(zeile("/strategie/projekte.html", "Stoßrichtung fehlt", ohneKurs.map(function (p) { return esc(p.name); }).join(", ")));
    return aus.length ? aus.join("") : '<li class="st2-leise">Keine offenen Entscheidungen.</li>';
  }

  /* ---------- Bewegung je Projekt ---------- */
  function bewegung() {
    var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."];
    var aktiv = D.projekte.filter(function (p) { return p.status !== "pausiert" && p.status !== "abgeschlossen"; })
      .sort(function (a, b) { return MARKEN.indexOf(a.marke) - MARKEN.indexOf(b.marke) || (a.typ === "intern") - (b.typ === "intern") || a.name.localeCompare(b.name); });
    return aktiv.map(function (p) {
      var jetzt = Date.now();
      var spuren = D.ereignisse.filter(function (e) { return e.projekt_id === p.id && new Date(e.datum) <= jetzt && e.art !== "Meilenstein"; })
        .map(function (e) { return { d: e.datum, t: e.titel }; })
        .concat(D.aufgaben.filter(function (a) { return a.projekt_id === p.id && a.erledigt_am; }).map(function (a) { return { d: a.erledigt_am, t: a.titel + " ✓" }; }))
        .sort(function (a, b) { return new Date(b.d) - new Date(a.d); });
      var zuletzt = spuren[0];
      var naechsteA = offen().filter(function (a) { return a.projekt_id === p.id && a.spalte !== "backlog"; })
        .sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); })[0];
      var naechsterT = D.ereignisse.filter(function (e) { return e.projekt_id === p.id && new Date(e.datum) > jetzt && e.art !== "Meilenstein"; })
        .sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); })[0];
      var ziel = D.ereignisse.filter(function (e) { return e.projekt_id === p.id && new Date(e.datum) > jetzt && e.art === "Meilenstein"; })
        .sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); })[0];
      var naechstes = naechsteA && (!naechsterT || (naechsteA.faellig_am && new Date(naechsteA.faellig_am) <= new Date(naechsterT.datum)))
        ? esc(naechsteA.titel) + (naechsteA.faellig_am ? " · bis " + tag(naechsteA.faellig_am) : "")
        : naechsterT ? esc(naechsterT.titel) + " · " + tag(naechsterT.datum) : "";
      // Stillstand: seit 3 Wochen keine Spur – frisch angelegte Projekte zählen nicht
      var neu = p.angelegt_am && (jetzt - new Date(p.angelegt_am)) < 21 * 864e5;
      var still = !neu && (!zuletzt || (jetzt - new Date(zuletzt.d)) > 21 * 864e5);
      return '<li class="st2-projekt' + (still ? " st2-still" : "") + '"><a href="/strategie/projekte.html#p=' + p.id + '"><b>' + esc(p.name) + '</b><span class="st2-marke">' + esc(p.marke || "") + "</span>" +
        '<span class="st2-spur"><i>zuletzt</i>' + (zuletzt ? esc(zuletzt.t) + " · " + tag(zuletzt.d) : neu ? "angelegt " + tag(p.angelegt_am) : "noch nichts erfasst") + "</span>" +
        '<span class="st2-spur"><i>als Nächstes</i>' + (naechstes || '<em>kein nächster Schritt</em>') + "</span>" +
        (ziel ? '<span class="st2-spur"><i>läuft zu auf</i>' + esc(ziel.titel) + " · " + tag(ziel.datum) + "</span>"
          : p.naechstes_gate ? '<span class="st2-spur"><i>läuft zu auf</i>' + esc(p.naechstes_gate) + (p.gate_datum ? " · " + tag(p.gate_datum) : "") + "</span>" : "") +
        (still ? '<span class="st2-stillstand">Keine Bewegung seit ' + (zuletzt ? tag(zuletzt.d) : "Anlage") + "</span>" : "") + "</a></li>";
    }).join("");
  }

  /* ---------- Zeitleiste: nächste sechs Wochen ---------- */
  function zeitleiste() {
    var bis = new Date(+HEUTE + 42 * 864e5), punkte = [], gezeigt = {};
    D.ereignisse.slice().sort(function (a, b) { return new Date(a.datum) - new Date(b.datum); }).forEach(function (e) {
      var d = new Date(e.datum); if (d < HEUTE || d > bis) return;
      var p = projekt(e.projekt_id);
      var vorb = gezeigt[e.projekt_id] ? [] : offen().filter(function (a) { return a.projekt_id === e.projekt_id && a.faellig_am && a.faellig_am.slice(0, 10) <= iso(d); });
      if (vorb.length) gezeigt[e.projekt_id] = 1;
      punkte.push({ d: d, art: e.art === "Meilenstein" ? "ziel" : "termin", titel: e.titel, p: p, link: "/strategie/projekte.html#p=" + e.projekt_id,
        offen: vorb.slice(0, 3).map(function (a) { return a.titel; }).concat(vorb.length > 3 ? ["…"] : []) });
    });
    offen().forEach(function (a) {
      if (!a.faellig_am) return; var d = new Date(a.faellig_am.slice(0, 10) + "T12:00:00"); if (d < HEUTE || d > bis) return;
      punkte.push({ d: d, art: "frist", titel: a.titel, p: projekt(a.projekt_id), link: zuAufgabe(a), offen: [] });
    });
    punkte.sort(function (a, b) { return a.d - b.d || (a.art === "frist") - (b.art === "frist"); });
    if (!punkte.length) return '<p class="st2-leise">Nichts in den nächsten sechs Wochen.</p>';
    var wochen = {};
    punkte.forEach(function (x) {
      var mo = new Date(x.d); mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7)); var k = mo.toDateString();
      (wochen[k] = wochen[k] || { mo: mo, l: [] }).l.push(x);
    });
    return Object.keys(wochen).map(function (k) {
      var w = wochen[k], so = new Date(+w.mo + 6 * 864e5);
      return '<section class="st2-woche"><h4>' + w.mo.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) + " – " + so.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) + "</h4><ul>" +
        w.l.map(function (x) {
          return '<li class="st2-' + x.art + '"><a href="' + esc(x.link) + '"><span class="st2-tag">' + tag(x.d) + "</span><span><b>" + esc(x.titel) + "</b>" +
            "<small>" + (x.art === "frist" ? "Frist · " : x.art === "ziel" ? "Meilenstein · " : "") + esc(x.p ? x.p.name : "Operativ") + "</small>" +
            (x.offen.length ? '<small class="st2-vorb">offen: ' + x.offen.map(esc).join(", ") + "</small>" : "") + "</span></a></li>";
        }).join("") + "</ul></section>";
    }).join("");
  }

  function zeichnen() {
    wurzel.innerHTML =
      (D.lage ? '<p class="st2-lage">' + esc(D.lage.text) + '</p><p class="st2-lage-stand">Lage von Claude · ' + new Date(D.lage.angelegt_am).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "</p>" : "") +
      '<div class="st2-drei">' +
        '<section><h3>Reagieren</h3><ul class="st2-liste">' + reagieren() + "</ul></section>" +
        '<section><h3>Entscheiden</h3><ul class="st2-liste">' + entscheiden() + "</ul></section>" +
        '<section class="st2-bew"><h3>Bewegung</h3><ul class="st2-liste">' + bewegung() + "</ul></section>" +
      "</div>" +
      '<section class="st2-zeit"><h3>Nächste sechs Wochen</h3><div class="st2-wochen">' + zeitleiste() + "</div></section>";
    var k = wurzel.querySelector("[data-ms-anmelden]"); if (k && B) k.onclick = B.anmelden;
  }

  // Mails mit fertigem Entwurf (Freigabe) – nur wenn bei Microsoft angemeldet
  function mailsLaden() {
    if (!B) return;
    D.mails = "laedt"; zeichnen();
    B.start().then(function (konto) {
      if (!konto) { D.mails = "anmelden"; zeichnen(); return; }
      return B.laden().then(function (d) {
        D.mails = d.handlung.filter(function (m) { return m.analyse && m.analyse.entwurf && B.entscheidungLesen(m) !== "freigeben"; });
        zeichnen();
      });
    }).catch(function () { D.mails = "anmelden"; zeichnen(); });
  }
})();
