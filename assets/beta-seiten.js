/* Dashboard Beta: Darstellung der Korrespondenz – Kachel auf dem Dashboard
   (data-kb="kachel") und ausführliche Unterseite (data-kb="seite"). */
(function () {
  "use strict";
  var B = window.BetaMail, esc = B.esc;
  var wurzel = document.querySelector("[data-kb]");
  if (!wurzel) return;
  var modus = wurzel.getAttribute("data-kb");
  var kopfKonto = document.querySelector("[data-kb-konto]");
  var daten = null;

  var MS_LOGO = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="6.5" height="6.5" fill="#f25022"/><rect x="8.5" y="1" width="6.5" height="6.5" fill="#7fba00"/><rect x="1" y="8.5" width="6.5" height="6.5" fill="#00a4ef"/><rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#ffb900"/></svg>';

  function ziel() { return wurzel.querySelector("[data-kb-inhalt]") || wurzel; }

  function anmeldenZeigen(text) {
    if (kopfKonto) kopfKonto.innerHTML = "";
    ziel().innerHTML = '<div class="kb-hinweis"><p>' + (text || "Melde dich einmal mit deinem empiria-Konto an. Danach liest das Dashboard deine Postfächer – nur in diesem Browser, nichts wird gespeichert oder verändert.") +
      '</p><button class="kb-knopf" type="button" data-kb-anmelden>' + MS_LOGO + "Mit Microsoft anmelden</button></div>";
    ziel().querySelector("[data-kb-anmelden]").addEventListener("click", B.anmelden);
  }
  function laedtZeigen() { ziel().innerHTML = '<div class="kb-laedt" aria-label="Mails werden geladen"><span></span><span></span><span></span></div>'; }
  function fehlerZeigen(e) {
    ziel().innerHTML = '<div class="kb-hinweis"><p>Die Mails konnten gerade nicht geladen werden (' + esc(e && e.message) + ').</p><button class="kb-knopf" type="button">Erneut versuchen</button></div>';
    ziel().querySelector("button").addEventListener("click", holen);
  }

  function kontoKopf(konto) {
    if (!kopfKonto) return;
    kopfKonto.innerHTML = "<span>Angemeldet als " + esc((konto.name || konto.username || "").split(" (")[0]) + "</span>" +
      (B.istDemo() ? '<span class="kb-demo">Beispieldaten</span>' : '<button type="button">Abmelden</button>');
    var b = kopfKonto.querySelector("button");
    if (b) b.addEventListener("click", B.abmelden);
  }

  function holen() {
    laedtZeigen();
    B.laden().then(function (d) { daten = d; zeichnen(); }).catch(function (e) {
      if (e && e.anmelden) anmeldenZeigen("Die Anmeldung ist abgelaufen – einmal kurz neu anmelden.");
      else fehlerZeigen(e);
    });
  }

  /* ---------- gemeinsame Bausteine ---------- */
  function fehlerZeile() {
    if (!daten.fehler.length) return "";
    return '<p class="kb-fehler">Noch kein Zugriff auf: ' + daten.fehler.map(function (f) { return esc(f.konto.name); }).join(", ") +
      " – die Freigabe bei Microsoft kann bis zu einer Stunde dauern.</p>";
  }
  function stand() {
    return '<p class="kb-stand">Stand ' + daten.stand.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) +
      ' · <button type="button" data-kb-neu>Neu laden</button></p>';
  }
  function standVerdrahten() { var b = ziel().querySelector("[data-kb-neu]"); if (b) b.addEventListener("click", holen); }

  function zeit(m) { return B.wann(m.receivedDateTime || m.sentDateTime); }
  function outlookLink(m, klasse, text) {
    return '<a class="' + klasse + '" href="' + esc(m.webLink) + '" target="_blank" rel="noopener">' + (text || "In Outlook öffnen") + "</a>";
  }

  /* ---------- Kachel auf dem Dashboard ---------- */
  function kachel() {
    var z = document.querySelector("[data-kb-anzahl]");
    if (z) z.textContent = daten.handlung.length;
    var chip = document.querySelector("[data-kb-kontakt]");
    if (chip && !daten.fehler.some(function (f) { return f.konto.key === "kontakt"; })) {
      chip.classList.remove("db-chip--leer");
      chip.innerHTML = '<i class="' + (daten.kontaktNeu ? "an" : "") + '"></i>kontakt@ <b>' + daten.kontaktNeu + " neu</b>";
    }
    var top = daten.handlung.slice(0, 5);
    var html = top.length ? '<ul class="kb-liste">' + top.map(function (m) {
      return '<li class="kb-mail' + (m.isRead ? "" : " ungelesen") + '"><div class="kb-zeile">' +
        '<span class="kb-von">' + esc(B.absender(m)) + '</span><span class="kb-zeit">' + zeit(m) + "</span>" +
        '<span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span>" +
        '<span class="kb-meta">' + B.badge(m.konto) + "<span>" + esc(m.grund) + "</span>" + outlookLink(m, "kb-oeffnen") + "</span></div></li>";
    }).join("") + "</ul>" : '<p class="kb-leer">Gerade nichts offen. Alles beantwortet.</p>';
    if (daten.handlung.length > 5) html += '<p class="kb-fehler">' + (daten.handlung.length - 5) + " weitere auf der Unterseite.</p>";
    ziel().innerHTML = html + fehlerZeile() + stand();
    standVerdrahten();
  }

  /* ---------- Unterseite ---------- */
  var TABS = [
    { key: "handlung", name: "Handlungsbedarf", liste: "handlung", gruppen: [["antworten", "Antworten"], ["termin", "Termin klären"], ["pruefen", "Prüfen und freigeben"], ["verfolgen", "Nachverfolgen"]] },
    { key: "relevant", name: "Relevant", liste: "relevant" },
    { key: "nicht", name: "Nicht relevant", liste: "nichtRelevant" },
    { key: "warten", name: "Wartet auf Antwort", liste: "warten", gruppen: [["nachfassen", "Nachfassen"], ["warten", "Noch abwarten"]] }
  ];
  var ERKLAERUNG = {
    antworten: "Direkt an dich, noch keine Antwort von dir im Gespräch.",
    termin: "Es geht um einen Termin – Zeit vorschlagen oder zusagen.",
    pruefen: "Angebot, Rechnung oder Vertrag – prüfen und freigeben.",
    verfolgen: "Von dir zur Nachverfolgung markiert.",
    nachfassen: "Deine Mail ist seit einigen Tagen ohne Rückmeldung – kurz nachhaken.",
    warten: "Noch frisch – Rückmeldung abwarten."
  };
  var zustand = { tab: "handlung", konto: "alle", suche: "", offen: {} };
  (function () {
    var h = location.hash.replace("#", "").split("/");
    if (TABS.some(function (t) { return t.key === h[0]; })) zustand.tab = h[0];
    if (h[1]) zustand.konto = h[1];
  })();

  function gefiltert(t) {
    var q = zustand.suche.toLowerCase();
    return daten[t.liste].filter(function (m) {
      if (zustand.konto !== "alle" && m.konto.key !== zustand.konto) return false;
      if (!q) return true;
      return (B.absender(m) + " " + m.subject + " " + m.bodyPreview).toLowerCase().indexOf(q) > -1;
    });
  }

  function zeileSeite(m) {
    var an = (m.toRecipients || []).map(function (e) { return e.emailAddress.name || e.emailAddress.address; }).join(", ");
    var cc = (m.ccRecipients || []).map(function (e) { return e.emailAddress.name || e.emailAddress.address; }).join(", ");
    var meta = B.badge(m.konto);
    if (m.vorschlag) meta += '<span class="kb-vorschlag">' + esc(m.vorschlag.text) + "</span>";
    if (m.grund) meta += "<span>" + esc(m.grund) + "</span>";
    if (m.hasAttachments) meta += "<span>Anhang</span>";
    var offen = zustand.offen[m.id];
    return '<li class="kb-mail' + (m.isRead === false ? " ungelesen" : "") + (offen ? " offen" : "") + '" data-id="' + esc(m.id) + '">' +
      '<button class="kb-zeile" type="button" aria-expanded="' + (offen ? "true" : "false") + '">' +
      '<span class="kb-von">' + esc(B.absender(m)) + '</span><span class="kb-zeit">' + zeit(m) + "</span>" +
      '<span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + '</span><span class="kb-meta">' + meta + "</span></button>" +
      '<div class="kb-auf"><p class="kb-an">An: ' + esc(an) + (cc ? "<br>Cc: " + esc(cc) : "") + "</p>" +
      '<pre class="kb-text" data-kb-text>' + esc(m.bodyPreview) + "</pre>" +
      '<div class="kb-schritt">' + (m.vorschlag ? '<span class="kb-vorschlag">Vorschlag: ' + esc(m.vorschlag.text) + "</span><small>" + esc(ERKLAERUNG[m.vorschlag.art] || "") + "</small>" : "") +
      outlookLink(m, "kb-knopf kb-knopf--klein") + "</div></div></li>";
  }

  function seite() {
    var t = TABS.filter(function (x) { return x.key === zustand.tab; })[0];
    var relUngelesen = daten.relevant.filter(function (m) { return !m.isRead && m.konto.key !== "kontakt"; }).length;
    var kacheln = [
      ["handlung", "alle", daten.handlung.length, "Handlungsbedarf"],
      ["warten", "alle", daten.warten.length, "Wartet auf Antwort"],
      ["relevant", "alle", relUngelesen, "Relevant, ungelesen"],
      ["relevant", "kontakt", daten.kontaktNeu, "kontakt@ neu"]
    ];
    var html = '<div class="kb-zahlen">' + kacheln.map(function (k) {
      var aktiv = zustand.tab === k[0] && zustand.konto === k[1];
      return '<button type="button" class="kb-kachel' + (aktiv ? " aktiv" : "") + '" data-tab="' + k[0] + '" data-konto="' + k[1] + '"><b>' + k[2] + "</b><span>" + k[3] + "</span></button>";
    }).join("") + "</div>";

    html += '<div class="kb-tabs" role="tablist">' + TABS.map(function (x) {
      return '<button type="button" role="tab" class="kb-tab" data-tab="' + x.key + '" aria-selected="' + (x.key === zustand.tab) + '">' + x.name + "<em>" + daten[x.liste].length + "</em></button>";
    }).join("") + "</div>";

    html += '<div class="kb-filter"><button type="button" data-konto="alle" aria-pressed="' + (zustand.konto === "alle") + '">Alle Konten</button>' +
      B.konten.map(function (k) { return '<button type="button" data-konto="' + k.key + '" aria-pressed="' + (zustand.konto === k.key) + '">' + esc(k.name) + "</button>"; }).join("") +
      '<input class="kb-suche" type="search" placeholder="Suchen: Name, Betreff, Text" value="' + esc(zustand.suche) + '" data-kb-suche></div>';

    html += '<div data-kb-liste>' + liste(t) + "</div>" + fehlerZeile() + stand();
    ziel().innerHTML = html;
    verdrahten();
  }

  function liste(t) {
    var mails = gefiltert(t);
    if (!mails.length) return '<p class="kb-leer">' + (zustand.suche ? "Nichts gefunden." : "Hier ist gerade nichts.") + "</p>";
    if (!t.gruppen) return '<ul class="kb-liste">' + mails.slice(0, 120).map(zeileSeite).join("") + "</ul>";
    return t.gruppen.map(function (g) {
      var teil = mails.filter(function (m) { return m.vorschlag && m.vorschlag.art === g[0]; });
      return teil.length ? '<p class="kb-gruppe">' + g[1] + " · " + teil.length + '</p><ul class="kb-liste">' + teil.map(zeileSeite).join("") + "</ul>" : "";
    }).join("");
  }

  function alleMails() { return daten.relevant.concat(daten.nichtRelevant, daten.warten); }

  function verdrahten() {
    var z = ziel();
    z.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () {
        zustand.tab = b.getAttribute("data-tab");
        if (b.hasAttribute("data-konto")) zustand.konto = b.getAttribute("data-konto");
        history.replaceState(null, "", "#" + zustand.tab + (zustand.konto !== "alle" ? "/" + zustand.konto : ""));
        seite();
      });
    });
    z.querySelectorAll(".kb-filter [data-konto]").forEach(function (b) {
      b.addEventListener("click", function () { zustand.konto = b.getAttribute("data-konto"); seite(); });
    });
    var s = z.querySelector("[data-kb-suche]");
    s.addEventListener("input", function () {
      zustand.suche = s.value;
      z.querySelector("[data-kb-liste]").innerHTML = liste(TABS.filter(function (x) { return x.key === zustand.tab; })[0]);
      zeilenVerdrahten();
    });
    zeilenVerdrahten();
    standVerdrahten();
  }

  function zeilenVerdrahten() {
    ziel().querySelectorAll(".kb-mail > .kb-zeile").forEach(function (b) {
      b.addEventListener("click", function () {
        var li = b.parentNode, id = li.getAttribute("data-id"), auf = !li.classList.contains("offen");
        li.classList.toggle("offen", auf);
        b.setAttribute("aria-expanded", auf ? "true" : "false");
        zustand.offen[id] = auf;
        var m = alleMails().filter(function (x) { return x.id === id; })[0];
        if (auf && m && !m.volltext) {
          B.volltext(m).then(function (t) {
            m.volltext = t;
            var pre = li.querySelector("[data-kb-text]");
            if (pre) pre.textContent = t.length > 6000 ? t.slice(0, 6000) + " …" : t;
          }).catch(function () {});
        } else if (auf && m && m.volltext) {
          li.querySelector("[data-kb-text]").textContent = m.volltext.slice(0, 6000);
        }
      });
    });
  }

  function zeichnen() { if (modus === "seite") seite(); else kachel(); }

  laedtZeigen();
  B.start().then(function (konto) {
    if (!konto) return anmeldenZeigen();
    kontoKopf(konto);
    holen();
  }).catch(fehlerZeigen);
})();
