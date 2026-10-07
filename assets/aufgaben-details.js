/* Aufgeklappte Aufgabe – feste Abschnitte, leere werden nicht gezeigt.
   Genutzt von projekte-crm.js (Projektseite) und aufgaben-board.js (Seite Aufgaben).
   AufgabenDetails.html(a, alle) → HTML oder "" (dann gibt es nichts aufzuklappen).
   Erwartete Felder an a: beschreibung, ereignis {id, titel, datum, projekt_id}, person {id, vorname, nachname},
   organisationen {id, name}, weg, warten_auf, mail_entwurf_id, mail_gesendet_am, antwort_am, antwort_von,
   zeitblock_vorschlag, vorgaenger [ids], unterlagen [{titel, url}]. alle = Liste der Aufgaben für die Kette. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function tag(d) { return d ? new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : ""; }
  function name(k) { return k ? [k.vorname, k.nachname].filter(Boolean).join(" ") : ""; }
  function abschnitt(titel, inhalt) { return inhalt ? '<div class="ad-teil"><p class="ad-titel">' + titel + "</p>" + inhalt + "</div>" : ""; }

  function weg(a) {
    var wer = a.warten_auf ? esc(a.warten_auf) : "";
    if (a.weg === "selbst") return "<p>Selbst erledigen" + (a.zeitblock_vorschlag ? " · " + esc(a.zeitblock_vorschlag) : "") + "</p>";
    if (a.weg === "mail" || a.weg === "termin") {
      var stand = a.antwort_am ? "Antwort" + (a.antwort_von ? " von " + esc(a.antwort_von) : "") + " am " + tag(a.antwort_am)
        : a.mail_gesendet_am ? "gesendet am " + tag(a.mail_gesendet_am) + " – wartet auf Antwort"
        : a.mail_entwurf_id ? "Entwurf liegt bereit" : "noch keine Mail";
      return "<p>" + (a.weg === "termin" ? "Termin vereinbaren" : "Mail") + (wer ? " an " + wer : "") + " · " + stand + "</p>";
    }
    if (a.weg === "warten") return "<p>Warten" + (wer ? " auf " + wer : "") + "</p>";
    return "";
  }

  function html(a, alle) {
    alle = alle || [];
    function verweis(x) { return '<button type="button" class="ad-kette" data-zu-aufgabe="' + x.id + '">' + esc(x.titel) + (x.status === "erledigt" ? " ✓" : "") + "</button>"; }
    var vor = (a.vorgaenger || []).map(function (id) { return alle.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    var nach = alle.filter(function (x) { return (x.vorgaenger || []).indexOf(a.id) > -1; });
    var herkunft = [];
    if (a.ereignis) herkunft.push((a.ereignis.projekt_id ? '<a href="/strategie/projekte.html#p=' + a.ereignis.projekt_id + '">' : "<span>") +
      esc(a.ereignis.titel) + (a.ereignis.datum ? " · " + tag(a.ereignis.datum) : "") + (a.ereignis.projekt_id ? "</a>" : "</span>"));
    if (a.person) herkunft.push('<a href="/strategie/kontakte.html#k=' + a.person.id + '">' + esc(name(a.person)) + "</a>");
    if (a.organisationen && a.organisationen.id) herkunft.push('<a href="/strategie/kontakte.html#f=' + a.organisationen.id + '">' + esc(a.organisationen.name) + "</a>");
    var kette = (vor.length ? "<p>wartet auf: " + vor.map(verweis).join(", ") + "</p>" : "") + (nach.length ? "<p>danach folgt: " + nach.map(verweis).join(", ") + "</p>" : "");
    var unterlagen = (a.unterlagen || []).filter(function (u) { return u && u.url; });
    return abschnitt("Hintergrund", a.beschreibung ? "<p>" + esc(a.beschreibung).replace(/\n/g, "<br>") + "</p>" : "") +
      abschnitt("Herkunft", herkunft.length ? "<p>" + herkunft.join(" · ") + "</p>" : "") +
      abschnitt("Weg", weg(a)) +
      abschnitt("Kette", kette) +
      abschnitt("Unterlagen", unterlagen.length ? "<ul>" + unterlagen.map(function (u) {
        return '<li><a href="' + esc(u.url) + '" target="_blank" rel="noopener">' + esc(u.titel || u.url) + "</a></li>"; }).join("") + "</ul>" : "");
  }

  // Klick auf ein Glied der Kette: zur Aufgabe springen und sie aufklappen
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-zu-aufgabe]"); if (!b) return;
    var ziel = document.querySelector('[data-a="' + b.getAttribute("data-zu-aufgabe") + '"]'); if (!ziel) return;
    var k = ziel.querySelector("[data-auf-auf]"), det = ziel.querySelector(".pr-auf-details");
    if (det && det.hidden && k) k.click();
    ziel.scrollIntoView({ behavior: "smooth", block: "center" });
    ziel.classList.add("ad-blink"); setTimeout(function () { ziel.classList.remove("ad-blink"); }, 1200);
  });

  window.AufgabenDetails = { html: html };
})();
