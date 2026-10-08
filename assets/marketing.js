/* Marketing – Zielgruppen, Außenwirkung, Kennzahlen, Stoßrichtungen, Aktionen.
   Kreislauf: Content bauen → posten → analysieren → Änderungen ableiten → prüfen, ob es wirkt.
     Kennzahlen  – LinkedIn (wöchentlich vom Mac gelesen: linkedin_abgleich.py → linkedin_kennzahlen),
                   Homepage und Google folgen (noch nicht angebunden).
     Beiträge    – die reichweitenstärksten LinkedIn-Beiträge der letzten 12 Monate (linkedin_posts).
     Zielgruppen, Außenwirkung, Stoßrichtungen – werden im Sparring erarbeitet; Klick legt die Anfrage ab
                   und kopiert den Startsatz für den Chat (wie auf der Steuerung). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-marketing]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function f(n) { return n == null ? "–" : Number(n).toLocaleString("de-DE"); }
  var THEMEN = [
    { k: "zielgruppen", n: "Zielgruppen", s: "Wen wollen wir je Marke erreichen – und was bewegt diese Menschen?", m: "Deep Dive" },
    { k: "aussen", n: "Außenwirkung", s: "Wie wirken empiria, sofortsichtbar und Müller&Ströbel. heute – und wie sollen sie wirken?", m: "360°-Blick" },
    { k: "stoss", n: "Stoßrichtungen", s: "Worauf konzentrieren wir uns in den nächsten Monaten – Themen, Kanäle, Rhythmus?", m: "Ideen-Modus" }
  ];
  var KREIS = ["Content bauen", "Posten", "Analysieren", "Änderungen ableiten", "Wirkung prüfen"];

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheint hier das Marketing.</p></div>'; return; }
    Promise.all([
      db.from("linkedin_kennzahlen").select("stichtag, follower, kontakte, impressionen, interaktionen, profilaufrufe").eq("quelle", "profil").order("stichtag", { ascending: false }).limit(2),
      db.from("linkedin_posts").select("text, link, impressionen, reaktionen, kommentare, stand").order("impressionen", { ascending: false }).limit(5)
    ]).then(function (r) { zeichnen(r[0].data || [], (r[1].data || []).slice().sort(function (a, b) { return (b.impressionen || 0) - (a.impressionen || 0); }).slice(0, 5)); });
  });

  function kachel(link, zahl, titel, unter) {
    return '<a class="an-k" href="' + link + '" target="_blank" rel="noopener"><span class="an-zahl">' + zahl + "</span><b>" + titel + "</b><small>" + unter + "</small></a>";
  }
  function leer(titel, unter) { return '<div class="an-k an-k--leer"><span class="an-zahl">–</span><b>' + titel + "</b><small>" + unter + "</small></div>"; }

  function zeichnen(k, posts) {
    var j = k[0], v = k[1];
    var stand = j ? "Stand " + new Date(j.stichtag + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "";
    var diff = j && v && v.follower != null ? " · " + (j.follower - v.follower >= 0 ? "+" : "") + f(j.follower - v.follower) + " seit " + new Date(v.stichtag + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) : "";
    var kacheln = j ?
      kachel("https://www.linkedin.com/analytics/creator/content/", f(j.impressionen), "LinkedIn-Reichweite", "Impressionen in 28 Tagen · " + f(j.interaktionen) + " Interaktionen · " + stand) +
      kachel("https://www.linkedin.com/analytics/creator/audience/", f(j.follower), "LinkedIn-Follower", f(j.kontakte) + " Kontakte" + diff) +
      kachel("https://www.linkedin.com/analytics/profile-views/", f(j.profilaufrufe), "Profilbesucher", "in 90 Tagen · " + stand)
      : leer("LinkedIn", "noch keine Daten");
    kacheln += leer("Homepage", "Besucher und Anfragen – noch nicht angebunden") + leer("Google", "Suche und Sichtbarkeit – noch nicht angebunden");

    var liste = posts.length ? '<ol class="mk-posts">' + posts.map(function (p) {
      return '<li><a href="' + esc(p.link) + '" target="_blank" rel="noopener"><span class="mk-posts-zahl">' + f(p.impressionen) + "</span>" +
        '<span class="mk-posts-text">' + esc(p.text) + "<small>" + f(p.reaktionen) + " Reaktionen · " + f(p.kommentare) + " Kommentare</small></span></a></li>";
    }).join("") + "</ol>" : '<p class="st4-leer">Noch keine Beiträge gelesen.</p>';

    wurzel.innerHTML =
      '<p class="mk-kreis">' + KREIS.map(function (x) { return "<span>" + x + "</span>"; }).join('<i aria-hidden="true">→</i>') + "</p>" +
      '<section class="st4-block"><h2 class="st4-h">Kennzahlen</h2><div class="an-signale">' + kacheln + "</div></section>" +
      '<section class="st4-block"><h2 class="st4-h">Beiträge mit der größten Reichweite</h2><p class="mk-unter">LinkedIn, letzte 12 Monate · Impressionen</p>' + liste + "</section>" +
      '<section class="st4-block"><h2 class="st4-h">Zielgruppen, Außenwirkung, Stoßrichtungen</h2><div class="st4-sparring mk-themen">' + THEMEN.map(function (t) {
        return '<button type="button" class="st4-spar" data-thema="' + t.k + '"><span class="st4-spar-z">' + esc(t.m) + "</span><b>" + esc(t.n) + '</b><span class="st4-spar-s">' + esc(t.s) + '</span><span class="st4-spar-los">Erarbeiten <i aria-hidden="true">→</i></span></button>';
      }).join("") + '</div><p class="st4-hinweis" data-thema-hinweis hidden></p></section>';

    var hw = wurzel.querySelector("[data-thema-hinweis]");
    wurzel.querySelectorAll("[data-thema]").forEach(function (b) {
      b.onclick = function () {
        var t = THEMEN.filter(function (x) { return x.k === b.getAttribute("data-thema"); })[0];
        var satz = t.m + " Marketing starten – Thema: " + t.n + ". " + t.s;
        db.from("sparring").insert({ modus: t.m + " Marketing: " + t.n }).then(function () {});
        var fertig = function () { hw.hidden = false; hw.textContent = "„" + t.n + "“ ist angefragt – der Startsatz liegt in der Zwischenablage, einfach im Chat mit Claude einfügen."; };
        if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
      };
    });
  }
})();
