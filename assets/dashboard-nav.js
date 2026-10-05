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
