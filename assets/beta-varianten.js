/* Korrespondenz – Varianten C (Entscheidungs-Sprint) und E (Liste und Detail)
   mit den echten Mails aus dem Handlungsbedarf. Anmeldung, Laden und
   Entscheidungen laufen über BetaMail (beta-mail.js), wie auf korrespondenz-beta.html.
   Welche Variante gezeigt wird, steht im HTML: <div data-variante-echt="c|e">. */
(function () {
  "use strict";
  var B = window.BetaMail, esc = B.esc;
  var wurzel = document.querySelector("[data-variante-echt]");
  if (!wurzel || !B) return;
  var variante = wurzel.getAttribute("data-variante-echt");
  var REIHE = ["nobrainer", "termin", "aufgabe", "tiefer", "offen"];
  var mails = [], dbStatus = "", pos = 0;

  var MS_LOGO = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="6.5" height="6.5" fill="#f25022"/><rect x="8.5" y="1" width="6.5" height="6.5" fill="#7fba00"/><rect x="1" y="8.5" width="6.5" height="6.5" fill="#00a4ef"/><rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#ffb900"/></svg>';

  function anmeldenZeigen(text) {
    wurzel.innerHTML = '<div class="kb-hinweis"><p>' + (text || "Melde dich einmal mit deinem empiria-Konto an, dann erscheinen hier deine echten Mails aus dem Handlungsbedarf.") +
      '</p><button class="kb-knopf" type="button">' + MS_LOGO + "Mit Microsoft anmelden</button></div>";
    wurzel.querySelector("button").onclick = B.anmelden;
  }
  function holen() {
    wurzel.innerHTML = '<div class="kb-laedt" aria-label="Mails werden geladen"><span></span><span></span><span></span></div>';
    B.laden().then(function (d) {
      dbStatus = d.dbStatus;
      mails = d.handlung.slice().sort(function (a, b) { return REIHE.indexOf(a.vorschlag.art) - REIHE.indexOf(b.vorschlag.art); });
      pos = 0;
      zeichnen();
    }).catch(function (e) {
      if (e && e.anmelden) anmeldenZeigen("Die Anmeldung ist abgelaufen – einmal kurz neu anmelden.");
      else wurzel.innerHTML = '<div class="kb-hinweis"><p>Die Mails konnten gerade nicht geladen werden (' + esc(e && e.message) + ").</p></div>";
    });
  }

  /* ---------- Bausteine ---------- */
  function hinweisDb() {
    return dbStatus === "abgemeldet" ? '<p class="kb-fehler">Claudes Einschätzungen und Antwortentwürfe erscheinen, sobald du einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> angemeldet bist.</p>' : "";
  }
  function inhalt(m) {
    var a = m.analyse;
    return '<div class="kb-block"><p class="kb-label">' + (a ? "Worum es geht" : "Anfang der Mail") + "</p><p>" + esc(a ? a.zusammenfassung : m.bodyPreview) + "</p></div>" +
      '<div class="kb-block"><p class="kb-label">' + (a ? "Vorschlag" : "Erste Einordnung – nur nach Stichworten") + '</p><p class="kb-vorschlag-text">' + esc(m.vorschlag.text) + "</p></div>" +
      (a && a.entwurf ? '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(a.entwurf) + "</pre></div>" : "");
  }
  function original(m) {
    return '<div class="kb-block ve-orig"><p class="kb-label">Originalmail</p><pre class="v-original" data-voll>' + esc(m.volltext || m.bodyPreview) + "</pre></div>";
  }
  function anweisungZeile(m) {
    var a = m.anweisung;
    return a ? '<p class="kb-anweisung"><span>' + (a.status === "offen" ? "Deine Anweisung – wird umgesetzt" : a.status === "umgesetzt" ? "Umgesetzt" : "Verworfen") +
      "</span>" + esc(a.text) + (a.ergebnis ? "<br><small>" + esc(a.ergebnis) + "</small>" : "") + "</p>" : "";
  }
  // Freigeben · Anders … · Schon erledigt – nebeneinander
  // Freigabe-Knopf nennt die Folge; ohne Einschätzung kein Freigeben
  function folgeZeile(f) {
    return f ? '<p class="kb-folge"><b>Beim Klick auf „' + esc(f.knopf) + '“:</b> ' + esc(f.text) + " Die Mail wandert nach „Bei Claude“.</p>"
      : '<p class="kb-folge">Noch nicht von Claude eingeschätzt – darum gibt es hier nichts freizugeben. Sag mit „Anders …“, was passieren soll, oder hake mit „Schon erledigt“ ab.</p>';
  }
  function knoepfe(m) {
    var f = B.folge(m), e = B.entscheidungLesen(m);
    return '<div data-anw>' + anweisungZeile(m) + '</div>' + folgeZeile(f) + '<div class="kb-entscheid vx-entscheid" data-entscheid>' +
      (f ? '<button type="button" data-e="freigeben" aria-pressed="' + (e === "freigeben") + '">' + esc(f.knopf) + "</button>" : "") +
      '<button type="button" data-anders aria-expanded="false">Anders …</button>' +
      '<button type="button" data-e="erledigt" aria-pressed="' + (e === "erledigt") + '">Schon erledigt</button></div>' +
      '<form class="kb-anders" data-anders-form hidden><textarea rows="3" placeholder="Sag oder tippe, was passieren soll – z. B. „An Tobias weiterleiten, er soll den Termin übernehmen.“"></textarea>' +
      '<div><button type="submit" class="kb-knopf kb-knopf--klein">An Claude geben</button><button type="button" class="kb-anders-abbruch">Abbrechen</button></div></form>';
  }
  function verdrahten(feld, m, nachEntscheid) {
    var pre = feld.querySelector("[data-voll]");
    if (pre && !m.volltext) B.volltext(m).then(function (t) { m.volltext = t; pre.textContent = t; }).catch(function () {});
    var box = feld.querySelector("[data-entscheid]"), form = feld.querySelector("[data-anders-form]"), andersB = box.querySelector("[data-anders]");
    andersB.onclick = function () {
      var auf = form.hidden; form.hidden = !auf; andersB.setAttribute("aria-expanded", String(auf));
      if (auf) form.querySelector("textarea").focus();
    };
    form.querySelector(".kb-anders-abbruch").onclick = function () { form.hidden = true; andersB.setAttribute("aria-expanded", "false"); };
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var t = form.querySelector("textarea").value.trim();
      if (!t) return;
      form.classList.add("laedt");
      B.anweisen(m, t).then(function () {
        feld.querySelector("[data-anw]").innerHTML = anweisungZeile(m);
        form.hidden = true; form.querySelector("textarea").value = ""; andersB.setAttribute("aria-expanded", "false");
      }).catch(function (f) { alert("Nicht gespeichert: " + f.message); }).then(function () { form.classList.remove("laedt"); });
    };
    box.querySelectorAll("button[data-e]").forEach(function (b) {
      b.onclick = function () {
        box.classList.add("laedt");
        B.entscheiden(m, b.getAttribute("data-e")).then(function (e) {
          box.querySelectorAll("button[data-e]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-e") === e)); });
          if (e && nachEntscheid) nachEntscheid(e);
        }).catch(function (f) { alert("Konnte nicht gespeichert werden: " + f.message); })
          .then(function () { box.classList.remove("laedt"); });
      };
    });
  }

  /* ---------- C – Entscheidungs-Sprint: eine Mail, links/rechts blättern ---------- */
  function c() {
    if (!mails.length) { wurzel.innerHTML = hinweisDb() + '<p class="kb-leer">Gerade nichts im Handlungsbedarf.</p>'; return; }
    var m = mails[pos];
    wurzel.innerHTML = hinweisDb() +
      '<p class="vc-stand">' + '<span class="kb-art kb-art--' + esc(m.vorschlag.art) + '">' + esc(B.arten[m.vorschlag.art] || "") + "</span></p>" +
      '<article class="vc-karte"><p class="kb-zeit">' + esc(B.absender(m)) + " · " + B.wann(m.receivedDateTime) + " · " + esc(m.konto.name) + "</p>" +
      '<h2 class="h-serif">' + esc(m.subject || "(ohne Betreff)") + "</h2>" + inhalt(m) + original(m) + "</article>" +
      '<div class="vc-blaettern"><button type="button" data-zurueck aria-label="Vorherige Mail"' + (pos === 0 ? " disabled" : "") + '>&larr;</button>' +
      '<button type="button" data-vor aria-label="Nächste Mail"' + (pos >= mails.length - 1 ? " disabled" : "") + ">&rarr;</button></div>" +
      '<div class="vc-entscheid">' + knoepfe(m) + "</div>";
    wurzel.querySelector("[data-zurueck]").onclick = function () { if (pos > 0) { pos--; c(); } };
    wurzel.querySelector("[data-vor]").onclick = function () { if (pos < mails.length - 1) { pos++; c(); } };
    // Nach Freigeben oder „Schon erledigt“ kurz zeigen, dann zur nächsten Mail
    verdrahten(wurzel, m, function () { setTimeout(function () { if (pos < mails.length - 1) { pos++; c(); } }, 500); });
  }

  /* ---------- E – Liste und Detail ---------- */
  function e() {
    if (!mails.length) { wurzel.innerHTML = hinweisDb() + '<p class="kb-leer">Gerade nichts im Handlungsbedarf.</p>'; return; }
    var html = hinweisDb() + '<div class="ve"><div class="ve-liste">';
    REIHE.forEach(function (art) {
      var teil = mails.filter(function (m) { return m.vorschlag.art === art; });
      if (!teil.length) return;
      html += '<p class="ve-gruppe">' + esc(B.arten[art]) + "</p>" + teil.map(function (m) {
        var n = mails.indexOf(m);
        return '<button type="button" class="ve-eintrag' + (n === pos ? " aktiv" : "") + '" data-i="' + n + '"><span class="ve-name">' + esc(B.absender(m)) +
          '</span><span class="ve-zeit">' + B.wann(m.receivedDateTime) + '</span><span class="ve-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span></button>";
      }).join("");
    });
    wurzel.innerHTML = html + '</div><div class="ve-detail" data-detail></div></div>';
    var rechts = wurzel.querySelector("[data-detail]");
    function detail() {
      var m = mails[pos];
      rechts.innerHTML = '<p class="ve-meta">' + esc(B.arten[m.vorschlag.art] || "") + " · " + esc(m.konto.name) + " · " + B.wann(m.receivedDateTime) + "</p>" +
        '<h2 class="h-serif ve-titel">' + esc(m.subject || "(ohne Betreff)") + '</h2><p class="ve-von">' + esc(B.absender(m)) + "</p>" +
        inhalt(m) + knoepfe(m) + original(m);
      verdrahten(rechts, m);
    }
    wurzel.querySelectorAll(".ve-eintrag").forEach(function (k) {
      k.onclick = function () {
        wurzel.querySelectorAll(".ve-eintrag").forEach(function (x) { x.classList.remove("aktiv"); }); k.classList.add("aktiv");
        pos = +k.getAttribute("data-i"); detail();
        if (window.innerWidth < 900) rechts.scrollIntoView({ behavior: "smooth" });
      };
    });
    detail();
  }

  function zeichnen() { (variante === "c" ? c : e)(); }

  B.start().then(function (konto) { if (konto) holen(); else anmeldenZeigen(); })
    .catch(function (e) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Anmeldung nicht möglich: ' + esc(e && e.message) + "</p></div>"; });
})();
