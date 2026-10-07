/* Korrespondenz – Varianten zur Auswahl. Alle Varianten zeigen dieselben
   erfundenen Beispielmails, nur anders angeordnet. Welche Variante gezeigt
   wird, steht im HTML: <div data-variante="a|b|c|d|e">. */
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-variante]");
  if (!wurzel) return;

  var ARTEN = { nobrainer: "No-Brainer", termin: "Terminvorschlag nötig", aufgabe: "Aufgabe", tiefer: "Tiefer reinschauen" };
  var MAILS = [
    { art: "nobrainer", von: "Anna Beispiel", konto: "empiria", wann: "vor 2 Tagen", betreff: "Rückfrage zum Angebot Strategieworkshop",
      text: "Hallo Daniel,\n\nvielen Dank für das Angebot zum Strategieworkshop, das ging ja schnell!\n\nIch habe es gestern intern vorgestellt, grundsätzlich passt alles. Eine Frage kam noch auf: Bei Position 3 steht „Vorbereitung und Abstimmung“ – ist dieser Vorbereitungstag im Tagessatz schon enthalten oder kommt er zusätzlich dazu?\n\nWenn das geklärt ist, können wir aus meiner Sicht direkt starten.\n\nViele Grüße\nAnna",
      worum: "Anna fragt, ob der Vorbereitungstag (Position 3) im Tagessatz enthalten ist.",
      vorschlag: "Bestätigen: Vorbereitung ist enthalten.",
      entwurf: "Hallo Anna,\n\nja, der Vorbereitungstag ist im Tagessatz enthalten – da kommt nichts dazu.\n\nViele Grüße\nDaniel" },
    { art: "nobrainer", von: "Kurt Kunde", konto: "empiria", wann: "heute", betreff: "Kurze Frage zur Rechnung",
      text: "Moin Daniel,\n\ndanke für die Rechnung. Unsere Buchhaltung hat sie leider zurückgegeben, weil die Bestellnummer fehlt (PO 4711-2026). Kannst du die bitte ergänzen und mir die Rechnung noch einmal schicken?\n\nDanke dir und viele Grüße\nKurt",
      worum: "Auf der Rechnung fehlt die Bestellnummer, Kurt bittet um Korrektur.",
      vorschlag: "Rechnung mit Bestellnummer neu schicken.",
      entwurf: "Moin Kurt,\n\nsorry, da hat die Bestellnummer gefehlt – die korrigierte Rechnung hängt an.\n\nViele Grüße\nDaniel" },
    { art: "nobrainer", von: "Lea Test", konto: "sofort sichtbar", wann: "gestern", betreff: "Website-Check – Gespräch?",
      text: "Hallo,\n\nwir haben über eure Seite den Website-Check für unsere Praxis gemacht. Die Ergebnisse sind spannend, ein paar Punkte verstehen wir aber noch nicht ganz.\n\nHättet ihr Zeit für ein kurzes Gespräch, in dem wir die Ergebnisse durchgehen?\n\nViele Grüße\nLea Test",
      worum: "Lea hat den Website-Check gemacht und möchte die Ergebnisse besprechen.",
      vorschlag: "Zusagen und Buchungslink schicken.",
      entwurf: "Hallo Lea,\n\nsehr gerne! Such dir hier einfach einen passenden Termin aus: [Buchungslink]\n\nViele Grüße\nDaniel" },
    { art: "termin", von: "Jonas Muster", konto: "empiria", wann: "gestern", betreff: "Termin für das Kick-off",
      text: "Hi Daniel,\n\nwie besprochen würden wir gerne nächste Woche mit dem Kick-off starten. Bei uns wären Dienstag oder Donnerstag jeweils vormittags frei.\n\nWas passt dir besser? Zwei Stunden sollten reichen.\n\nBeste Grüße\nJonas",
      worum: "Jonas bietet für das Kick-off nächste Woche Dienstag oder Donnerstag Vormittag an.",
      vorschlag: "Dienstag 10 Uhr zusagen – laut Kalender frei." },
    { art: "termin", von: "Tobias Müller", konto: "Müller & Ströbel", wann: "vor 6 Tagen", betreff: "Besuch in Stuttgart?",
      text: "Zur Info – wann besuchen wir sie in Stuttgart? 😉\n\n---\nLieber Herr Müller,\nin Baden-Baden sind wir dieses Jahr nicht vertreten. Wenn Sie einmal in Stuttgart sind, sind Sie aber herzlich willkommen. Melden Sie sich gerne auch kurzfristig.\nMit freundlichen Grüßen",
      worum: "Der Vorstand lädt euch nach Stuttgart ein, Tobias fragt, wann ihr hinfahrt.",
      vorschlag: "Tobias zwei Termine in KW 44 vorschlagen." },
    { art: "aufgabe", von: "Steuerkanzlei", konto: "empiria", wann: "vor 9 Tagen", betreff: "Rückfragen Jahresabschluss",
      text: "Hallo Daniel,\n\nzum Jahresabschluss 2025 habe ich folgende Rückfragen:\n\n1. Bitte das beigefügte Inventarverzeichnis auf Abgänge bis 31.12.2025 durchsehen.\n2. Fehlende Belege laut Liste bitte nachreichen.\n3. Kreditkartenabrechnungen Januar, Februar, Mai, Juli und Dezember 2025 bitte nachreichen.\n4. PayPal-Umsätze 2025 (Kontoauszug) bitte nachreichen.\n\nViele Grüße",
      worum: "Es fehlen Belege, fünf Kreditkartenabrechnungen und der PayPal-Auszug für 2025.",
      vorschlag: "Unterlagen nachreichen – ich bereite die Liste aus Papierkram vor." },
    { art: "tiefer", von: "Petra Probe", konto: "empiria", wann: "vor 5 Tagen", betreff: "Strategiepapier – Ihre Einschätzung",
      text: "Sehr geehrter Herr Ströbel,\n\nanbei erhalten Sie den Entwurf unseres Strategiepapiers 2027. Der Vorstand möchte das Papier in der nächsten Sitzung beschließen.\n\nWir würden uns sehr über Ihre fachliche Einschätzung freuen – gerne bis Ende dieser Woche. Besonders interessiert uns, ob die Schwerpunkte aus Ihrer Sicht richtig gesetzt sind.\n\nMit freundlichen Grüßen\nPetra Probe",
      worum: "Der Verband bittet bis Freitag um deine fachliche Einschätzung zum Strategiepapier.",
      vorschlag: "Papier lesen – ich fasse dir den Anhang auf einer Seite zusammen." }
  ];
  var REIHE = ["nobrainer", "termin", "aufgabe", "tiefer"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function art(a) { return '<span class="kb-art kb-art--' + a + '">' + ARTEN[a] + "</span>"; }
  function konto(k) {
    var key = { "empiria": "empiria", "sofort sichtbar": "ss", "Müller & Ströbel": "ms" }[k];
    return '<span class="kb-konto kb-konto--' + key + '">' + esc(k) + "</span>";
  }
  function original(m, zu) {
    var inhalt = '<pre class="v-original">' + esc(m.text) + "</pre>";
    return zu ? '<details class="v-ganz"><summary>Ganze Mail</summary>' + inhalt + "</details>"
              : '<div class="kb-block"><p class="kb-label">Originalmail</p>' + inhalt + "</div>";
  }
  function gruppen(fn) {
    return REIHE.map(function (a) {
      var teil = MAILS.filter(function (m) { return m.art === a; });
      return teil.length ? fn(a, teil) : "";
    }).join("");
  }
  function zaehler() {
    return '<p class="kb-zaehler">' + REIHE.map(function (a) {
      return "<span><b>" + MAILS.filter(function (m) { return m.art === a; }).length + "</b> " + ARTEN[a] + "</span>";
    }).join("") + "</p>";
  }

  /* A – Karten: alles offen untereinander */
  function a() {
    return zaehler() + gruppen(function (g, teil) {
      return '<p class="kb-gruppe">' + ARTEN[g] + " · " + teil.length + '</p><ol class="kb-karten">' + teil.map(function (m, i) {
        return '<li class="kb-karte"><div class="kb-karte-kopf"><span class="kb-nr">' + (i + 1) + '</span><div class="kb-karte-titel"><span class="kb-von">' +
          esc(m.von) + '</span><span class="kb-betreff">' + esc(m.betreff) + '</span></div><span class="kb-zeit">' + m.wann + "</span></div>" +
          '<div class="kb-block"><p class="kb-label">Worum es geht</p><p>' + esc(m.worum) + "</p></div>" +
          original(m) +
          '<div class="kb-block"><p class="kb-label">Vorschlag</p><p class="kb-vorschlag-text">' + esc(m.vorschlag) + "</p></div>" +
          (m.entwurf ? '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(m.entwurf) + "</pre></div>" : "") +
          '<div class="kb-karte-fuss">' + konto(m.konto) + "</div></li>";
      }).join("") + "</ol>";
    });
  }

  /* B – Kompakte Liste: eine Zeile je Mail, Entwurf klein darunter */
  function b() {
    return zaehler() + gruppen(function (g, teil) {
      return '<p class="kb-gruppe">' + ARTEN[g] + " · " + teil.length + '</p><div class="vb-liste">' + teil.map(function (m, i) {
        return '<div class="vb-zeile"><span class="kb-nr">' + (i + 1) + '</span><div class="vb-wer"><b>' + esc(m.von) + "</b><small>" + esc(m.betreff) + "</small>" + konto(m.konto) + "</div>" +
          '<div class="vb-worum">' + esc(m.worum) + original(m, true) + '</div><div class="vb-tun">→ ' + esc(m.vorschlag) +
          (m.entwurf ? '<details class="vb-entwurf"><summary>Entwurf ansehen</summary><pre>' + esc(m.entwurf) + "</pre></details>" : "") + "</div></div>";
      }).join("") + "</div>";
    });
  }

  /* C – Entscheidungs-Sprint: eine Mail nach der anderen, groß */
  function c() {
    var reihe = REIHE.reduce(function (l, a) { return l.concat(MAILS.filter(function (m) { return m.art === a; })); }, []);
    var i = 0;
    function zeichnen() {
      if (i >= reihe.length) {
        wurzel.innerHTML = '<div class="vc-fertig"><h2 class="h-serif">Durch. <span class="hl">' + reihe.length + " Mails</span> entschieden.</h2>" +
          '<button class="kb-knopf" type="button" data-neu>Noch einmal</button></div>';
        wurzel.querySelector("[data-neu]").onclick = function () { i = 0; zeichnen(); };
        return;
      }
      var m = reihe[i];
      wurzel.innerHTML = '<div class="vc-fortschritt"><span style="width:' + (i / reihe.length * 100) + '%"></span></div>' +
        '<p class="vc-stand">' + (i + 1) + " von " + reihe.length + " · " + art(m.art) + "</p>" +
        '<article class="vc-karte"><p class="kb-zeit">' + esc(m.von) + " · " + m.wann + " · " + esc(m.konto) + '</p><h2 class="h-serif">' + esc(m.betreff) + "</h2>" +
        '<p class="vc-worum">' + esc(m.worum) + "</p>" + original(m) + '<p class="kb-label" style="margin-top:16px">Mein Vorschlag</p><p class="vc-vorschlag">' + esc(m.vorschlag) + "</p>" +
        (m.entwurf ? '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(m.entwurf) + "</pre></div>" : "") + "</article>" +
        '<div class="vc-knoepfe"><button type="button" class="kb-knopf vc-ja" data-weiter>' + (m.entwurf ? "Freigeben" : "Erledigt") + '</button>' +
        '<button type="button" class="vc-neben" data-weiter>Ändern</button><button type="button" class="vc-neben" data-weiter>Später</button></div>' +
        '<p class="kb-gruppe-hinweis">Oder per Sprache: „freigeben“, „ändern: …“, „später“.</p>';
      wurzel.querySelectorAll("[data-weiter]").forEach(function (k) { k.onclick = function () { i++; zeichnen(); }; });
    }
    setTimeout(zeichnen);
    return "";
  }

  /* D – Briefing: wie ein kurzes Memo zum Lesen */
  function d() {
    var n = 0;
    return '<div class="vd-memo"><p class="vd-anrede">Guten Morgen, Daniel. <b>' + MAILS.length + " Mails</b> brauchen dich – davon " +
      MAILS.filter(function (m) { return m.art === "nobrainer"; }).length + " sofort freigebbar.</p>" +
      gruppen(function (g, teil) {
        return '<h3 class="vd-titel">' + ARTEN[g] + "</h3><ol>" + teil.map(function (m) {
          n++;
          return "<li><p><b>" + esc(m.von) + "</b> – " + esc(m.worum) + ' <span class="vd-tun">Vorschlag: ' + esc(m.vorschlag) + "</span></p>" + original(m, true) +
            (m.entwurf ? '<details class="vb-entwurf"><summary>Entwurf</summary><pre>' + esc(m.entwurf) + "</pre></details>" : "") + "</li>";
        }).join("") + "</ol>";
      }) + '<p class="vd-schluss">Zum Freigeben einfach sagen: „No-Brainer 1 bis 3 senden.“</p></div>';
  }

  /* E – Liste links, Einschätzung rechts (wie Outlook) */
  function e() {
    var liste = REIHE.reduce(function (l, a) { return l.concat(MAILS.filter(function (m) { return m.art === a; })); }, []);
    function detail(m) {
      return '<p class="kb-zeit">' + esc(m.von) + " · " + m.wann + "</p><h2 class=\"h-serif ve-titel\">" + esc(m.betreff) + "</h2>" + art(m.art) + " " + konto(m.konto) +
        '<div class="kb-block"><p class="kb-label">Worum es geht</p><p>' + esc(m.worum) + "</p></div>" + original(m) +
        '<div class="kb-block"><p class="kb-label">Vorschlag</p><p class="kb-vorschlag-text">' + esc(m.vorschlag) + "</p></div>" +
        (m.entwurf ? '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(m.entwurf) + "</pre></div>" : "");
    }
    setTimeout(function () {
      var knoepfe = wurzel.querySelectorAll(".ve-eintrag"), rechts = wurzel.querySelector(".ve-detail");
      knoepfe.forEach(function (k, i) {
        k.onclick = function () {
          knoepfe.forEach(function (x) { x.classList.remove("aktiv"); }); k.classList.add("aktiv");
          rechts.innerHTML = detail(liste[i]);
          if (window.innerWidth < 900) rechts.scrollIntoView({ behavior: "smooth" });
        };
      });
    });
    return '<div class="ve"><div class="ve-liste">' + liste.map(function (m, i) {
      return '<button type="button" class="ve-eintrag' + (i ? "" : " aktiv") + '"><span class="kb-von">' + esc(m.von) + '</span><span class="kb-zeit">' + m.wann + "</span>" +
        '<span class="kb-betreff">' + esc(m.betreff) + '</span><span class="kb-meta">' + art(m.art) + "</span></button>";
    }).join("") + '</div><div class="ve-detail">' + detail(liste[0]) + "</div></div>";
  }

  wurzel.innerHTML = { a: a, b: b, c: c, d: d, e: e }[wurzel.getAttribute("data-variante")]();
})();
