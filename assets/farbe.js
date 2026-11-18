/* Hell / dunkel (Daniel, 18.11.2026): Schalter im Menüband. Die Wahl gilt je Gerät (localStorage) und wird vor dem ersten Bild gesetzt,
   damit die Seite beim Laden nicht hell aufblitzt. Gestaltung: assets/dunkel.css (erzeugt von werkzeuge/dunkel_bauen.py). */
(function () {
  "use strict";
  var w; try { w = localStorage.getItem("farbe"); } catch (x) {}
  if (w === "dunkel") document.documentElement.setAttribute("data-farbe", "dunkel");
  var MOND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SONNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function dunkel() { return document.documentElement.getAttribute("data-farbe") === "dunkel"; }
  function zeichnen(b) { b.innerHTML = dunkel() ? SONNE : MOND; b.setAttribute("aria-label", dunkel() ? "Helle Darstellung" : "Dunkle Darstellung"); b.title = b.getAttribute("aria-label"); }
  function einbauen() {
    var hn = document.querySelector(".hn"); if (!hn || hn.querySelector(".d3-farbe")) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "d3-farbe"; zeichnen(b);
    b.onclick = function () {
      if (dunkel()) document.documentElement.removeAttribute("data-farbe"); else document.documentElement.setAttribute("data-farbe", "dunkel");
      try { localStorage.setItem("farbe", dunkel() ? "dunkel" : "hell"); } catch (x) {}
      zeichnen(b);
    };
    hn.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", einbauen); else einbauen();
})();
