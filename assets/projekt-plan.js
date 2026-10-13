/* Planungsmodus je Projekt (Daniel, 10.10.2026) – Vorbild: Meilensteinplan der SV Akademie.
   Stränge (Tabelle projekt_straenge), Reihenfolge (aufgaben.reihenfolge), Gates = Zwischenergebnisse (aufgaben.art = 'gate').
   Ein Gate braucht alle Aufgaben davor im Strang (seit dem letzten Gate) plus seine Abhängigkeiten aus anderen Strängen;
   beides steht in gate.vorgaenger und wird beim Umsortieren neu geschrieben. Erreicht ist es, wenn Daniel es abhakt.
   Zustand je Aufgabe: erledigt · jetzt machbar (alles davor erledigt) · kommt später.
   Liste: je Strang von oben nach unten, Gates als eigene Zeile (hellgrau), umsortieren per Ziehen am Griff.
   Plan: je Strang eine Bahn, Karten und Gates, Pfeile für die Abfolge, gestrichelt für Abhängigkeiten aus anderen Strängen. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function idListe(v) { return (v || []).map(Number); }

  function ordnen(straenge, auf) {
    var je = {};
    straenge.forEach(function (s) { je[s.id] = []; });
    auf.forEach(function (a) { if (a.strang_id && je[a.strang_id]) je[a.strang_id].push(a); });
    Object.keys(je).forEach(function (k) {
      je[k].sort(function (a, b) { return (a.reihenfolge == null ? 999 : a.reihenfolge) - (b.reihenfolge == null ? 999 : b.reihenfolge) || a.id - b.id; });
    });
    return je;
  }
  function nachReihe(a, b) { return (a.reihenfolge || 0) - (b.reihenfolge || 0) || a.id - b.id; }
  // Neue Stränge/Teilprojekte immer ans Ende – nie eine doppelte Nummer, damit die Reihenfolge in Liste und Plan fest bleibt
  function naechste(l) { return l.reduce(function (m, s) { return Math.max(m, s.reihenfolge || 0); }, 0) + 1; }
  // Strang/Teilprojekt zugeklappt? Je Strang im Browser gemerkt (Daniel, 13.10.2026) – bleibt auch nach dem Neuladen
  function istZu(id) { try { return localStorage.getItem("pl-zu-" + id) === "1"; } catch (x) { return false; } }
  function oben(straenge) { return straenge.filter(function (s) { return !s.eltern_id; }).sort(nachReihe); }
  function kinder(straenge, id) { return straenge.filter(function (s) { return s.eltern_id === id; }).sort(nachReihe); }
  function zustand(a, auf) {
    if (a.status === "erledigt") return "fertig";
    var v = idListe(a.vorgaenger);
    var offen = auf.filter(function (x) { return v.indexOf(x.id) > -1 && x.status !== "erledigt"; });
    return offen.length ? "spaeter" : "machbar";
  }
  function fehlend(a, auf) {
    var v = idListe(a.vorgaenger);
    return auf.filter(function (x) { return v.indexOf(x.id) > -1 && x.status !== "erledigt"; });
  }

  /* ---------- Liste ---------- */
  // alle = Aufgaben des Projekts + Abhängigkeiten aus anderen Projekten (nur für Zustand und „Es fehlt noch“)
  function liste(straenge, auf, h, alle) {
    alle = alle || auf;
    var je = ordnen(straenge, auf), ohne = auf.filter(function (a) { return !a.strang_id && a.status === "offen"; });
    var html = "", einer = straenge.length === 1 && !straenge[0].eltern_id, fertig = [];   // ein einziger Strang ohne Teilprojekte: keine Überschrift
    // Oben nur Offenes. Erreichte Gates rutschen mit ihren Aufgaben nach unten in „Erledigt“, ebenso einzelne erledigte Aufgaben
    // (Daniel, 10.10.2026). Abschnitt = Aufgaben seit dem letzten Gate bis einschließlich Gate.
    // Teilprojekte (Daniel, 13.10.2026): Unterstränge im Hauptstrang – projekt_straenge.eltern_id zeigt auf den Hauptstrang
    function abschnitt(s, teil) {
      var offen = [], gruppen = [], lose = [], abs = [];
      je[s.id].forEach(function (a) {
        if (a.art !== "gate") { abs.push(a); return; }
        if (a.status === "erledigt") {
          gruppen.push({ gate: a, l: abs.filter(function (x) { return x.status === "erledigt"; }) });
          offen = offen.concat(abs.filter(function (x) { return x.status !== "erledigt"; }));
        } else {
          abs.forEach(function (x) { if (x.status === "erledigt") lose.push(x); else offen.push(x); });
          offen.push(a);
        }
        abs = [];
      });
      abs.forEach(function (x) { if (x.status === "erledigt") lose.push(x); else offen.push(x); });
      if (gruppen.length || lose.length) fertig.push({ s: s, titel: teil ? teil.titel + " › " + s.titel : s.titel, gruppen: gruppen, lose: lose });
      return '<ol class="pl-liste" data-pl-liste="' + s.id + '">' + offen.map(function (a) { return zeile(a, alle, h); }).join("") + "</ol>";
    }
    oben(straenge).forEach(function (s) {
      var k = kinder(straenge, s.id);
      html += '<section class="pl-strang' + (!einer && istZu(s.id) ? " pl-zu" : "") + '" data-strang="' + s.id + '">' + (einer ? "" : '<h4 class="pl-strang-titel"><span class="pl-griff pl-s-griff" draggable="true" data-s-griff title="Ziehen zum Umsortieren" aria-hidden="true"></span><span class="pl-s-name">' + esc(s.titel) + "</span>" + '<button type="button" class="pl-klapp" data-pl-klapp aria-label="Auf- und zuklappen" aria-expanded="' + !istZu(s.id) + '"><span class="tl-dreieck" aria-hidden="true"></span></button>' + "</h4>") + abschnitt(s) +
        '<p class="pl-neu"><button type="button" data-pl-aufgabe="' + s.id + '">+ Aufgabe</button><button type="button" data-pl-gate="' + s.id + '">+ Gate</button><button type="button" data-pl-teil="' + s.id + '">+ Teilprojekt</button></p>' +
        k.map(function (c) {
          return '<section class="pl-teil' + (istZu(c.id) ? " pl-zu" : "") + '" data-strang="' + c.id + '"><h5 class="pl-strang-titel pl-teil-titel"><span class="pl-griff pl-s-griff" draggable="true" data-s-griff title="Ziehen zum Umsortieren" aria-hidden="true"></span><span class="pl-teil-kicker">Teilprojekt</span><span class="pl-s-name">' + esc(c.titel) + "</span>" + '<button type="button" class="pl-klapp" data-pl-klapp aria-label="Auf- und zuklappen" aria-expanded="' + !istZu(c.id) + '"><span class="tl-dreieck" aria-hidden="true"></span></button>' + "</h5>" + abschnitt(c, s) +
            '<p class="pl-neu"><button type="button" data-pl-aufgabe="' + c.id + '">+ Aufgabe</button><button type="button" data-pl-gate="' + c.id + '">+ Gate</button></p></section>';
        }).join("") + "</section>";
    });
    html += '<p class="pl-neu pl-neu--strang"><button type="button" data-pl-strang>+ Strang</button></p>';
    if (ohne.length) html += '<section class="pl-strang"><h4 class="pl-strang-titel pl-strang-titel--ohne">Noch keinem Strang zugeordnet</h4><ol class="pl-liste">' +
      ohne.map(function (a) { return zeile(a, alle, h, true, true, true); }).join("") + "</ol></section>";
    if (fertig.length) {
      var zu = true; try { zu = localStorage.getItem("pl-fertig-" + (auf[0] && auf[0].projekt_id)) !== "auf"; } catch (x) {}
      html += '<section class="pl-fertig"><button type="button" class="pl-fertig-kopf" data-pl-fertig aria-expanded="' + !zu + '">Erledigt<span class="kb-k-pfeil" aria-hidden="true"></span></button>' +
        '<div class="pl-fertig-inhalt"' + (zu ? " hidden" : "") + ">" + fertig.map(function (f) {
          return (einer ? "" : '<h4 class="pl-fertig-strang">' + esc(f.titel) + "</h4>") +
            f.gruppen.slice().reverse().map(function (g) {
              return '<ol class="pl-liste pl-liste--fertig">' + zeile(g.gate, alle, h, true, true, true) + g.l.map(function (a) { return zeile(a, alle, h, true, true, true); }).join("") + "</ol>";
            }).join("") +
            (f.lose.length ? '<ol class="pl-liste pl-liste--fertig">' + f.lose.map(function (a) { return zeile(a, alle, h, true, true, true); }).join("") + "</ol>" : "");
        }).join("") + "</div></section>";
    }
    return html;
  }
  function pfeile(a, erst, letzt, ohneStrang) {
    if (ohneStrang) return '<span class="pl-griff pl-griff--leer"></span>';
    return '<span class="pl-griff" draggable="true" title="Ziehen zum Umsortieren" aria-hidden="true"></span>';
  }
  function datumKurz(d) { return new Date(String(d).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }); }
  function heuteIso() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function zeile(a, auf, h, erst, letzt, ohneStrang) {
    var z = zustand(a, auf);
    if (a.art === "gate") {
      var f = fehlend(a, auf);
      var stand = z === "fertig" ? "Erreicht" + (a.erledigt_am ? " am " + new Date(a.erledigt_am).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "")
        : f.length ? "Es fehlt noch: " + f.map(function (x) { return x.titel; }).join(" · ") : "Alles erledigt – Gate kann erreicht werden";
      return '<li class="pl-z pl-gate pl-z--' + z + '" data-a="' + a.id + '" data-art="gate">' + pfeile(a, erst, letzt, ohneStrang) +
        '<button type="button" class="st-haken' + (z === "fertig" ? " an" : "") + '" aria-label="' + (z === "fertig" ? "Wieder öffnen" : "Als erreicht abhaken") + '"></button>' +
        // Gate mit Termin (Daniel, 11.10.2026): Datum direkt hier setzen oder ändern
        '<div class="pl-inhalt"><span class="pl-gate-kopf"><span class="pl-gate-kicker">Gate</span>' +
          (z === "fertig" ? (a.faellig_am ? '<span class="pl-gate-ziel">geplant ' + datumKurz(a.faellig_am) + "</span>" : "")
            : '<label class="pl-gate-ziel' + (a.faellig_am && a.faellig_am < heuteIso() ? " pl-gate-ziel--ueber" : "") + '">Termin <input type="date" data-gate-datum="' + a.id + '" value="' + esc(a.faellig_am || "") + '"></label>') +
        '</span><b class="pl-titel">' + esc(a.titel) + "</b>" +
        '<span class="pl-gate-stand">' + esc(stand) + "</span></div></li>";
    }
    return '<li class="pl-z pl-z--' + z + '" data-a="' + a.id + '">' + pfeile(a, erst, letzt, ohneStrang) +
      '<button type="button" class="st-haken' + (z === "fertig" ? " an" : "") + '" aria-label="' + (z === "fertig" ? "Wieder öffnen" : "Erledigt") + '"></button>' +
      '<div class="pl-inhalt">' + h.titel(a) +
      (z !== "fertig" && a.faellig_am && h.frist ? '<span class="pl-frist">' + h.frist(a) + "</span>" : "") +
      '<span class="pr-wer">' + (z === "fertig" ? "erledigt" : h.phase(a)) + " · " + esc(h.wer(a) || "offen") + (h.paket ? h.paket(a) : "") + "</span>" +
      (z === "fertig" ? "" : '<div class="pr-auf-zusatz">' + h.zusatz(a) + "</div>") + h.details(a) + "</div></li>";
  }

  /* ---------- Plan (visuell) ---------- */
  function bild(straenge, auf, alle) {
    alle = alle || auf;
    var je = ordnen(straenge, auf);
    return '<p class="pl-legende"><span class="pl-leg-linie"></span>Abfolge<span class="pl-leg-linie pl-leg-linie--gestr"></span>wartet auf anderen Strang</p>' +
      '<div class="pl-plan" data-pl-plan><div class="pl-plan-innen"><svg class="pl-svg" data-pl-svg aria-hidden="true"></svg>' +
      oben(straenge).map(function (s, i) {
        var k = kinder(straenge, s.id), farbe = " pl-bahn--" + (i % 3);
        function spur(x) {
          return '<div class="pl-bahn-spur">' + je[x.id].map(function (a) {
            var z = zustand(a, alle);
            if (a.art === "gate") return '<div class="pl-knoten pl-k-gate pl-z--' + z + '" data-k="' + a.id + '"><span class="pl-gate-kicker">Gate' + (a.faellig_am ? " · " + datumKurz(a.faellig_am) : "") + '</span><b>' + esc(a.titel) + "</b></div>";
            return '<div class="pl-knoten pl-karte pl-z--' + z + '" data-k="' + a.id + '"><b>' + esc(a.titel) + "</b></div>";
          }).join("") + "</div>";
        }
        if (!k.length) return '<div class="pl-bahn' + farbe + '"><div class="pl-bahn-kopf"><b>' + esc(s.titel) + "</b></div>" + spur(s) + "</div>";
        // Hauptstrang mit Teilprojekten: Kopfzeile, eigene Aufgaben (falls vorhanden), dann je Teilprojekt eine Bahn
        return '<div class="pl-gruppe' + farbe + '"><p class="pl-gruppe-kopf">' + esc(s.titel) + "</p>" +
          (je[s.id].length ? '<div class="pl-bahn pl-bahn--teil"><div class="pl-bahn-kopf"><b>Übergreifend</b></div>' + spur(s) + "</div>" : "") +
          k.map(function (c) { return '<div class="pl-bahn pl-bahn--teil"><div class="pl-bahn-kopf"><span class="pl-teil-kicker">Teilprojekt</span><b>' + esc(c.titel) + "</b></div>" + spur(c) + "</div>"; }).join("") + "</div>";
      }).join("") + "</div></div>";
  }
  function linien(wurzel, straenge, auf) {
    var plan = wurzel.querySelector("[data-pl-plan]"); if (!plan) return;
    var innen = plan.querySelector(".pl-plan-innen"), svg = plan.querySelector("[data-pl-svg]"), je = ordnen(straenge, auf);
    var box = innen.getBoundingClientRect();
    svg.setAttribute("width", innen.scrollWidth); svg.setAttribute("height", innen.scrollHeight);
    function pos(id) { var el = innen.querySelector('[data-k="' + id + '"]'); if (!el) return null; var r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, m: r.top - box.top + r.height / 2, t: r.top - box.top, b: r.bottom - box.top }; }
    var strangVon = {}; auf.forEach(function (a) { strangVon[a.id] = a.strang_id; });
    var pfade = "";
    function pfeil(von, nach, gestr) {
      var a = pos(von), b = pos(nach); if (!a || !b) return;
      var x1 = a.r, y1 = a.m, x2 = b.l - 6, y2 = b.m;
      if (x2 < x1 + 10) {   // Ziel liegt links (anderer Strang): von unten/oben anfahren
        var y1b = y2 > y1 ? a.b : a.t, xm = (a.l + a.r) / 2;
        pfade += '<path d="M' + xm + "," + y1b + " C" + xm + "," + (y1b + y2) / 2 + " " + (x2 - 30) + "," + y2 + " " + x2 + "," + y2 + '" class="pl-pfad' + (gestr ? " pl-pfad--gestr" : "") + '" marker-end="url(#pl-spitze)"/>';
        return;
      }
      var mx = (x1 + x2) / 2;
      pfade += '<path d="M' + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2 + '" class="pl-pfad' + (gestr ? " pl-pfad--gestr" : "") + '" marker-end="url(#pl-spitze)"/>';
    }
    Object.keys(je).forEach(function (k) { var l = je[k]; for (var i = 1; i < l.length; i++) pfeil(l[i - 1].id, l[i].id, false); });
    auf.forEach(function (a) { idListe(a.vorgaenger).forEach(function (v) { if (strangVon[v] && a.strang_id && strangVon[v] !== a.strang_id) pfeil(v, a.id, true); }); });
    svg.innerHTML = '<defs><marker id="pl-spitze" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="pl-spitze"/></marker></defs>' + pfade;
  }

  /* ---------- Umsortieren ---------- */
  // Neue Reihenfolge eines Strangs speichern und die Gates neu verknüpfen: Gate braucht alle Aufgaben seit dem letzten Gate
  // im Strang + die Abhängigkeiten aus anderen Strängen, die es schon hatte.
  function speichern(db, strangId, ids, auf) {
    var nach = {}; auf.forEach(function (a) { nach[a.id] = a; });
    // Erledigtes steht unten im Block „Erledigt“ – in der Reihenfolge bleibt es vorne, in seiner bisherigen Abfolge
    var erl = auf.filter(function (a) { return a.strang_id === strangId && a.status === "erledigt" && ids.indexOf(a.id) < 0; })
      .sort(function (a, b) { return (a.reihenfolge || 0) - (b.reihenfolge || 0); }).map(function (a) { return a.id; });
    ids = erl.concat(ids);
    var updates = [], seitGate = [];
    ids.forEach(function (id, i) {
      var a = nach[id], u = { reihenfolge: i + 1, strang_id: strangId };
      if (a.art === "gate") {
        var fremd = idListe(a.vorgaenger).filter(function (v) { return nach[v] && nach[v].strang_id !== strangId && ids.indexOf(v) < 0; });
        u.vorgaenger = seitGate.concat(fremd);
        seitGate = [];
      } else seitGate.push(id);
      updates.push(db.from("aufgaben").update(u).eq("id", id));
    });
    return Promise.all(updates).then(function (r) { var f = r.filter(function (x) { return x.error; })[0]; if (f) throw new Error(f.error.message); });
  }
  function verdrahten(wurzel, db, straenge, auf, neu) {
    function idsVon(ol) { return Array.prototype.map.call(ol.querySelectorAll(":scope > li[data-a]"), function (li) { return +li.getAttribute("data-a"); }); }
    // Gate-Termin speichern
    wurzel.querySelectorAll("[data-gate-datum]").forEach(function (inp) {
      inp.onchange = function () {
        inp.disabled = true;
        db.from("aufgaben").update({ faellig_am: inp.value || null }).eq("id", +inp.getAttribute("data-gate-datum")).then(function (r) {
          inp.disabled = false; if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; } neu();
        });
      };
    });
    // Block „Erledigt“ auf- und zuklappen – je Projekt gemerkt
    var fk = wurzel.querySelector("[data-pl-fertig]");
    if (fk) fk.onclick = function () {
      var auf2 = fk.getAttribute("aria-expanded") !== "true"; fk.setAttribute("aria-expanded", String(auf2)); fk.nextElementSibling.hidden = !auf2;
      try { localStorage.setItem("pl-fertig-" + projektId(), auf2 ? "auf" : "zu"); } catch (x) {}
    };
    // + Gate: Zwischenergebnis ans Ende des Strangs – braucht alles seit dem letzten Gate; danach per Griff verschieben
    wurzel.querySelectorAll("[data-pl-gate]").forEach(function (b) {
      b.onclick = function () {
        var sid = +b.getAttribute("data-pl-gate"), titel = prompt("Name des Gates (Zwischenergebnis), z. B. „Release 2.0“ oder „Konzept freigegeben“:");
        if (!titel || !titel.trim()) return;
        var l = ordnen(straenge, auf)[sid] || [], seit = [];
        l.forEach(function (a) { if (a.art === "gate") seit = []; else seit.push(a.id); });
        b.disabled = true;
        db.from("aufgaben").insert({ titel: titel.trim(), art: "gate", status: "offen", spalte: "backlog", projekt_id: projektId(), strang_id: sid,
          reihenfolge: l.reduce(function (m, x) { return Math.max(m, x.reihenfolge || 0); }, 0) + 1, vorgaenger: seit, bereich: "Projekt", zustaendig_name: "Daniel", verantwortlich: "Daniel" })
          .then(function (r) { if (r.error) { b.disabled = false; alert("Nicht gespeichert: " + r.error.message); return; } neu(); });
      };
    });
    // + Aufgabe (Daniel, 12.10.2026): eigene Aufgabe ans Ende des Strangs – danach per Griff an die richtige Stelle ziehen
    wurzel.querySelectorAll("[data-pl-aufgabe]").forEach(function (b) {
      b.onclick = function () {
        var sid = +b.getAttribute("data-pl-aufgabe"), titel = prompt("Neue Aufgabe:");
        if (!titel || !titel.trim()) return;
        var l = ordnen(straenge, auf)[sid] || [];
        b.disabled = true;
        db.from("aufgaben").insert({ titel: titel.trim(), art: "aufgabe", status: "offen", spalte: "todo", projekt_id: projektId(), strang_id: sid,
          reihenfolge: l.reduce(function (m, x) { return Math.max(m, x.reihenfolge || 0); }, 0) + 1, vorgaenger: [], bereich: "Projekt", zustaendig_name: "Daniel", verantwortlich: "Daniel" })
          .then(function (r) { b.disabled = false; if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; } neu(); });
      };
    });
    // + Teilprojekt: Unterstrang im Hauptstrang
    wurzel.querySelectorAll("[data-pl-teil]").forEach(function (b) {
      b.onclick = function () {
        var sid = +b.getAttribute("data-pl-teil"), titel = prompt("Name des Teilprojekts:");
        if (!titel || !titel.trim()) return;
        b.disabled = true;
        db.from("projekt_straenge").insert({ projekt_id: projektId(), titel: titel.trim(), eltern_id: sid, reihenfolge: naechste(kinder(straenge, sid)) })
          .then(function (r) { b.disabled = false; if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; } neu(); });
      };
    });
    // + Strang
    var sb = wurzel.querySelector("[data-pl-strang]");
    if (sb) sb.onclick = function () {
      var titel = prompt(oben(straenge).length === 1 ? "Name des neuen Strangs? (Der bisherige heißt „" + oben(straenge)[0].titel + "“ – du kannst ihn danach umbenennen.)" : "Name des neuen Strangs:");
      if (!titel || !titel.trim()) return;
      sb.disabled = true;
      db.from("projekt_straenge").insert({ projekt_id: projektId(), titel: titel.trim(), reihenfolge: naechste(oben(straenge)) })
        .then(function (r) { if (r.error) { sb.disabled = false; alert("Nicht gespeichert: " + r.error.message); return; } neu(); });
    };
    // Strang/Teilprojekt auf- und zuklappen
    wurzel.querySelectorAll("[data-pl-klapp]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var sek = b.closest("[data-strang]"), zu = !sek.classList.contains("pl-zu");
        sek.classList.toggle("pl-zu", zu); b.setAttribute("aria-expanded", String(!zu));
        try { if (zu) localStorage.setItem("pl-zu-" + sek.getAttribute("data-strang"), "1"); else localStorage.removeItem("pl-zu-" + sek.getAttribute("data-strang")); } catch (x) {}
      };
    });
    // Strang umbenennen: Klick auf die Überschrift
    wurzel.querySelectorAll(".pl-strang-titel").forEach(function (t) {
      var sek = t.closest("[data-strang]"); if (!sek) return;
      t.title = "Klicken zum Umbenennen";
      t.onclick = function (e) {
        if (e.target.closest("[data-s-griff], [data-pl-klapp]") || t.__nachZug) return;
        var sid = +sek.getAttribute("data-strang"), alt = (straenge.filter(function (s) { return s.id === sid; })[0] || {}).titel, n = prompt("Strang umbenennen:", alt);
        if (!n || !n.trim() || n.trim() === alt) return;
        db.from("projekt_straenge").update({ titel: n.trim() }).eq("id", sid).then(function (r) { if (r.error) alert(r.error.message); else neu(); });
      };
    });
    function projektId() { var m = location.hash.match(/p=(\d+)/); return m ? +m[1] : null; }
    // Stränge und Teilprojekte verschieben (Daniel, 13.10.2026): Überschrift am Griff ziehen (Rechner) oder lange drücken (Handy).
    // Verschoben wird nur innerhalb derselben Ebene: Hauptstränge untereinander, Teilprojekte innerhalb ihres Hauptstrangs.
    function geschwister(sek) {
      var sel = sek.classList.contains("pl-teil") ? ".pl-teil" : ".pl-strang[data-strang]";
      return Array.prototype.filter.call(sek.parentNode.children, function (x) { return x.matches(sel); });
    }
    function strangSchieben(sek, y) {
      var l = geschwister(sek), andere = l.filter(function (x) { return x !== sek; });
      var ziel = andere.filter(function (x) { var r = x.getBoundingClientRect(); return y < r.top + r.height / 2; })[0];
      if (ziel) { if (ziel !== sek.nextElementSibling) sek.parentNode.insertBefore(sek, ziel); }
      else { var letzt = andere[andere.length - 1]; if (letzt && letzt.nextElementSibling !== sek) sek.parentNode.insertBefore(sek, letzt.nextElementSibling); }
    }
    function strangSpeichern(sek, vorher) {
      var ids = geschwister(sek).map(function (x) { return +x.getAttribute("data-strang"); });
      if (ids.join() === vorher) return;
      sek.parentNode.classList.add("laedt");
      Promise.all(ids.map(function (id, i) { return db.from("projekt_straenge").update({ reihenfolge: i + 1 }).eq("id", id); }))
        .then(function (r) { var f = r.filter(function (x) { return x.error; })[0]; if (f) throw f.error; neu(); })
        .catch(function (er) { sek.parentNode.classList.remove("laedt"); alert("Nicht gespeichert: " + er.message); });
    }
    // Beim Ziehen eines Strangs nur die Überschriften zeigen – sonst sind die Wege (vor allem am Handy) zu lang
    function kompakt(sek, an, y) {
      wurzel.classList.toggle("pl-s-kompakt", an);
      wurzel.classList.toggle("pl-s-kompakt--oben", an && !sek.classList.contains("pl-teil"));
      if (an && y != null) window.scrollBy(0, sek.getBoundingClientRect().top - (y - 12));
    }
    var sZug = null;
    wurzel.querySelectorAll("[data-s-griff]").forEach(function (g) {
      var sek = g.closest("[data-strang]");
      g.addEventListener("dragstart", function (e) {
        e.stopPropagation(); sZug = { sek: sek, vorher: geschwister(sek).map(function (x) { return x.getAttribute("data-strang"); }).join() };
        sek.classList.add("pl-zieht"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "strang"); } catch (x) {}
        setTimeout(function () { kompakt(sek, true, e.clientY); }, 0);
      });
      g.addEventListener("dragend", function () { if (!sZug) return; var z = sZug; sZug = null; z.sek.classList.remove("pl-zieht"); kompakt(z.sek, false); strangSpeichern(z.sek, z.vorher); });
    });
    if (!wurzel.__sDrag) {   // einmal je Wurzel – verdrahten() läuft bei jedem Neuzeichnen
      wurzel.__sDrag = 1;
      wurzel.addEventListener("dragover", function (e) { if (!wurzel.__sZug) return; e.preventDefault(); strangSchieben(wurzel.__sZug.sek, e.clientY); });
    }
    Object.defineProperty(wurzel, "__sZug", { configurable: true, get: function () { return sZug; } });
    // Handy: Überschrift lange drücken, dann ziehen
    wurzel.querySelectorAll("[data-strang] > .pl-strang-titel").forEach(function (h) {
      var sek = h.parentNode, st = null;
      function ende() {
        if (!st) return; clearTimeout(st.uhr);
        document.removeEventListener("touchmove", bewegen, { passive: false });
        document.removeEventListener("touchend", los); document.removeEventListener("touchcancel", los);
        sek.classList.remove("pl-hebt"); if (st.an) kompakt(sek, false); st = null;
      }
      function bewegen(e) {
        if (!st) return; var f = e.touches[0];
        if (!st.an) { if (Math.abs(f.clientY - st.y0) > 8 || Math.abs(f.clientX - st.x0) > 8) ende(); return; }
        e.preventDefault(); strangSchieben(sek, f.clientY);
        if (f.clientY < 70) window.scrollBy(0, -12); else if (f.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
      }
      function los(e) {
        if (!st) return; var war = st; ende();
        if (war.an) { if (e.cancelable) e.preventDefault(); h.__nachZug = true; setTimeout(function () { h.__nachZug = false; }, 400); strangSpeichern(sek, war.vorher); }
      }
      h.addEventListener("touchstart", function (e) {
        if (e.touches.length > 1) return; ende();
        var f = e.touches[0];
        st = { x0: f.clientX, y0: f.clientY, an: false, vorher: geschwister(sek).map(function (x) { return x.getAttribute("data-strang"); }).join() };
        st.uhr = setTimeout(function () { if (!st) return; st.an = true; sek.classList.add("pl-hebt"); kompakt(sek, true, st.y0); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) {} }, 450);
        document.addEventListener("touchmove", bewegen, { passive: false });
        document.addEventListener("touchend", los); document.addEventListener("touchcancel", los);
      }, { passive: true });
    });
    // Ziehen am Griff – auch in einen anderen Strang
    var gezogen = null;
    wurzel.querySelectorAll(".pl-griff[draggable]:not([data-s-griff])").forEach(function (g) {
      g.addEventListener("dragstart", function (e) { gezogen = g.closest("li"); gezogen.classList.add("pl-zieht"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", gezogen.getAttribute("data-a")); } catch (x) {} });
      g.addEventListener("dragend", function () { if (gezogen) gezogen.classList.remove("pl-zieht"); });
    });
    wurzel.querySelectorAll("[data-pl-liste]").forEach(function (ol) {
      ol.addEventListener("dragover", function (e) {
        if (!gezogen) return; e.preventDefault();
        var unter = Array.prototype.filter.call(ol.querySelectorAll(":scope > li"), function (li) { return li !== gezogen; })
          .filter(function (li) { var r = li.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; })[0];
        if (unter) ol.insertBefore(gezogen, unter); else ol.appendChild(gezogen);
      });
      ol.addEventListener("drop", function (e) {
        if (!gezogen) return; e.preventDefault();
        var g = gezogen; gezogen = null; g.classList.remove("pl-zieht");
        ablegen(ol, g);
      });
    });
    // Neue Reihenfolge speichern – Ziel-Strang und, falls die Zeile aus einem anderen kam, auch den alten
    function ablegen(ol, g) {
      var alt = null, sidVorher = (auf.filter(function (a) { return a.id === +g.getAttribute("data-a"); })[0] || {}).strang_id;
      wurzel.querySelectorAll("[data-pl-liste]").forEach(function (x) { if (x !== ol && x.contains(g) === false && +x.getAttribute("data-pl-liste") === sidVorher) alt = x; });
      ol.classList.add("laedt");
      var p = speichern(db, +ol.getAttribute("data-pl-liste"), idsVon(ol), auf);
      if (alt) p = p.then(function () { return speichern(db, +alt.getAttribute("data-pl-liste"), idsVon(alt), auf); });
      p.then(neu).catch(function (er) { ol.classList.remove("laedt"); alert("Nicht gespeichert: " + er.message); });
    }
    // Handy/Tablet (Daniel, 13.10.2026): Zeile lange gedrückt halten, dann mit dem Finger verschieben – keine Pfeile.
    // Nur Touch-Ereignisse; am großen Rechner mit Maus bleibt das Ziehen an den sechs Punkten unverändert.
    var tz = null;
    function tzEnde() {
      if (!tz) return;
      clearTimeout(tz.uhr);
      document.removeEventListener("touchmove", tzBewegen, { passive: false });
      document.removeEventListener("touchend", tzLos); document.removeEventListener("touchcancel", tzLos);
      if (tz.li) tz.li.classList.remove("pl-hebt");
      tz = null;
    }
    function tzZiel(x, y) {
      var el = document.elementFromPoint(x, y), ol = el && el.closest ? el.closest("[data-pl-liste]") : null;
      return ol && wurzel.contains(ol) ? ol : null;
    }
    function tzBewegen(e) {
      if (!tz) return;
      var f = e.touches[0];
      if (!tz.an) {   // vor dem Anheben: Bewegung heißt Scrollen – abbrechen
        if (Math.abs(f.clientY - tz.y0) > 8 || Math.abs(f.clientX - tz.x0) > 8) tzEnde();
        return;
      }
      e.preventDefault();
      var ol = tzZiel(f.clientX, f.clientY);
      if (ol) {
        var unter = Array.prototype.filter.call(ol.querySelectorAll(":scope > li"), function (li) { return li !== tz.li; })
          .filter(function (li) { var r = li.getBoundingClientRect(); return f.clientY < r.top + r.height / 2; })[0];
        if (unter) { if (unter !== tz.li.nextSibling) ol.insertBefore(tz.li, unter); } else if (ol.lastElementChild !== tz.li) ol.appendChild(tz.li);
        tz.ol = ol;
      }
      // am Bildschirmrand mitscrollen
      if (f.clientY < 70) window.scrollBy(0, -12); else if (f.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
    }
    function tzLos(e) {
      if (!tz) return;
      var war = tz;
      if (war.an) { if (e.cancelable) e.preventDefault(); war.li.__nachZug = true; setTimeout(function () { war.li.__nachZug = false; }, 400); war.li.classList.remove("pl-hebt"); var ol = war.ol || war.start; tzEnde(); if (war.li.parentNode !== war.start || idsVon(war.start).join() !== war.vorher) ablegen(ol, war.li); return; }
      tzEnde();
    }
    wurzel.querySelectorAll("[data-pl-liste] > li").forEach(function (li) {
      if (!li.querySelector(".pl-griff[draggable]")) return;
      li.addEventListener("touchstart", function (e) {
        if (e.touches.length > 1 || e.target.closest("input, select, textarea, a, label")) return;
        tzEnde();
        var f = e.touches[0], ol = li.parentNode;
        tz = { li: li, start: ol, ol: ol, x0: f.clientX, y0: f.clientY, an: false, vorher: idsVon(ol).join() };
        tz.uhr = setTimeout(function () {
          if (!tz) return;
          tz.an = true; li.classList.add("pl-hebt");
          if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) {}
        }, 450);
        document.addEventListener("touchmove", tzBewegen, { passive: false });
        document.addEventListener("touchend", tzLos); document.addEventListener("touchcancel", tzLos);
      }, { passive: true });
      // nach dem Anheben keinen Klick auslösen (Titel klappt sonst auf)
      li.addEventListener("click", function (e) { if (li.__nachZug) { e.preventDefault(); e.stopPropagation(); li.__nachZug = false; } }, true);
      li.addEventListener("contextmenu", function (e) { if (tz && tz.li === li) e.preventDefault(); });
    });
    // Plan: Linien zeichnen, bei Größenänderung neu
    if (wurzel.querySelector("[data-pl-plan]")) {
      var zeichnen = function () { linien(wurzel, straenge, auf); };
      requestAnimationFrame(zeichnen); setTimeout(zeichnen, 300);
      if (!window.__plResize) { window.__plResize = 1; window.addEventListener("resize", function () { if (window.__plNeu) window.__plNeu(); }); }
      window.__plNeu = zeichnen;
    }
  }

  window.ProjektPlan = { liste: liste, bild: bild, verdrahten: verdrahten };
})();
