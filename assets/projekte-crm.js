/* Projekte – Steckbrief je Projekt: Thema und Überlegungen, Claude-Impuls, Entscheidungen, Aufgaben
   (mit Zuständigkeit), Timeline aus Terminen und Ereignissen mit Protokoll/Entscheidungen/Aufgaben,
   Beteiligte. Übersicht #, Projekt #p=ID. Anmeldung wie auf der Kontaktseite (Login-Link). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-projekte]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : ""; }
  function kurz(d) { return d ? new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : ""; }
  function name(k) { return k ? [k.vorname, k.nachname].filter(Boolean).join(" ") : ""; }
  var STATUS = { "läuft": "st-laeuft", "wartet auf dich": "st-dich", "blockiert": "st-blockiert", "pausiert": "st-pause", "abgeschlossen": "st-pause" };

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheinen hier die Projekte.</p></div>'; return; }
    route();
  });
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });
  function route() {
    var h = location.hash.replace("#", "");
    document.body.classList.toggle("kt3-detail", /^p=\d+$/.test(h));
    if (/^p=\d+$/.test(h)) projekt(+h.slice(2)); else liste();
  }

  /* ---------- Übersicht ---------- */
  function liste() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("id, name, typ, status, naechstes_gate, gate_datum, organisationen(id, name)").order("name"),
      db.from("projekt_ereignisse").select("projekt_id, datum, titel").gte("datum", new Date().toISOString()).order("datum")
    ]).then(function (r) {
      var p = r[0].data || [], nae = {};
      (r[1].data || []).forEach(function (e) { if (!nae[e.projekt_id]) nae[e.projekt_id] = e; });
      var kunde = p.filter(function (x) { return x.typ !== "intern"; }), intern = p.filter(function (x) { return x.typ === "intern"; });
      function name_(x) { return '<a class="kt3-p" href="#p=' + x.id + '">' + esc(x.name) + "</a>" + (x.status !== "läuft" ? ' <span class="pr-st ' + STATUS[x.status] + '">' + esc(x.status) + "</span>" : ""); }
      wurzel.innerHTML = '<div class="pr-zwei">' +
        '<section><h2 class="pr-h2">Kundenprojekte</h2><table class="kt3-tab pr-tab"><colgroup><col style="width:36%"><col style="width:30%"><col style="width:34%"></colgroup>' +
        "<thead><tr><th>Projekt</th><th>Kunde</th><th>Nächster Termin</th></tr></thead><tbody>" + kunde.map(function (x) {
          var n = nae[x.id];
          return '<tr data-href="#p=' + x.id + '"><td>' + name_(x) + "</td><td>" + esc(x.organisationen ? x.organisationen.name : "") + "</td><td>" +
            (n ? kurz(n.datum) + '<br><span class="kt3-leise">' + esc(n.titel) + "</span>" : '<span class="kt3-leise">keiner geplant</span>') + "</td></tr>";
        }).join("") + "</tbody></table></section>" +
        '<section><h2 class="pr-h2">Interne Projekte</h2><table class="kt3-tab pr-tab"><thead><tr><th>Projekt</th></tr></thead><tbody>' + (intern.length ? intern.map(function (x) {
          return '<tr data-href="#p=' + x.id + '"><td>' + name_(x) + "</td></tr>";
        }).join("") : '<tr><td class="kt3-leise">Noch keine internen Projekte.</td></tr>') + "</tbody></table></section></div>";
      wurzel.querySelectorAll("tr[data-href]").forEach(function (tr) { tr.onclick = function (e) { if (!e.target.closest("a")) location.hash = tr.getAttribute("data-href"); }; });
    });
  }

  /* ---------- Projekt ---------- */
  function projekt(id) {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("projekte").select("*, organisationen(id, name)").eq("id", id).single(),
      db.from("projekt_beteiligte").select("id, seite, rolle, name, kontakte(id, vorname, nachname, position)").eq("projekt_id", id),
      db.from("projekt_ereignisse").select("id, datum, art, titel, quelle, format, ort, teilnehmer, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("datum", { ascending: false }),
      db.from("projekt_punkte").select("id, ereignis_id, art, text, angelegt_am, kontakte(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am", { ascending: false }),
      db.from("aufgaben").select("id, titel, beschreibung, status, faellig_am, ereignis_id, zustaendig_name, kontakte:zustaendig_kontakt_id(id, vorname, nachname)").eq("projekt_id", id).order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      zeichnen(r[0].data, r[1].data || [], r[2].data || [], r[3].data || [], r[4].data || []);
    });
  }

  function wer(a) { return a.zustaendig_name || name(a.kontakte) || ""; }
  function format(e) { return e.format === "vor Ort" ? "vor Ort" + (e.ort ? ": " + e.ort : "") : e.format === "offen" ? e.art + " · Ort offen" : e.art + (e.format ? " · " + e.format : ""); }
  function teiln(e) { return (e.teilnehmer || []).length ? "mit " + e.teilnehmer.join(", ") : (e.kontakte ? "mit " + name(e.kontakte) : ""); }
  /* Ohne bekannte Uhrzeit (00:00) wird keine angezeigt */
  function zeit(d, vor) { var t = new Date(d); return t.getHours() || t.getMinutes() ? vor + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""; }
  var STAND = {};
  function detailEreignis(id) {
    var ziel = wurzel.querySelector('[data-ev-detail="' + id + '"]') || wurzel.querySelector('[data-ev-detail=""]');
    var e = STAND.ere.filter(function (x) { return x.id === id; })[0];
    if (!e || !ziel) return;
    var p2 = STAND.pkt.filter(function (x) { return x.ereignis_id === id; }), a2 = STAND.auf.filter(function (x) { return x.ereignis_id === id; });
    function block(t, l) { return l.length ? '<h4>' + t + '</h4><ul>' + l.join("") + "</ul>" : ""; }
    ziel.innerHTML = '<p class="pr-d">' + datum(e.datum) + zeit(e.datum, " · ") + '</p><h3 class="pr-det-titel">' + esc(e.titel) + "</h3>" +
      '<p class="pr-det-meta">' + esc(format(e)) + (teiln(e) ? "<br>" + esc(teiln(e)) : "") + "</p>" +
      (p2.length || a2.length ?
        block("Notizen", p2.filter(function (x) { return x.art === "Protokoll"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Entscheidungen", p2.filter(function (x) { return x.art === "Entscheidung"; }).map(function (x) { return "<li>" + esc(x.text) + "</li>"; })) +
        block("Aufgaben", a2.map(function (x) { return "<li>" + esc(x.titel) + ' <span class="kt3-leise">· ' + esc(wer(x)) + (x.faellig_am ? ", bis " + kurz(x.faellig_am) : "") + "</span>" + (x.status === "erledigt" ? " ✓" : "") + "</li>"; }))
        : '<p class="kt3-leise">Noch kein Protokoll. Diktiere mir einfach, was besprochen wurde.</p>');
  }
  function zeichnen(p, bet, ere, pkt, auf) {
    STAND = { ere: ere, pkt: pkt, auf: auf };
    var h = '<a class="kb-zurueck" href="#"><span aria-hidden="true">&larr;</span> Projekte</a>';
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(p.name) + '</h2><p class="kt3-sub">' +
      [p.organisationen ? '<a href="/strategie/kontakte.html#f=' + p.organisationen.id + '">' + esc(p.organisationen.name) + "</a>" : "", esc(p.marke || ""), esc(p.phase || ""),
       '<span class="pr-st ' + STATUS[p.status] + '">' + esc(p.status) + "</span>"].filter(Boolean).join(" · ") + "</p>" +
      (p.thema ? '<p class="pr-thema">' + esc(p.thema) + "</p>" : "") +
      (p.typ === "intern" && p.naechstes_gate ? '<p class="pr-gate"><span>Nächstes Gate</span>' + esc(p.naechstes_gate) + (p.gate_datum ? " · bis " + kurz(p.gate_datum) : "") + "</p>" : "") + "</div></div>";
    h += '<div class="kt3-raster">';
    // Links: Stoßrichtung (Gesamtblick über alle Termine) – rechts: Aufgaben
    var punkte = (p.ueberlegungen || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    h += '<section class="kt3-box pr-kurs"><h3>Stoßrichtung</h3>' + (punkte.length ? '<ul data-ueb-text>' + punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : '<p class="kt3-leise" data-ueb-text>Noch keine Stoßrichtung – diktiere sie mir oder trage sie ein.</p>') +
      '<textarea class="pr-ueb" data-ueb hidden placeholder="Ein Punkt pro Zeile">' + esc(p.ueberlegungen || "") + '</textarea><div class="pr-ueb-knoepfe"><button type="button" class="kt3-klapp" data-ueb-bearbeiten>Bearbeiten</button>' +
      '<button type="button" class="pr-speichern" data-ueb-speichern hidden>Speichern</button></div></section>';
    // Aufgaben: immer mit Frist, nach Datum
    var offen = auf.filter(function (a) { return a.status === "offen"; }).sort(function (a, b) { return (a.faellig_am || "9999").localeCompare(b.faellig_am || "9999"); });
    var namen = ["Daniel"].concat(bet.map(function (b) { return b.name || name(b.kontakte); })).filter(function (x, i, l) { return x && l.indexOf(x) === i; });
    h += '<section class="kt3-box pr-aufgaben"><h3>Aufgaben</h3>' + (offen.length ? '<ul class="pr-auf2">' + offen.map(function (a) {
      var ueber = a.faellig_am && new Date(a.faellig_am) < new Date(new Date().toDateString());
      return '<li data-a="' + a.id + '"><div class="pr-auf-zeile"><button type="button" class="st-haken" aria-label="Erledigt"></button>' +
        '<span class="pr-frist' + (ueber ? " pr-ueber" : "") + '">' + (a.faellig_am ? kurz(a.faellig_am) : "ohne Termin") + "</span>" +
        '<button type="button" class="pr-auf-titel" data-auf-auf aria-expanded="false"><span>' + esc(a.titel) + "</span>" + (a.beschreibung ? '<i class="pr-hat-details" title="Details vorhanden"></i>' : "") + "</button>" +
        '<span class="pr-wer">' + esc(wer(a) || "offen") + "</span></div>" +
        '<div class="pr-auf-details" hidden><textarea data-det placeholder="Details, Hintergrund, Links …">' + esc(a.beschreibung || "") + '</textarea><button type="button" class="pr-speichern" data-det-speichern hidden>Speichern</button></div></li>';
      }).join("") + "</ul>" : '<p class="kt3-leise">Nichts offen.</p>') +
      '<form class="kt3-neu pr-neu" data-neu><input type="text" placeholder="Neue Aufgabe …" data-titel><input type="text" list="pr-namen" placeholder="Wer?" data-wer class="pr-wer-feld"><input type="date" data-frist class="pr-frist-feld" aria-label="Frist">' +
      '<datalist id="pr-namen">' + namen.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist><button type="submit">+</button></form></section>';
    // Timeline: drei Darstellungen zum Vergleich – ohne äußeren Kasten, mit viel Luft
    var jetzt = Date.now(), tlv = "seite";
    try { tlv = localStorage.getItem("pr-tl-ansicht") || "seite"; } catch (x) {}
    var start = ere.filter(function (e) { return new Date(e.datum) <= jetzt; })[0] || ere[0];
    function eintrag(e, mitPersonen, dreieck, knapp) {
      var zuk = new Date(e.datum) > jetzt, hat = pkt.some(function (x) { return x.ereignis_id === e.id; }) || auf.some(function (x) { return x.ereignis_id === e.id; });
      return '<button type="button" data-ev="' + e.id + '" class="' + (zuk ? "pr-zuk " : "") + (start && e.id === start.id ? "an" : "") + '"><span class="pr-d">' + (zuk && !knapp ? "geplant · " : "") + kurz(e.datum) +
        zeit(e.datum, " · ") + (hat ? ' <i class="pr-hat-details" title="Protokoll vorhanden"></i>' : "") + "</span><b>" + esc(e.titel) + "</b>" +
        (knapp ? "" : '<small>' + esc(format(e)) + "</small>") + (mitPersonen && teiln(e) ? "<small>" + esc(teiln(e)) + "</small>" : "") +
        (dreieck && hat ? '<span class="tl-dreieck" aria-hidden="true"></span>' : "") + "</button>";
    }
    var tl;
    if (tlv === "auf") tl = '<ol class="tl-auf">' + ere.map(function (e) { return "<li>" + eintrag(e, true, true) + '<div class="tl-auf-det" data-ev-detail="' + e.id + '" hidden></div></li>'; }).join("") + "</ol>";
    else if (tlv === "oben") tl = '<ol class="tl-oben">' + ere.map(function (e) { return "<li>" + eintrag(e, false, false, true) + "</li>"; }).join("") + '</ol><div class="tl-oben-det" data-ev-detail=""></div>';
    else tl = '<div class="tl-seite"><ol class="tl-seite-liste">' + ere.map(function (e) { return "<li>" + eintrag(e) + "</li>"; }).join("") + '</ol><div class="tl-seite-det" data-ev-detail=""></div></div>';
    h += '<section class="kt3-box kt3-breit pr-tl-frei"><div class="pr-tl-kopf"><h3>Timeline</h3><span class="pr-tl-wahl">' +
      [["seite", "Nebeneinander"], ["auf", "Aufklappen"], ["oben", "Zeitleiste oben"]].map(function (v) {
        return '<button type="button" data-tlv="' + v[0] + '" aria-pressed="' + (v[0] === tlv) + '">' + v[1] + "</button>"; }).join("") + "</span></div><div class='pr-tl-inhalt'>" + tl + "</div></section>";
    // Beteiligte
    function seite(s) {
      var l = bet.filter(function (b) { return b.seite === s; });
      return l.length ? '<ul class="pr-bet">' + l.map(function (b) {
        return "<li>" + (b.kontakte ? '<a class="pr-name" href="/strategie/kontakte.html#k=' + b.kontakte.id + '">' + esc(name(b.kontakte)) + "</a>" : '<span class="pr-name">' + esc(b.name) + "</span>") +
          (b.rolle ? '<span class="pr-themen"> · ' + esc(b.rolle) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="kt3-leise">–</p>';
    }
    h += '<div class="kt3-breit pr-bet-zeile"><section class="kt3-box"><h3>Beteiligte beim Kunden</h3>' + seite("Kunde") + '</section><section class="kt3-box"><h3>Team empiria</h3>' + seite("empiria") + seite("Partner").replace('<p class="kt3-leise">–</p>', "") + "</section></div>";
    wurzel.innerHTML = h + "</div>";
    verdrahten(p);
  }

  function verdrahten(p) {
    wurzel.querySelectorAll("[data-tlv]").forEach(function (b) {
      b.onclick = function () { try { localStorage.setItem("pr-tl-ansicht", b.getAttribute("data-tlv")); } catch (x) {} projekt(p.id); };
    });
    var knoepfe = wurzel.querySelectorAll("[data-ev]"), aufklappen = !!wurzel.querySelector(".tl-auf");
    knoepfe.forEach(function (b) {
      b.onclick = function () {
        var id = +b.getAttribute("data-ev");
        if (aufklappen) {
          var det = wurzel.querySelector('[data-ev-detail="' + id + '"]'), auf = det.hidden;
          det.hidden = !auf; b.classList.toggle("an", auf); if (auf) detailEreignis(id);
          return;
        }
        knoepfe.forEach(function (x) { x.classList.toggle("an", x === b); }); detailEreignis(id);
      };
    });
    if (aufklappen) wurzel.querySelectorAll(".tl-auf [data-ev].an").forEach(function (x) { x.classList.remove("an"); });
    var an = wurzel.querySelector("[data-ev].an"); if (an && !aufklappen) detailEreignis(+an.getAttribute("data-ev"));
    wurzel.querySelectorAll("[data-auf-auf]").forEach(function (b) {
      var li = b.closest("li"), det = li.querySelector(".pr-auf-details"), ta = det.querySelector("textarea"), sp = det.querySelector("[data-det-speichern]");
      b.onclick = function () { det.hidden = !det.hidden; b.setAttribute("aria-expanded", String(!det.hidden)); };
      ta.oninput = function () { sp.hidden = false; };
      sp.onclick = function () { sp.disabled = true; db.from("aufgaben").update({ beschreibung: ta.value }).eq("id", +li.getAttribute("data-a")).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else sp.hidden = true; }); };
    });
    var ta = wurzel.querySelector("[data-ueb]"), sp = wurzel.querySelector("[data-ueb-speichern]"), bt = wurzel.querySelector("[data-ueb-bearbeiten]"), tx = wurzel.querySelector("[data-ueb-text]");
    bt.onclick = function () { ta.hidden = false; tx.hidden = true; bt.hidden = true; sp.hidden = false; ta.focus(); };
    sp.onclick = function () { sp.disabled = true; db.from("projekte").update({ ueberlegungen: ta.value }).eq("id", p.id).then(function (r) { sp.disabled = false; if (r.error) alert(r.error.message); else projekt(p.id); }); };
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () { var li = b.closest("li"); li.classList.add("st-weg");
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", +li.getAttribute("data-a")).then(function (r) { if (r.error) { li.classList.remove("st-weg"); alert(r.error.message); } }); };
    });
    var f = wurzel.querySelector("[data-neu]");
    f.onsubmit = function (e) {
      e.preventDefault();
      var t = f.querySelector("[data-titel]").value.trim(), w = f.querySelector("[data-wer]").value.trim(); if (!t) return;
      f.classList.add("laedt");
      var fr = f.querySelector("[data-frist]").value || null;
      db.from("aufgaben").insert({ titel: t, projekt_id: p.id, zustaendig_name: w || "Daniel", faellig_am: fr, bereich: "Projekt" }).then(function (r) { if (r.error) { f.classList.remove("laedt"); alert(r.error.message); } else projekt(p.id); });
    };
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b || !wurzel.contains(b)) return;
    var auf = b.getAttribute("aria-expanded") !== "true";
    b.closest(".kt3-box").querySelectorAll("[data-mehr]").forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : "Alle zeigen";
  });
})();
