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
    var html = "", einer = straenge.length === 1, fertig = [];
    // Oben nur Offenes. Erreichte Gates rutschen mit ihren Aufgaben nach unten in „Erledigt“, ebenso einzelne erledigte Aufgaben
    // (Daniel, 10.10.2026). Abschnitt = Aufgaben seit dem letzten Gate bis einschließlich Gate.
    straenge.slice().sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }).forEach(function (s) {
      var offen = [], gruppen = [], lose = [], abschnitt = [];
      je[s.id].forEach(function (a) {
        if (a.art !== "gate") { abschnitt.push(a); return; }
        if (a.status === "erledigt") {
          gruppen.push({ gate: a, l: abschnitt.filter(function (x) { return x.status === "erledigt"; }) });
          offen = offen.concat(abschnitt.filter(function (x) { return x.status !== "erledigt"; }));
        } else {
          abschnitt.forEach(function (x) { if (x.status === "erledigt") lose.push(x); else offen.push(x); });
          offen.push(a);
        }
        abschnitt = [];
      });
      abschnitt.forEach(function (x) { if (x.status === "erledigt") lose.push(x); else offen.push(x); });
      if (gruppen.length || lose.length) fertig.push({ s: s, gruppen: gruppen, lose: lose });
      html += '<section class="pl-strang" data-strang="' + s.id + '">' + (einer ? "" : '<h4 class="pl-strang-titel">' + esc(s.titel) + "</h4>") + '<ol class="pl-liste" data-pl-liste="' + s.id + '">' +
        offen.map(function (a) { return zeile(a, alle, h); }).join("") + "</ol>" +
        '<p class="pl-neu"><button type="button" data-pl-gate="' + s.id + '">+ Gate</button></p></section>';
    });
    html += '<p class="pl-neu pl-neu--strang"><button type="button" data-pl-strang>+ Strang</button></p>';
    if (ohne.length) html += '<section class="pl-strang"><h4 class="pl-strang-titel pl-strang-titel--ohne">Noch keinem Strang zugeordnet</h4><ol class="pl-liste">' +
      ohne.map(function (a) { return zeile(a, alle, h, true, true, true); }).join("") + "</ol></section>";
    if (fertig.length) {
      var zu = true; try { zu = localStorage.getItem("pl-fertig-" + (auf[0] && auf[0].projekt_id)) !== "auf"; } catch (x) {}
      html += '<section class="pl-fertig"><button type="button" class="pl-fertig-kopf" data-pl-fertig aria-expanded="' + !zu + '">Erledigt<span class="kb-k-pfeil" aria-hidden="true"></span></button>' +
        '<div class="pl-fertig-inhalt"' + (zu ? " hidden" : "") + ">" + fertig.map(function (f) {
          return (einer ? "" : '<h4 class="pl-fertig-strang">' + esc(f.s.titel) + "</h4>") +
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
  function zeile(a, auf, h, erst, letzt, ohneStrang) {
    var z = zustand(a, auf);
    if (a.art === "gate") {
      var f = fehlend(a, auf);
      var stand = z === "fertig" ? "Erreicht" + (a.erledigt_am ? " am " + new Date(a.erledigt_am).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "")
        : f.length ? "Es fehlt noch: " + f.map(function (x) { return x.titel; }).join(" · ") : "Alles erledigt – Gate kann erreicht werden";
      return '<li class="pl-z pl-gate pl-z--' + z + '" data-a="' + a.id + '" data-art="gate">' + pfeile(a, erst, letzt, ohneStrang) +
        '<button type="button" class="st-haken' + (z === "fertig" ? " an" : "") + '" aria-label="' + (z === "fertig" ? "Wieder öffnen" : "Als erreicht abhaken") + '"></button>' +
        '<div class="pl-inhalt"><span class="pl-gate-kicker">Gate</span><b class="pl-titel">' + esc(a.titel) + "</b>" +
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
      straenge.slice().sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }).map(function (s, i) {
        return '<div class="pl-bahn pl-bahn--' + (i % 3) + '"><div class="pl-bahn-kopf"><b>' + esc(s.titel) + '</b></div><div class="pl-bahn-spur">' +
          je[s.id].map(function (a) {
            var z = zustand(a, alle);
            if (a.art === "gate") return '<div class="pl-knoten pl-k-gate pl-z--' + z + '" data-k="' + a.id + '"><span class="pl-gate-kicker">Gate</span><b>' + esc(a.titel) + "</b></div>";
            return '<div class="pl-knoten pl-karte pl-z--' + z + '" data-k="' + a.id + '"><b>' + esc(a.titel) + "</b></div>";
          }).join("") + "</div></div>";
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
    // + Strang
    var sb = wurzel.querySelector("[data-pl-strang]");
    if (sb) sb.onclick = function () {
      var titel = prompt(straenge.length === 1 ? "Name des neuen Strangs? (Der bisherige heißt „" + straenge[0].titel + "“ – du kannst ihn danach umbenennen.)" : "Name des neuen Strangs:");
      if (!titel || !titel.trim()) return;
      sb.disabled = true;
      db.from("projekt_straenge").insert({ projekt_id: projektId(), titel: titel.trim(), reihenfolge: straenge.length + 1 })
        .then(function (r) { if (r.error) { sb.disabled = false; alert("Nicht gespeichert: " + r.error.message); return; } neu(); });
    };
    // Strang umbenennen: Klick auf die Überschrift
    wurzel.querySelectorAll(".pl-strang-titel").forEach(function (t) {
      var sek = t.closest("[data-strang]"); if (!sek) return;
      t.title = "Klicken zum Umbenennen";
      t.onclick = function () {
        var sid = +sek.getAttribute("data-strang"), alt = (straenge.filter(function (s) { return s.id === sid; })[0] || {}).titel, n = prompt("Strang umbenennen:", alt);
        if (!n || !n.trim() || n.trim() === alt) return;
        db.from("projekt_straenge").update({ titel: n.trim() }).eq("id", sid).then(function (r) { if (r.error) alert(r.error.message); else neu(); });
      };
    });
    function projektId() { var m = location.hash.match(/p=(\d+)/); return m ? +m[1] : null; }
    // Ziehen am Griff – auch in einen anderen Strang
    var gezogen = null;
    wurzel.querySelectorAll(".pl-griff[draggable]").forEach(function (g) {
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
        var alt = null;
        wurzel.querySelectorAll("[data-pl-liste]").forEach(function (x) { if (x !== ol && x.contains(gezogen) === false && +x.getAttribute("data-pl-liste") === (auf.filter(function (a) { return a.id === +gezogen.getAttribute("data-a"); })[0] || {}).strang_id) alt = x; });
        var g = gezogen; gezogen = null; g.classList.remove("pl-zieht");
        ol.classList.add("laedt");
        var p = speichern(db, +ol.getAttribute("data-pl-liste"), idsVon(ol), auf);
        if (alt) p = p.then(function () { return speichern(db, +alt.getAttribute("data-pl-liste"), idsVon(alt), auf); });
        p.then(neu).catch(function (er) { ol.classList.remove("laedt"); alert("Nicht gespeichert: " + er.message); });
      });
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
