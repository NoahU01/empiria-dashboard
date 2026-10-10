/* Aufgaben – was Daniel sieht: Details als Stichpunkte (aus dem Diktat, eine Zeile = ein Punkt) plus verlinkte Unterlagen
   und in einfacher Sprache, wovon die Aufgabe abhängt bzw. auf wen sie wartet.
   Die Logik dahinter (Weg, Mail-Gespräch, Kette) bleibt in der Datenbank und wird nicht gezeigt.
   Genutzt von projekte-crm.js und aufgaben-board.js.
     AufgabenDetails.html(a)        → Stichpunkte zum Aufklappen oder ""
     AufgabenDetails.lage(a, alle)  → immer sichtbare Zeilen: „Hängt ab von …“, „Wartet auf Rückmeldung von …“, Hinweis,
                                      Markierung „Vorschlag von Claude“ mit Ja · Anders · Später
     AufgabenDetails.vorlagenAnhaengen(db, aufgaben) → hängt offene Vorlagen (a._vorlage) an */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  function html(a) {
    var punkte = String(a.beschreibung || "").split("\n").map(function (x) { return x.replace(/^[-•·]\s*/, "").trim(); }).filter(Boolean);
    var links = (a.unterlagen || []).filter(function (u) { return u && u.url; }).map(function (u) {
      return '<li class="ad-link"><a href="' + esc(u.url) + '" target="_blank" rel="noopener">' + esc(u.titel || "Link") + "</a></li>"; });
    var li = punkte.map(function (x) { return "<li>" + esc(x) + "</li>"; }).concat(links);
    // Fertiger Prompt zum Kopieren (aufgaben.prompt) – Daniel, 10.10.2026
    var pr = a.prompt ? '<div class="ad-prompt"><p class="ad-prompt-kopf"><span>Prompt</span><button type="button" data-prompt-kopieren>Kopieren</button></p><pre>' + esc(a.prompt) + "</pre></div>" : "";
    return (li.length ? '<ul class="ad-punkte">' + li.join("") + "</ul>" : "") + pr;
  }

  function lage(a, alle) {
    if (a.status !== "offen") return "";
    var offenVor = (a.vorgaenger || []).map(function (id) { return (alle || []).filter(function (x) { return x.id === +id && x.status !== "erledigt"; })[0]; }).filter(Boolean);
    var h = offenVor.length ? '<p class="pr-wartet">Hängt ab von: ' + offenVor.map(function (v) {
      return '<button type="button" class="ad-kette" data-zu-aufgabe="' + v.id + '">' + esc(v.titel) + "</button>"; }).join(", ") + "</p>" : "";
    if (a.hinweis) h += '<p class="pr-hinweis">' + esc(a.hinweis) + "</p>";
    if (a._vorlage) h += vorschlag(a._vorlage);
    return h;
  }

  /* Vorschlag von Claude zu dieser Aufgabe (Tabelle vorlagen, aufgabe_id) – Markierung, aufklappbar, direkt freigeben */
  function vorschlag(v) {
    return '<div class="ad-v" data-vorlage="' + v.id + '"><button type="button" class="ad-v-marke" aria-expanded="false">' +
      (v.entscheidung === "spaeter" ? "Vorschlag – zurückgestellt" : "Vorschlag von Claude") + "</button>" +
      '<div class="ad-v-panel" hidden><p>' + esc(v.vorschlag) + "</p>" +
      '<div class="ad-v-knoepfe"><button type="button" class="ad-v-ja" data-v-e="ja">Ja</button><button type="button" data-v-anders>Anders</button><button type="button" data-v-e="spaeter">Später</button></div>' +
      '<form class="ad-v-anders" hidden><textarea rows="3" placeholder="Was soll stattdessen passieren?"></textarea><button type="submit">An Claude geben</button></form></div></div>';
  }
  // Offene Vorlagen laden und an die Aufgaben hängen
  function vorlagenAnhaengen(db, aufgaben) {
    return db.from("vorlagen").select("id, aufgabe_id, vorschlag, entscheidung").eq("status", "offen").then(function (r) {
      var m = {}; (r.data || []).forEach(function (v) { if (v.aufgabe_id) m[v.aufgabe_id] = v; });
      aufgaben.forEach(function (a) { a._vorlage = m[a.id] || null; });
    }, function () {});
  }
  document.addEventListener("click", function (e) {
    var t = e.target, box = t.closest && t.closest(".ad-v"); if (!box) return;
    var id = +box.getAttribute("data-vorlage"), panel = box.querySelector(".ad-v-panel"), marke = box.querySelector(".ad-v-marke"), db = window.empiriaDb;
    if (t.closest(".ad-v-marke")) { panel.hidden = !panel.hidden; marke.setAttribute("aria-expanded", String(!panel.hidden)); return; }
    if (t.closest("[data-v-anders]")) { var f = box.querySelector(".ad-v-anders"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("textarea").focus(); return; }
    var k = t.closest("[data-v-e]"); if (!k || !db) return;
    var art = k.getAttribute("data-v-e");
    entscheiden(box, id, art === "ja" ? { status: "entschieden", entscheidung: "ja" } : { entscheidung: "spaeter" }, art === "ja" ? "✓ Freigegeben – Claude ist dran" : "Zurückgestellt");
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest && e.target.closest(".ad-v-anders"); if (!f) return;
    e.preventDefault(); var box = f.closest(".ad-v"), t = f.querySelector("textarea").value.trim(); if (!t) return;
    entscheiden(box, +box.getAttribute("data-vorlage"), { status: "entschieden", entscheidung: "anders", entscheidung_text: t }, "✓ An Claude gegeben: „" + t + "“");
  });
  function entscheiden(box, id, felder, text) {
    felder.entschieden_am = new Date().toISOString();
    box.classList.add("laedt");
    window.empiriaDb.from("vorlagen").update(felder).eq("id", id).then(function (r) {
      box.classList.remove("laedt");
      if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      box.innerHTML = '<p class="ad-v-erledigt">' + esc(text) + "</p>";
    });
  }

  // Prompt kopieren
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-prompt-kopieren]"); if (!b) return;
    var t = b.closest(".ad-prompt").querySelector("pre").textContent;
    function ok() { b.textContent = "Kopiert ✓"; setTimeout(function () { b.textContent = "Kopieren"; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { alert("Kopieren nicht möglich – bitte markieren und kopieren."); });
    else { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (x) {} ta.remove(); }
  });

  // Klick auf „Hängt ab von …“: zur Aufgabe springen
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-zu-aufgabe]"); if (!b) return;
    var ziel = document.querySelector('[data-a="' + b.getAttribute("data-zu-aufgabe") + '"]'); if (!ziel) return;
    ziel.scrollIntoView({ behavior: "smooth", block: "center" });
    ziel.classList.add("ad-blink"); setTimeout(function () { ziel.classList.remove("ad-blink"); }, 1200);
  });

  window.AufgabenDetails = { html: html, lage: lage, vorlagenAnhaengen: vorlagenAnhaengen };
})();
