/* Markensicht für Analyse und Steuerung: Alle · empiria · sofortsichtbar · Müller&Ströbel.
   Die Wahl gilt für beide Seiten und bleibt auf dem Gerät gespeichert. Seiten hören auf das Ereignis „markefokus“.
     MarkeFokus.wert()        → "alle" | "empiria" | "sofortsichtbar" | "Müller&Ströbel."
     MarkeFokus.passt(marke)  → true, wenn der Eintrag zur gewählten Sicht gehört (ohne Marke = empiria) */
(function () {
  "use strict";
  var MARKEN = ["empiria", "sofortsichtbar", "Müller&Ströbel."], wert = "alle";
  try { wert = localStorage.getItem("marke-fokus") || "alle"; } catch (x) {}
  if (wert !== "alle" && MARKEN.indexOf(wert) < 0) wert = "alle";
  function norm(m) { if (!m) return "empiria"; if (/sofort/i.test(m) || /kontakt@/.test(m)) return "sofortsichtbar"; if (/m(ü|ue)ller/i.test(m)) return "Müller&Ströbel."; return "empiria"; }
  window.MarkeFokus = { wert: function () { return wert; }, passt: function (m) { return wert === "alle" || norm(m) === wert; }, norm: norm };
  var kopf = document.querySelector(".db-kopf"); if (!kopf) return;
  var box = document.createElement("div"); box.className = "mf"; box.setAttribute("role", "group"); box.setAttribute("aria-label", "Markensicht");
  function zeichnen() {
    box.innerHTML = [["alle", "Alle Marken"]].concat(MARKEN.map(function (m) { return [m, m]; })).map(function (x) {
      return '<button type="button" data-mf="' + x[0] + '" aria-pressed="' + (wert === x[0]) + '">' + x[1] + "</button>"; }).join("");
    box.querySelectorAll("[data-mf]").forEach(function (b) {
      b.onclick = function () { wert = b.getAttribute("data-mf"); try { localStorage.setItem("marke-fokus", wert); } catch (x) {} zeichnen(); document.dispatchEvent(new CustomEvent("markefokus", { detail: wert })); };
    });
  }
  zeichnen();
  kopf.insertAdjacentElement("afterend", box);
})();
