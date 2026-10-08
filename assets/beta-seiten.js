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
    var hinweis = daten.dbStatus === "abgemeldet" ? '<p class="kb-fehler">Claudes Einschätzungen und Antwortentwürfe erscheinen, sobald du einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> angemeldet bist.</p>' : "";
    if (!daten.fehler.length) return hinweis;
    return '<p class="kb-fehler">Noch kein Zugriff auf: ' + daten.fehler.map(function (f) { return esc(f.konto.name); }).join(", ") +
      " – die Freigabe bei Microsoft kann bis zu einer Stunde dauern.</p>" + hinweis;
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

    var chip = document.querySelector("[data-kb-kontakt]");
    if (chip && !daten.fehler.some(function (f) { return f.konto.key === "kontakt"; })) {
      chip.classList.remove("db-chip--leer");
      chip.innerHTML = '<i class="' + (daten.kontaktNeu ? "an" : "") + '"></i>kontakt@ <b>' + daten.kontaktNeu + " neu</b>";
    }
    var top = daten.handlung.slice(0, 5);
    var html = "";
    html += top.length ? '<ul class="kb-liste">' + top.map(function (m) {
      return '<li class="kb-mail' + (m.isRead ? "" : " ungelesen") + '"><div class="kb-zeile">' +
        '<span class="kb-von">' + esc(B.absender(m)) + '</span><span class="kb-zeit">' + zeit(m) + "</span>" +
        '<span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span>" +
        (m.analyse ? '<span class="kb-kurz">' + esc(m.analyse.zusammenfassung) + "</span>" : "") +
        '<span class="kb-meta">' + artBadge(m) + B.badge(m.konto) + "<span>" + esc(m.grund) + "</span></span></div></li>";
    }).join("") + "</ul>" : '<p class="kb-leer">Gerade nichts offen. Alles beantwortet.</p>';
    if (daten.handlung.length > 5) html += '<p class="kb-fehler">' + (daten.handlung.length - 5) + " weitere auf der Unterseite.</p>";
    ziel().innerHTML = html + fehlerZeile() + stand();
    standVerdrahten();
  }

  function artBadge(m) {
    var a = m.vorschlag && m.vorschlag.art;
    return a ? '<span class="kb-art kb-art--' + a + '">' + esc(B.arten[a] || a) + "</span>" : "";
  }
  function artZaehler() {
    var n = {};
    daten.handlung.forEach(function (m) { n[m.vorschlag.art] = (n[m.vorschlag.art] || 0) + 1; });
    var teile = ["nobrainer", "termin", "aufgabe", "tiefer", "offen"].filter(function (a) { return n[a]; })
      .map(function (a) { return "<span><b>" + n[a] + "</b> " + esc(B.arten[a]) + "</span>"; });
    return teile.length ? '<p class="kb-zaehler">' + teile.join("") + "</p>" : "";
  }

  /* ---------- Unterseite ---------- */
  var TABS = [
    { key: "handlung", name: "Handlungsbedarf", liste: "handlung", karten: true,
      gruppen: [["nobrainer", "No-Brainer"], ["termin", "Terminvorschlag nötig"], ["aufgabe", "Aufgabe"], ["tiefer", "Tiefer reinschauen"], ["offen", "Noch nicht eingeschätzt"]] },
    { key: "claude", name: "Bei Claude", liste: "beiClaude", karten: true,
      gruppen: [["nobrainer", "No-Brainer"], ["termin", "Terminvorschlag nötig"], ["aufgabe", "Aufgabe"], ["tiefer", "Tiefer reinschauen"], ["offen", "Noch nicht eingeschätzt"], ["nachfassen", "Deine Mails – Nachfassen"], ["warten", "Deine Mails – Rückmeldung"]] },
    { key: "relevant", name: "Relevant", liste: "relevant" },
    { key: "nicht", name: "Nicht relevant", liste: "nichtRelevant" },
    { key: "warten", name: "Wartet auf Antwort", liste: "warten", gruppen: [["nachfassen", "Nachfassen"], ["warten", "Noch abwarten"]] },
    { key: "entwuerfe", name: "Entwürfe", liste: "entwuerfe", entwurfKarten: true }
  ];
  var HINWEIS = {
    nobrainer: "Antwort ist klar und vorformuliert. Freigabe gebündelt im Chat, z. B. „No-Brainer 1 bis 3 senden“.",
    termin: "Es braucht einen Termin – zusagen, absagen oder Zeit vorschlagen.",
    aufgabe: "Hier ist etwas zu erledigen, eine Antwort allein reicht nicht.",
    tiefer: "Braucht deine inhaltliche Einschätzung.",
    offen: "Von Claude noch nicht gelesen – hier steht nur der Anfang der Mail."
  };
  var ERKLAERUNG = {
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
      outlookLink(m, "kb-knopf kb-knopf--klein") + "</div>" + (zustand.tab === "warten" ? reaktionWarten(m) : zustand.tab === "relevant" || zustand.tab === "nicht" ? reaktionLesen(m) : "") + "</div></li>";
  }
  // Wartet auf Antwort: nachfassen lassen · Rückmeldung an Claude · keine Antwort nötig
  function reaktionWarten(m) {
    return '<div class="kb-entscheid kb-entscheid--warten" data-warten="' + esc(m.id) + '">' +
      '<button type="button" data-w="nachfassen">Nachfassen lassen</button><button type="button" data-w-anders>Anders …</button><button type="button" data-w="erledigt">Keine Antwort nötig</button></div>' +
      '<form class="kb-anders" data-w-form hidden><textarea rows="3" placeholder="Deine Rückmeldung – z. B. „Ich rufe ihn an“ oder „Erst nach dem 20.10. nachhaken“."></textarea>' +
      '<div><button type="submit" class="kb-knopf kb-knopf--klein">An Claude geben</button><button type="button" class="kb-anders-abbruch">Abbrechen</button></div></form>';
  }

  // Relevant / Nicht relevant: auch hier reagieren können – Antwort oder Anweisung sprechen/tippen, oder abhaken
  function reaktionLesen(m) {
    if (m.anweisung) return '<p class="kb-anweisung"><span>' + (m.anweisung.status === "umgesetzt" ? "Umgesetzt" : "Bei Claude") + "</span>" + esc(m.anweisung.text) + "</p>";
    if (m.entscheidung === "erledigt") return '<p class="kb-anweisung"><span>Abgehakt</span>Kein Handlungsbedarf.</p>';
    return '<div class="kb-entscheid kb-entscheid--warten" data-warten="' + esc(m.id) + '">' +
      '<button type="button" data-w-anders>Antworten / Anweisung …</button><button type="button" data-w="erledigt">Kein Handlungsbedarf</button></div>' +
      '<form class="kb-anders" data-w-form hidden><textarea rows="3" placeholder="Sag oder tippe, was passieren soll – z. B. „Kurz zusagen, Termin passt“ oder „An Tobias weiterleiten“. Claude legt einen Entwurf an, gesendet wird erst nach deiner Freigabe. Auf dem iPhone: Mikrofon auf der Tastatur."></textarea>' +
      '<div><button type="submit" class="kb-knopf kb-knopf--klein">An Claude geben</button><button type="button" class="kb-anders-abbruch">Abbrechen</button></div></form>';
  }

  // Bei Claude: Status auf einen Blick. Wartet (nächste Prüfung) · hängt (über 2 Std. offen) · umgesetzt
  function naechstePruefung() {
    var d = new Date(); d.setSeconds(0, 0);
    if (d.getMinutes() >= 7) d.setHours(d.getHours() + 1); d.setMinutes(7);
    if (d.getHours() > 22) { d.setDate(d.getDate() + 1); d.setHours(7); } else if (d.getHours() < 7) d.setHours(7);
    var heute = d.toDateString() === new Date().toDateString();
    return (heute ? "" : "morgen ") + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  }
  function claudeStand(m) {
    var a = m.anweisung;
    if (a && a.status === "umgesetzt") return { k: "ok", kurz: "Umgesetzt", lang: "Umgesetzt" + (a.erledigt_am ? " am " + new Date(a.erledigt_am).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr" : "") };
    var std = a && a.angelegt_am ? (Date.now() - new Date(a.angelegt_am)) / 36e5 : 0;
    if (a && std > 2) return { k: "fehler", kurz: "Hängt seit " + Math.floor(std) + " Std.", lang: "Hängt – seit " + Math.floor(std) + " Stunden nicht umgesetzt. Ich sehe mir das an." };
    if (!a) return { k: "dran", kurz: "Freigegeben – wird übergeben", lang: "Freigegeben – wird gerade als Auftrag an Claude übergeben" };
    return { k: "dran", kurz: "Wartet auf Claude · " + naechstePruefung(), lang: "Wartet auf Claude – nächste Prüfung " + naechstePruefung() + " (oder sofort mit „Jetzt prüfen“)" };
  }
  function karteClaude(m, nr) {
    var a = m.analyse, s = claudeStand(m), auf = zustand.offen[m.id], w = m.anweisung;
    var html = '<li class="kb-karte kb-karte--klein' + (auf ? " offen" : "") + '" data-id="' + esc(m.id) + '">' +
      '<button type="button" class="kb-klapp" aria-expanded="' + !!auf + '"><span class="kb-nr">' + nr + '</span><span class="kb-karte-titel"><span class="kb-von">' + esc(B.absender(m)) + '</span><span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span></span>" +
      '<span class="kb-st kb-st--' + s.k + '">' + esc(s.kurz) + '</span><span class="tl-dreieck" aria-hidden="true"></span></button>';
    if (!auf) return html + "</li>";
    html += '<div class="kb-status kb-status--' + s.k + '"><p class="kb-status-k">' + esc(s.lang) + "</p>" +
      (w ? "<p><b>Dein Auftrag:</b> " + esc(w.text) + "</p>" + (w.ergebnis ? "<p><b>Ergebnis:</b> " + esc(w.ergebnis) + "</p>" : "") : "") + "</div>";
    html += '<div class="kb-block"><p class="kb-label">' + (a ? "Worum es geht" : "Anfang der Mail") + "</p><p>" + esc(a ? a.zusammenfassung : m.bodyPreview) + "</p></div>";
    if (a && a.entwurf) html += '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(a.entwurf) + "</pre></div>";
    html += nachtrag(m) + (s.k === "ok" ? '<div class="kb-entscheid"><button type="button" data-abhaken="' + esc(m.id) + '">Passt – abhaken</button></div>' : "");
    html += '<details class="kb-orig"><summary>Originalmail</summary><pre class="v-original" data-kb-voll="' + esc(m.id) + '">' + esc(m.volltext || m.bodyPreview) + "</pre></details>";
    return html + '<div class="kb-karte-fuss">' + B.badge(m.konto) + "<span>" + esc(m.grund) + "</span><span>" + zeit(m) + "</span>" + outlookLink(m, "kb-oeffnen") + "</div></li>";
  }

  function karte(m, nr) {
    if (zustand.tab === "claude") return karteClaude(m, nr);
    var a = m.analyse, html = '<li class="kb-karte" data-id="' + esc(m.id) + '">' +
      '<div class="kb-karte-kopf"><span class="kb-nr">' + nr + '</span><div class="kb-karte-titel">' +
      '<span class="kb-von">' + esc(B.absender(m)) + '</span><span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span></div>" +
      '<span class="kb-zeit">' + zeit(m) + "</span></div>";
    html += '<div class="kb-block"><p class="kb-label">' + (a ? "Worum es geht" : "Anfang der Mail") + "</p><p>" + esc(a ? a.zusammenfassung : m.bodyPreview) + "</p></div>";
    html += '<div class="kb-block"><p class="kb-label">Vorschlag</p><p class="kb-vorschlag-text">' + esc(m.vorschlag.text) + "</p></div>";
    if (a && a.entwurf) html += '<div class="kb-entwurf"><p class="kb-label">Antwortentwurf</p><pre>' + esc(a.entwurf) + "</pre></div>";
    html += zustand.tab === "claude" ? statusBeiClaude(m) + nachtrag(m) : knoepfe(m);
    html += '<div class="kb-block"><p class="kb-label">Originalmail</p><pre class="v-original" data-kb-voll="' + esc(m.id) + '">' + esc(m.volltext || m.bodyPreview) + "</pre></div>";
    html += '<div class="kb-karte-fuss">' + B.badge(m.konto) + "<span>" + esc(m.grund) + '</span>' + outlookLink(m, "kb-oeffnen") + "</div></li>";
    return html;
  }

  // Bei Claude: nachträglich noch etwas dazu sagen (ergänzt die Anweisung, Claude setzt um)
  function nachtrag(m) {
    return '<div class="kb-entscheid" data-nachtrag="' + esc(m.id) + '"><button type="button" data-n-auf>Noch etwas dazu sagen …</button></div>' +
      '<form class="kb-anders" data-n-form hidden><textarea rows="3" placeholder="Was soll sich ändern oder dazukommen? – z. B. „Doch lieber per Sie“ oder „Termin erst nach dem 20.10. vorschlagen“. Auf dem iPhone: Mikrofon auf der Tastatur."></textarea>' +
      '<div><button type="submit" class="kb-knopf kb-knopf--klein">An Claude geben</button><button type="button" class="kb-anders-abbruch">Abbrechen</button></div></form>';
  }

  function statusBeiClaude(m) {
    var a = m.anweisung;
    if (a) return '<p class="kb-anweisung"><span>' + (a.status === "umgesetzt" ? "Umgesetzt" : "Deine Anweisung – Claude setzt um") + "</span>" + esc(a.text) + (a.ergebnis ? "<br><small>" + esc(a.ergebnis) + "</small>" : "") + "</p>";
    return '<p class="kb-anweisung"><span>Freigegeben</span>Claude setzt um.</p>';
  }
  // Drei Möglichkeiten: Freigeben (passt) · Anders … (sprechen/tippen, Claude setzt um) · Schon erledigt
  function knoepfe(m) {
    var e = B.entscheidungLesen(m), a = m.anweisung;
    var anw = a ? '<p class="kb-anweisung"><span>' + (a.status === "offen" ? "Deine Anweisung – wird umgesetzt" : a.status === "umgesetzt" ? "Umgesetzt" : "Verworfen") +
      "</span>" + esc(a.text) + (a.ergebnis ? "<br><small>" + esc(a.ergebnis) + "</small>" : "") + "</p>" : "";
    return anw + '<div class="kb-entscheid" data-entscheid="' + esc(m.id) + '">' +
      '<button type="button" data-e="freigeben" aria-pressed="' + (e === "freigeben") + '">Freigeben</button>' +
      '<button type="button" data-anders aria-expanded="false">Anders …</button>' +
      '<button type="button" data-e="erledigt" aria-pressed="' + (e === "erledigt") + '">Schon erledigt</button></div>' +
      '<form class="kb-anders" data-anders-form hidden><textarea rows="3" placeholder="Sag oder tippe, was passieren soll – z. B. „An Tobias weiterleiten, er soll den Termin übernehmen.“ Auf dem iPhone: Mikrofon auf der Tastatur."></textarea>' +
      '<div><button type="submit" class="kb-knopf kb-knopf--klein">An Claude geben</button><button type="button" class="kb-anders-abbruch">Abbrechen</button></div></form>';
  }

  function entwurfKarte(m) {
    var an = (m.toRecipients || []).map(function (e) { return e.emailAddress.name || e.emailAddress.address; }).join(", ");
    var cc = (m.ccRecipients || []).map(function (e) { return e.emailAddress.name || e.emailAddress.address; }).join(", ");
    return '<li class="kb-karte" data-id="' + esc(m.id) + '"><div class="kb-karte-kopf"><span class="kb-nr">✎</span><div class="kb-karte-titel">' +
      '<span class="kb-von">An ' + esc(an) + '</span><span class="kb-betreff">' + esc(m.subject || "(ohne Betreff)") + "</span>" +
      (cc ? '<span class="kb-zeit">Cc: ' + esc(cc) + "</span>" : "") + '</div><span class="kb-zeit">' + B.wann(m.lastModifiedDateTime) + "</span></div>" +
      '<div class="kb-block"><pre class="v-original" data-kb-voll="' + esc(m.id) + '">' + esc(m.bodyPreview) + "</pre></div>" +
      '<div class="kb-entscheid" data-senden="' + esc(m.id) + '"><button type="button" data-e="freigeben">Freigeben und senden</button>' +
      outlookLink(m, "kb-oeffnen", "In Outlook bearbeiten") + "</div>" +
      '<div class="kb-karte-fuss">' + B.badge(m.konto) + (m.hasAttachments ? "<span>mit Anhang</span>" : "") + "</div></li>";
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
    var html = "";

    html += '<div class="kb-tabs" role="tablist">' + TABS.map(function (x) {
      return '<button type="button" role="tab" class="kb-tab" data-tab="' + x.key + '" aria-selected="' + (x.key === zustand.tab) + '">' + x.name + "</button>";
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
    if (t.entwurfKarten) return '<p class="kb-gruppe-hinweis">Entwürfe aus deinen Postfächern. Senden geht nur mit deinem Klick – mit Signatur und Anhängen, so wie sie in Outlook liegen.</p>' +
      '<ol class="kb-karten">' + mails.map(entwurfKarte).join("") + "</ol>";
    if (t.key === "claude") {
      var reihe = { fehler: 0, dran: 1, ok: 2 };
      mails = mails.slice().sort(function (a, b) { return reihe[claudeStand(a).k] - reihe[claudeStand(b).k]; });
      var o = mails.filter(function (m) { return claudeStand(m).k !== "ok"; }), u = mails.filter(function (m) { return claudeStand(m).k === "ok"; }), n = 0;
      return (o.length ? '<p class="kb-gruppe">In Arbeit bei Claude</p><ol class="kb-karten">' + o.map(function (m) { return karte(m, ++n); }).join("") + "</ol>" : '<p class="kb-leer">Claude hat gerade nichts offen.</p>') +
        (u.length ? '<p class="kb-gruppe">Umgesetzt – zur Kontrolle</p><p class="kb-gruppe-hinweis">Kurz ansehen und abhaken. Nach sieben Tagen verschwinden sie von selbst.</p><ol class="kb-karten">' + u.map(function (m) { return karte(m, ++n); }).join("") + "</ol>" : "");
    }
    if (!t.gruppen) return '<ul class="kb-liste">' + mails.slice(0, 120).map(zeileSeite).join("") + "</ul>";
    return t.gruppen.map(function (g) {
      var teil = mails.filter(function (m) { return m.vorschlag && m.vorschlag.art === g[0]; });
      if (!teil.length) return "";
      var kopf = '<p class="kb-gruppe">' + g[1] + "</p>" + (t.karten && HINWEIS[g[0]] ? '<p class="kb-gruppe-hinweis">' + esc(HINWEIS[g[0]]) + "</p>" : "");
      return kopf + (t.karten ? '<ol class="kb-karten">' + teil.map(function (m, i) { return karte(m, i + 1); }).join("") + "</ol>"
                              : '<ul class="kb-liste">' + teil.map(zeileSeite).join("") + "</ul>");
    }).join("");
  }

  function alleMails() { return daten.handlung.concat(daten.beiClaude || [], daten.relevant, daten.nichtRelevant, daten.warten, daten.entwuerfe || []); }

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

  // Volltext der Karten nachladen (der Anfang steht sofort da)
  function volltexteLaden() {
    ziel().querySelectorAll("[data-kb-voll]").forEach(function (pre) {
      var m = alleMails().filter(function (x) { return x.id === pre.getAttribute("data-kb-voll"); })[0];
      if (!m) return;
      if (m.volltext) { pre.textContent = m.volltext; return; }
      B.volltext(m).then(function (t) { m.volltext = t; pre.textContent = t; }).catch(function () {});
    });
  }

  function zeilenVerdrahten() {
    volltexteLaden();
    // Bei Claude: Karten auf- und zuklappen, Umgesetztes abhaken
    ziel().querySelectorAll(".kb-klapp").forEach(function (b) {
      b.addEventListener("click", function () { var id = b.closest("[data-id]").getAttribute("data-id"); zustand.offen[id] = !zustand.offen[id]; seite(); });
    });
    ziel().querySelectorAll("[data-abhaken]").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = alleMails().filter(function (x) { return x.id === b.getAttribute("data-abhaken"); })[0], li = b.closest(".kb-karte");
        b.disabled = true;
        B.entscheiden(m, "erledigt").then(function () { daten.beiClaude = daten.beiClaude.filter(function (x) { return x !== m; }); li.classList.add("kb-erledigt"); setTimeout(function () { li.remove(); }, 900); })
          .catch(function (f) { b.disabled = false; alert("Konnte nicht gespeichert werden: " + f.message); });
      });
    });
    // Früher Freigegebenes ohne Auftrag (Freigeben war nur eine Outlook-Kategorie): jetzt nachträglich an Claude übergeben
    if (zustand.tab === "claude" && daten.dbStatus === "an") (daten.beiClaude || []).forEach(function (m) {
      if (m.anweisung || m._uebergabe || B.entscheidungLesen(m) !== "freigeben") return;
      m._uebergabe = 1; B.anweisen(m, B.freigabeText(m)).then(function () { m.anweisung.angelegt_am = new Date().toISOString(); seite(); }).catch(function () {});
    });
    ziel().querySelectorAll("[data-senden]").forEach(function (box) {
      var m = alleMails().filter(function (x) { return x.id === box.getAttribute("data-senden"); })[0];
      box.querySelector("button").addEventListener("click", function () {
        var an = (m.toRecipients || []).map(function (e) { return e.emailAddress.address; }).join(", ");
        if (!confirm("Jetzt senden an " + an + "?\n\n„" + (m.subject || "") + "“")) return;
        box.classList.add("laedt");
        B.senden(m).then(function () {
          var karte = box.closest(".kb-karte"); karte.innerHTML = '<p class="kb-gesendet">✓ Gesendet an ' + esc(an) + "</p>";
          daten.entwuerfe = daten.entwuerfe.filter(function (x) { return x.id !== m.id; });
        }).catch(function (f) { box.classList.remove("laedt"); alert("Nicht gesendet: " + f.message + (/(401|403)/.test(f.message) ? " – bitte einmal neu anmelden." : "")); });
      });
    });
    ziel().querySelectorAll("[data-nachtrag]").forEach(function (box) {
      var m = alleMails().filter(function (x) { return x.id === box.getAttribute("data-nachtrag"); })[0];
      var form = box.nextElementSibling;
      box.querySelector("[data-n-auf]").addEventListener("click", function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("textarea").focus(); });
      form.querySelector(".kb-anders-abbruch").addEventListener("click", function () { form.hidden = true; });
      form.addEventListener("submit", function (ev) {
        ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (!t) return;
        box.classList.add("laedt");
        B.anweisen(m, t).then(function () {
          m.anweisung = { text: t, status: "offen" };
          form.remove();
          box.outerHTML = '<p class="kb-anweisung"><span>Nachtrag an Claude</span>' + esc(t) + "</p>";
        }).catch(function (f) { box.classList.remove("laedt"); alert("Nicht gespeichert: " + f.message); });
      });
    });
    ziel().querySelectorAll("[data-warten]").forEach(function (box) {
      var m = alleMails().filter(function (x) { return x.id === box.getAttribute("data-warten"); })[0];
      var form = box.nextElementSibling, li = box.closest(".kb-mail");
      function weg(nachClaude) {
        // Relevant / Nicht relevant sind Übersichten: die Mail bleibt stehen und zeigt ihren Stand
        if (zustand.tab === "relevant" || zustand.tab === "nicht") {
          if (nachClaude && daten.beiClaude.indexOf(m) < 0) { m.beiClaude = true; daten.beiClaude.push(m); }
          if (!nachClaude) m.entscheidung = "erledigt";
          daten.handlung = daten.handlung.filter(function (x) { return x !== m; });
          form.hidden = true;
          box.outerHTML = '<p class="kb-anweisung"><span>' + (nachClaude ? "An Claude gegeben" : "Abgehakt") + "</span>" + (nachClaude ? "Claude legt einen Entwurf an – gesendet wird erst nach deiner Freigabe." : "Kein Handlungsbedarf.") + "</p>";
          return;
        }
        daten.warten = daten.warten.filter(function (x) { return x !== m; });
        if (nachClaude && daten.beiClaude.indexOf(m) < 0) { m.beiClaude = true; daten.beiClaude.push(m); }
        li.classList.add("kb-erledigt"); setTimeout(function () { li.remove(); }, 900);
      }
      function anweisen(text) {
        box.classList.add("laedt");
        B.anweisen(m, text).then(function () { m.anweisung = { text: text, status: "offen" }; weg(true); }).catch(function (f) { box.classList.remove("laedt"); alert("Nicht gespeichert: " + f.message); });
      }
      var nf = box.querySelector('[data-w="nachfassen"]'); if (nf) nf.addEventListener("click", function () { anweisen("Bitte eine kurze, freundliche Nachfass-Mail als Entwurf vorbereiten."); });
      box.querySelector('[data-w="erledigt"]').addEventListener("click", function () {
        box.classList.add("laedt");
        B.entscheiden(m, "erledigt").then(function () { weg(false); }).catch(function (f) { box.classList.remove("laedt"); alert("Konnte nicht gespeichert werden: " + f.message); });
      });
      box.querySelector("[data-w-anders]").addEventListener("click", function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("textarea").focus(); });
      form.querySelector(".kb-anders-abbruch").addEventListener("click", function () { form.hidden = true; });
      form.addEventListener("submit", function (ev) { ev.preventDefault(); var t = form.querySelector("textarea").value.trim(); if (t) anweisen(t); });
    });
    ziel().querySelectorAll("[data-entscheid]").forEach(function (box) {
      var m = alleMails().filter(function (x) { return x.id === box.getAttribute("data-entscheid"); })[0];
      var form = box.nextElementSibling, andersB = box.querySelector("[data-anders]");
      andersB.addEventListener("click", function () {
        var auf = form.hidden; form.hidden = !auf; andersB.setAttribute("aria-expanded", String(auf));
        if (auf) form.querySelector("textarea").focus();
      });
      form.querySelector(".kb-anders-abbruch").addEventListener("click", function () { form.hidden = true; andersB.setAttribute("aria-expanded", "false"); });
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var t = form.querySelector("textarea").value.trim();
        if (!t) return;
        form.classList.add("laedt");
        B.anweisen(m, t).then(function () {
          var p = document.createElement("p"); p.className = "kb-anweisung";
          p.innerHTML = "<span>Deine Anweisung – wird umgesetzt</span>" + esc(t);
          var alt = box.previousElementSibling; if (alt && alt.classList.contains("kb-anweisung")) alt.remove();
          box.parentNode.insertBefore(p, box); form.hidden = true; form.querySelector("textarea").value = "";
          if (zustand.tab === "handlung") {
            daten.handlung = daten.handlung.filter(function (x) { return x !== m; });
            if (daten.beiClaude.indexOf(m) < 0) daten.beiClaude.push(m);
            var karte2 = box.closest(".kb-karte"); if (karte2) { setTimeout(function () { karte2.classList.add("kb-erledigt"); setTimeout(function () { karte2.remove(); }, 900); }, 1200); }
          }
        }).catch(function (f) { alert("Nicht gespeichert: " + f.message); }).then(function () { form.classList.remove("laedt"); });
      });
      box.querySelectorAll("button[data-e]").forEach(function (b) {
        b.addEventListener("click", function () {
          box.classList.add("laedt");
          B.entscheiden(m, b.getAttribute("data-e")).then(function (e) {
            if (e === "freigeben" && !m.anweisung) return B.anweisen(m, B.freigabeText(m)).then(function () { return e; });
            return e;
          }).then(function (e) {
            box.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-e") === e)); });
            // Entschieden heißt: Rückmeldung gegeben – die Karte verlässt den Handlungsbedarf
            if ((e === "erledigt" || e === "freigeben") && zustand.tab === "handlung") {
              daten.handlung = daten.handlung.filter(function (x) { return x !== m; });
              if (e === "freigeben" && daten.beiClaude.indexOf(m) < 0) daten.beiClaude.push(m);
              var karte = box.closest(".kb-karte"); if (karte) { karte.classList.add("kb-erledigt"); setTimeout(function () { karte.remove(); }, 900); }
            }
          }).catch(function (f) { alert("Konnte nicht gespeichert werden: " + f.message); })
            .then(function () { box.classList.remove("laedt"); });
        });
      });
    });
    ziel().querySelectorAll(".kb-karte .kb-ganz").forEach(function (b) {
      b.addEventListener("click", function () {
        var li = b.closest(".kb-karte"), pre = li.querySelector("[data-kb-text]"), auf = pre.hidden;
        pre.hidden = !auf; b.setAttribute("aria-expanded", auf ? "true" : "false"); b.textContent = auf ? "Mail ausblenden" : "Ganze Mail";
        var m = alleMails().filter(function (x) { return x.id === li.getAttribute("data-id"); })[0];
        if (auf && m) {
          pre.textContent = m.volltext ? m.volltext.slice(0, 6000) : "Wird geladen …";
          if (!m.volltext) B.volltext(m).then(function (t) { m.volltext = t; pre.textContent = t.slice(0, 6000); }).catch(function () { pre.textContent = m.bodyPreview; });
        }
      });
    });
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
