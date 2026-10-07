/* Seitenauswahl neben dem Logo: oeffnet und schliesst per Klick,
   schliesst ausserdem bei Klick daneben und mit Escape. */
(function () {
  "use strict";
  var dd = document.querySelector("[data-sn-dd]");
  if (!dd) return;
  var btn = dd.querySelector(".sn-toggle");

  function set(open) {
    dd.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    set(!dd.classList.contains("is-open"));
  });
  document.addEventListener("click", function (e) {
    if (!dd.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dd.classList.contains("is-open")) { set(false); btn.focus(); }
  });
})();

/* Unterseiten auf- und zuklappen. Liegt die aktuelle Seite darunter,
   ist der Bereich beim Öffnen schon aufgeklappt. */
(function () {
  "use strict";
  document.querySelectorAll(".sn-sub-toggle").forEach(function (b) {
    var kinder = document.getElementById(b.getAttribute("aria-controls"));
    if (!kinder) return;
    if (kinder.querySelector('[aria-current="page"]')) { kinder.classList.add("is-open"); b.setAttribute("aria-expanded", "true"); }
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var auf = !kinder.classList.contains("is-open");
      kinder.classList.toggle("is-open", auf);
      b.setAttribute("aria-expanded", auf ? "true" : "false");
    });
  });
})();
