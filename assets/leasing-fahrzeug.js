/* Leasing Fahrzeug – Modelle zum Ansehen: je Modell ein großes Bild und drei Ansichten zum Umschalten, Klick aufs Bild öffnet die Großansicht.
   Daten: assets/leasing-fahrzeug.json (Fotos von Wikimedia Commons, Nachweis unten auf der Seite). */
(function () {
  var ziel = document.querySelector("[data-lf-modelle]");
  var nachweis = document.querySelector("[data-lf-nachweis]");
  if (!ziel) return;
  var esc = function (s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ANTRIEB = { E: "Elektro", PHEV: "Plug-in-Hybrid" };

  fetch("/assets/leasing-fahrzeug.json?v=202610141900").then(function (r) { return r.json(); }).then(function (d) {
    var html = "", gruppe = null, offen = false, quellen = [];
    d.modelle.forEach(function (m) {
      if (m.gruppe !== gruppe) {
        if (offen) html += "</div>";
        gruppe = m.gruppe; offen = true;
        html += '<h3 class="lf-gruppe">' + esc(gruppe) + '</h3><div class="lf-raster">';
      }
      var b = m.bilder || [], name = m.marke + " " + m.modell;
      html += '<article class="lf-karte" data-lf-karte>';
      if (b.length) {
        html += '<button class="lf-bild" type="button" data-lf-gross aria-label="' + esc(name) + ' groß ansehen" style="--lf-hg: url(&quot;' + esc(b[0].klein) + '&quot;)">' +
          '<img src="' + esc(b[0].gross) + '" alt="' + esc(name) + '" loading="lazy" data-voll="' + esc(b[0].voll) + '"></button>';
        if (b.length > 1) {
          html += '<div class="lf-ansichten">' + b.map(function (x, i) {
            return '<button type="button" aria-pressed="' + (i === 0) + '" aria-label="Ansicht ' + (i + 1) + '" data-gross="' + esc(x.gross) + '" data-klein="' + esc(x.klein) + '" data-voll="' + esc(x.voll) + '">' +
              '<img src="' + esc(x.klein) + '" alt="" loading="lazy"></button>';
          }).join("") + "</div>";
        }
        b.forEach(function (x) { quellen.push({ name: name, x: x }); });
      } else {
        html += '<div class="lf-leer">Noch keine freien Fotos gefunden</div>';
      }
      html += '<div class="lf-text"><h3><small>' + esc(m.marke) + "</small>" + esc(m.modell) + "</h3>" +
        '<span class="lf-antrieb' + (m.antrieb === "E" ? " lf-antrieb--e" : "") + '">' + esc(ANTRIEB[m.antrieb] || m.antrieb) + "</span></div>" +
        (m.notiz ? '<p class="lf-notiz">' + esc(m.notiz) + "</p>" : "") + "</article>";
    });
    if (offen) html += "</div>";
    ziel.innerHTML = html;

    if (nachweis) {
      nachweis.innerHTML = "<details><summary>Bildnachweis – Fotos von Wikimedia Commons</summary><ul>" + quellen.map(function (q) {
        return '<li>' + esc(q.name) + ': <a href="' + esc(q.x.seite) + '" target="_blank" rel="noopener">' + esc(q.x.urheber || "unbekannt") + "</a>, " + esc(q.x.lizenz) + "</li>";
      }).join("") + "</ul></details>";
    }
  }).catch(function () { ziel.innerHTML = '<p class="lf-unter">Die Modelle konnten nicht geladen werden.</p>'; });

  // Ansicht umschalten
  ziel.addEventListener("click", function (e) {
    var t = e.target.closest(".lf-ansichten button");
    if (t) {
      var karte = t.closest("[data-lf-karte]"), img = karte.querySelector(".lf-bild img");
      img.src = t.getAttribute("data-gross"); img.setAttribute("data-voll", t.getAttribute("data-voll"));
      img.parentNode.style.setProperty("--lf-hg", 'url("' + t.getAttribute("data-klein") + '")');
      karte.querySelectorAll(".lf-ansichten button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
      return;
    }
    var g = e.target.closest("[data-lf-gross]");
    if (g) zeigeGross(g.closest("[data-lf-karte]"));
  });

  // Großansicht
  var dlg = document.createElement("dialog");
  dlg.className = "lf-gross";
  dlg.innerHTML = '<img alt=""><div class="lf-gross-leiste"><span></span><button type="button">Schließen</button></div>';
  document.body.appendChild(dlg);
  dlg.querySelector("button").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  function zeigeGross(karte) {
    var img = karte.querySelector(".lf-bild img");
    dlg.querySelector("img").src = img.getAttribute("data-voll");
    dlg.querySelector("img").alt = img.alt;
    dlg.querySelector("span").textContent = img.alt;
    dlg.showModal();
  }
})();
