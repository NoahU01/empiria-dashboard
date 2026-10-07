/* Dashboard Beta – Korrespondenz.
   Anmeldung mit dem empiria-Konto direkt im Browser (Microsoft, MSAL), danach
   liest der Browser die Postfächer über Microsoft Graph. Es wird nichts
   gespeichert oder an einen Server geschickt: die Mails existieren nur in
   diesem Browserfenster. Nur lesen – die Seite verändert keine Mails.

   Gemeinsam genutzt von dashboard-beta.html (Kachel) und
   korrespondenz-beta.html (Unterseite). */
(function () {
  "use strict";

  var CLIENT = "3016642e-2fd0-4f07-bad6-99a5bb417a87";
  var MANDANT = "8c71683a-4f6a-4634-9f18-eebfe9439a3d";
  // In Entra ist nur diese eine Adresse hinterlegt. Wer sich auf einer
  // anderen Seite anmeldet, landet kurz hier und wird von MSAL zurückgeschickt.
  var RUECKSPRUNG = location.origin + "/strategie/dashboard-beta.html";
  var SCOPES = ["User.Read", "Mail.ReadWrite", "Mail.ReadWrite.Shared", "Mail.Send", "Mail.Send.Shared"];
  var GRAPH = "https://graph.microsoft.com/v1.0";

  // Postfächer. handlung:false = wird gelesen und gezählt, landet aber nie
  // im Handlungsbedarf (kontakt@ ist ein Eingangskanal, kein Gespräch).
  var KONTEN = [
    { key: "empiria", name: "empiria", pfad: "/me", handlung: true },
    { key: "ss", name: "sofort sichtbar", adresse: "daniel.stroebel@sofortsichtbar.de", handlung: true },
    { key: "ms", name: "Müller & Ströbel", adresse: "daniel@muellerundstroebel.de", handlung: true },
    { key: "kontakt", name: "kontakt@", adresse: "kontakt@sofortsichtbar.de", handlung: false }
  ];
  KONTEN.forEach(function (k) { if (!k.pfad) k.pfad = "/users/" + k.adresse; });

  var CLAUDE_KATEGORIE = "Claude: Handlungsbedarf";
  // Einschätzung von Claude: unsichtbar an der Mail gespeichert (Outlook-Eigenschaft),
  // geschrieben von ~/AlwaysOn/outlook/korrespondenz.py. Inhalt (JSON):
  // { kategorie: nobrainer|termin|aufgabe|tiefer|keine, zusammenfassung, vorschlag, entwurf?, stand }
  var ANALYSE = "String {8d3f2a61-5c7e-4b9a-a1d2-6e0f4c8b7a19} Name ClaudeAnalyse";
  var ARTEN = {
    nobrainer: "No-Brainer", termin: "Terminvorschlag nötig", aufgabe: "Aufgabe", tiefer: "Tiefer reinschauen",
    offen: "Noch nicht eingeschätzt", nachfassen: "Nachfassen", warten: "Noch abwarten"
  };
  var TAGE_LADEN = 30;        // so weit zurück wird gelesen
  var TAGE_HANDLUNG = 14;     // ältere unbeantwortete Mails gelten als erledigt
  var TAGE_NACHFASSEN = 5;    // ab hier „Nachfassen“ bei eigenen Mails
  var AUTOMATISCH = /no-?reply|do-?not-?reply|newsletter|notification|benachrichtigung|mailer-daemon|postmaster|news@|info@.*(linkedin|xing)|@.*\.(hubspot|mailchimp|sendgrid)/i;

  var pca = null, konto = null, demo = /[?&]demo\b/.test(location.search);

  /* ---------- Anmeldung ---------- */
  function start() {
    if (demo) return Promise.resolve({ name: "Daniel Ströbel (Beispiel)", username: "beispiel" });
    if (!window.msal) return Promise.reject(new Error("Anmeldebaustein nicht geladen"));
    pca = new msal.PublicClientApplication({
      auth: { clientId: CLIENT, authority: "https://login.microsoftonline.com/" + MANDANT, redirectUri: RUECKSPRUNG },
      cache: { cacheLocation: "localStorage" }
    });
    return pca.initialize()
      .then(function () { return pca.handleRedirectPromise(); })
      .then(function (r) {
        konto = (r && r.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;
        if (konto) pca.setActiveAccount(konto);
        return konto;
      });
  }
  // Direkt zum empiria-Firmenkonto: Zur Adresse gibt es auch ein privates Microsoft-Konto,
  // das sonst (z. B. auf dem iPad) gewählt wird und dann mit AADSTS50020 scheitert.
  function anmelden() { if (pca) pca.loginRedirect({ scopes: SCOPES, domainHint: "empiria.de", loginHint: "daniel.stroebel@empiria.de" }); }
  function abmelden() { if (pca) pca.logoutRedirect({ account: konto, postLogoutRedirectUri: location.href }); }

  function token() {
    return pca.acquireTokenSilent({ scopes: SCOPES, account: konto })
      .then(function (r) { return r.accessToken; })
      .catch(function (e) {
        if (e instanceof msal.InteractionRequiredAuthError) { var f = new Error("anmelden"); f.anmelden = true; throw f; }
        throw e;
      });
  }

  function graph(pfad, kopf) {
    return token().then(function (t) {
      var h = { Authorization: "Bearer " + t };
      for (var k in kopf || {}) h[k] = kopf[k];
      return fetch(GRAPH + pfad, { headers: h });
    }).then(function (r) {
      if (!r.ok) { var e = new Error("Graph " + r.status); e.status = r.status; throw e; }
      return r.json();
    });
  }

  /* ---------- Laden ---------- */
  var FELDER_EIN = "id,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,inferenceClassification,flag,categories,conversationId,webLink,bodyPreview,importance,hasAttachments";
  var FELDER_AUS = "id,subject,toRecipients,ccRecipients,sentDateTime,conversationId,webLink,bodyPreview";

  function seit(tage) { return new Date(Date.now() - tage * 864e5).toISOString().slice(0, 19) + "Z"; }

  function ordner(k, name, feld, felder) {
    return graph(k.pfad + "/mailFolders/" + name + "/messages?$top=150&$select=" + felder +
      "&$filter=" + feld + " ge " + seit(TAGE_LADEN) + "&$orderby=" + feld + " desc" +
      (name === "inbox" ? "&$expand=singleValueExtendedProperties($filter=id eq '" + ANALYSE + "')" : ""))
      .then(function (d) { return d.value || []; });
  }

  function laden() {
    if (demo) return Promise.resolve(auswerten(DEMO()));
    var ich = graph("/me?$select=mail,displayName,proxyAddresses").catch(function () { return {}; });
    var je = KONTEN.map(function (k) {
      return Promise.all([ordner(k, "inbox", "receivedDateTime", FELDER_EIN), ordner(k, "sentitems", "sentDateTime", FELDER_AUS)])
        .then(function (r) {
          return graph(k.pfad + "/mailFolders/drafts/messages?$top=50&$orderby=lastModifiedDateTime desc&$select=id,subject,toRecipients,ccRecipients,lastModifiedDateTime,bodyPreview,hasAttachments,webLink")
            .then(function (d) { return d.value || []; }).catch(function () { return []; })
            .then(function (ent) { return { konto: k, ein: r[0], aus: r[1], entwuerfe: ent }; });
        })
        .catch(function (e) { if (e.anmelden) throw e; return { konto: k, fehler: e.status || "?" }; });
    });
    return Promise.all([ich].concat(je)).then(function (r) {
      return einschaetzungenHolen(r.slice(1)).then(function () { return r; });
    }).then(function (r) {
      var me = r[0], adressen = {};
      [me.mail].concat((me.proxyAddresses || []).map(function (a) { return a.replace(/^smtp:/i, ""); }))
        .forEach(function (a) { if (a) adressen[a.toLowerCase()] = "empiria"; });
      KONTEN.forEach(function (k) { if (k.adresse) adressen[k.adresse] = k.key; });
      return auswerten({ ich: me, adressen: adressen, postfaecher: r.slice(1) });
    });
  }

  /* ---------- Claudes Einschätzungen aus der Datenbank ----------
     Nur mit Anmeldung (Login-Link, gleich wie auf der Kontaktseite). Ohne Anmeldung
     bleibt es bei der einfachen Vorsortierung nach Stichworten. */
  var dbStatus = "aus";
  function einschaetzungenHolen(postfaecher) {
    var db = window.empiriaDb;
    if (!db) return Promise.resolve();
    var ids = [];
    postfaecher.forEach(function (p) { (p.ein || []).forEach(function (m) { if (m.internetMessageId) ids.push(m.internetMessageId); }); });
    return db.auth.getSession().then(function (s) {
      if (!s.data.session) { dbStatus = "abgemeldet"; return; }
      var teile = [];
      for (var i = 0; i < ids.length; i += 150) teile.push(ids.slice(i, i + 150));
      return Promise.all(teile.map(function (t) {
        return Promise.all([
          db.from("mail_einschaetzungen").select("internet_message_id, kategorie, zusammenfassung, vorschlag, entwurf, entwurf_art, weiterleiten_an").in("internet_message_id", t),
          db.from("mail_anweisungen").select("internet_message_id, text, status, ergebnis, angelegt_am").in("internet_message_id", t).order("angelegt_am")
        ]);
      })).then(function (res) {
        var nach = {}, anw = {};
        res.forEach(function (paar) {
          (paar[0].data || []).forEach(function (e) { nach[e.internet_message_id] = e; });
          (paar[1].data || []).forEach(function (a) { anw[a.internet_message_id] = a; });   // jeweils die neueste
        });
        postfaecher.forEach(function (p) { (p.ein || []).forEach(function (m) {
          if (nach[m.internetMessageId]) m._analyse = nach[m.internetMessageId];
          if (anw[m.internetMessageId]) m.anweisung = anw[m.internetMessageId];
        }); });
        dbStatus = "an";
      });
    }).catch(function () { dbStatus = "fehler"; });
  }

  /* ---------- Auswerten ---------- */
  function adr(e) { return ((e && e.emailAddress && e.emailAddress.address) || "").toLowerCase(); }
  function name(e) { return (e && e.emailAddress && (e.emailAddress.name || e.emailAddress.address)) || "Unbekannt"; }
  function tageAlt(d) { return Math.floor((Date.now() - new Date(d)) / 864e5); }

  function auswerten(roh) {
    var ein = [], aus = [], fehler = [], letzteAntwort = {}, letzterEingang = {}, entwuerfe = [];

    roh.postfaecher.forEach(function (p) {
      if (p.fehler) { fehler.push({ konto: p.konto, status: p.fehler }); return; }
      p.ein.forEach(function (m) { m.konto = p.konto; ein.push(m); });
      p.aus.forEach(function (m) { m.konto = p.konto; aus.push(m); });
      (p.entwuerfe || []).forEach(function (m) { m.konto = p.konto; m.entwurf = true; m.alter = tageAlt(m.lastModifiedDateTime); entwuerfe.push(m); });
    });
    // Antworten zählen postfachübergreifend: Wer aus Outlook „als“ sofort
    // sichtbar antwortet, hat die Mail oft im eigenen Gesendet-Ordner.
    aus.forEach(function (m) {
      var t = +new Date(m.sentDateTime);
      if (!letzteAntwort[m.conversationId] || t > letzteAntwort[m.conversationId]) letzteAntwort[m.conversationId] = t;
    });
    ein.forEach(function (m) {
      var t = +new Date(m.receivedDateTime);
      if (!letzterEingang[m.conversationId] || t > letzterEingang[m.conversationId].t) letzterEingang[m.conversationId] = { t: t, id: m.id };
    });

    ein.forEach(function (m) {
      var k = m.konto, eigene = k.adresse ? [k.adresse] : Object.keys(roh.adressen).filter(function (a) { return roh.adressen[a] === "empiria"; });
      m.alter = tageAlt(m.receivedDateTime);
      m.relevant = m.inferenceClassification !== "other";
      m.direkt = (m.toRecipients || []).some(function (e) { return eigene.indexOf(adr(e)) > -1; });
      m.automatisch = AUTOMATISCH.test(adr(m.from));
      m.markiert = m.flag && m.flag.flagStatus === "flagged";
      m.claude = (m.categories || []).indexOf(CLAUDE_KATEGORIE) > -1;
      m.beantwortet = (letzteAntwort[m.conversationId] || 0) > +new Date(m.receivedDateTime);
      m.neueste = letzterEingang[m.conversationId].id === m.id;
      m.analyse = analyse(m);
      // „Schon erledigt“ (z. B. per WhatsApp oder Telefon beantwortet) nimmt die Mail aus dem Handlungsbedarf
      var offen = k.handlung && m.neueste && !m.beantwortet && entscheidungLesen(m) !== "erledigt";
      if (m.analyse) m.handlung = offen && m.analyse.kategorie !== "keine" && !!ARTEN[m.analyse.kategorie];
      else m.handlung = offen && (m.claude || m.markiert || (m.relevant && m.direkt && !m.automatisch && m.alter <= TAGE_HANDLUNG));
      if (m.handlung) { m.grund = grund(m); m.vorschlag = vorschlag(m); }
    });

    // Eigene Mails ohne Rückmeldung: neueste gesendete Mail je Gespräch,
    // danach kam nichts mehr herein.
    var gesehen = {}, warten = [];
    aus.slice().sort(function (a, b) { return new Date(b.sentDateTime) - new Date(a.sentDateTime); }).forEach(function (m) {
      if (gesehen[m.conversationId] || !m.konto.handlung) return;
      gesehen[m.conversationId] = 1;
      var nachher = letzterEingang[m.conversationId] && letzterEingang[m.conversationId].t > +new Date(m.sentDateTime);
      var extern = (m.toRecipients || []).filter(function (e) { return !roh.adressen[adr(e)]; });
      m.alter = tageAlt(m.sentDateTime);
      if (!nachher && extern.length && m.alter <= 21) {
        m.vorschlag = m.alter >= TAGE_NACHFASSEN ? { art: "nachfassen", text: "Nachfassen" } : { art: "warten", text: "Noch abwarten" };
        m.grund = m.alter === 0 ? "Heute gesendet" : "Seit " + m.alter + (m.alter === 1 ? " Tag" : " Tagen") + " ohne Antwort";
        warten.push(m);
      }
    });

    var REIHE = ["nobrainer", "termin", "aufgabe", "tiefer", "offen"];
    var handlung = ein.filter(function (m) { return m.handlung; }).sort(function (a, b) {
      return REIHE.indexOf(a.vorschlag.art) - REIHE.indexOf(b.vorschlag.art) || b.alter - a.alter;
    });
    ein.sort(function (a, b) { return new Date(b.receivedDateTime) - new Date(a.receivedDateTime); });
    warten.sort(function (a, b) { return b.alter - a.alter; });

    var kontakt = ein.filter(function (m) { return m.konto.key === "kontakt"; });
    return {
      ich: roh.ich, konten: KONTEN, fehler: fehler, demo: demo, stand: new Date(), dbStatus: dbStatus,
      handlung: handlung,
      relevant: ein.filter(function (m) { return m.relevant; }),
      nichtRelevant: ein.filter(function (m) { return !m.relevant; }),
      warten: warten,
      entwuerfe: entwuerfe.filter(function (m) { return (m.toRecipients || []).length; })
        .sort(function (a, b) { return new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime); }),
      kontaktNeu: kontakt.filter(function (m) { return !m.isRead; }).length,
      kontaktWoche: kontakt.filter(function (m) { return m.alter < 7; }).length
    };
  }

  function analyse(m) {
    if (m._analyse) return m._analyse;
    var e = (m.singleValueExtendedProperties || [])[0];
    if (!e || !e.value) return null;
    try { return JSON.parse(e.value); } catch (x) { return null; }
  }

  function grund(m) {
    if (m.claude) return "Von Claude als Handlungsbedarf markiert";
    if (m.markiert) {
      var f = m.flag.dueDateTime && m.flag.dueDateTime.dateTime;
      return "Zur Nachverfolgung markiert" + (f ? " · fällig " + datum(f) : "");
    }
    if (m.alter === 0) return "Heute eingegangen, noch nicht beantwortet";
    return "Wartet seit " + m.alter + (m.alter === 1 ? " Tag" : " Tagen") + " auf deine Antwort";
  }

  // Erster, einfacher Vorschlag für den nächsten Schritt – nach Stichworten.
  // Später ersetzt der Always-on-Mac das durch eine echte Einschätzung.
  function vorschlag(m) {
    if (m.analyse) return { art: m.analyse.kategorie, text: m.analyse.vorschlag || ARTEN[m.analyse.kategorie] };
    return { art: "offen", text: stichwort(m) };
  }
  function stichwort(m) {
    var t = (m.subject + " " + m.bodyPreview).toLowerCase();
    if (m.markiert && !m.direkt) return "Nachverfolgen";
    if (/termin|uhrzeit|kalender|meeting|call\b|telefonat|treffen|verschieben|zeitfenster|wann passt/.test(t)) return "Termin klären";
    if (/angebot|rechnung|vertrag|freigabe|unterschrift|kosten|preis|budget/.test(t)) return "Prüfen und freigeben";
    if (m.markiert) return "Nachverfolgen";
    return "Antworten";
  }

  /* ---------- Entscheidung: Freigeben · Prüfen · Zurückstellen ----------
     Wird als Outlook-Kategorie an der Mail gesetzt (z. B. „Freigegeben“). Claude
     liest das und sendet freigegebene Entwürfe erst, wenn Daniel es im Chat sagt. */
  var ENTSCHEIDUNG = { freigeben: "Freigegeben", pruefen: "Prüfen", zurueck: "Zurückgestellt", erledigt: "Schon erledigt" };
  function entscheidungLesen(m) {
    for (var k in ENTSCHEIDUNG) if ((m.categories || []).indexOf(ENTSCHEIDUNG[k]) > -1) return k;
    return null;
  }
  function entscheiden(m, art) {
    var neu = (m.categories || []).filter(function (c) { for (var k in ENTSCHEIDUNG) if (c === ENTSCHEIDUNG[k]) return false; return true; });
    if (art && art !== entscheidungLesen(m)) neu.push(ENTSCHEIDUNG[art]);
    if (demo) { m.categories = neu; return Promise.resolve(entscheidungLesen(m)); }
    return token().then(function (t) {
      return fetch(GRAPH + m.konto.pfad + "/messages/" + m.id, { method: "PATCH",
        headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ categories: neu }) });
    }).then(function (r) {
      if (!r.ok) throw new Error("Graph " + r.status);
      m.categories = neu; return entscheidungLesen(m);
    });
  }

  /* ---------- Anweisung („Anders …“) an Claude ---------- */
  function anweisen(m, text) {
    var db = window.empiriaDb;
    if (demo) { m.anweisung = { text: text, status: "offen" }; return Promise.resolve(); }
    if (!db) return Promise.reject(new Error("Datenbank nicht geladen"));
    return db.from("mail_anweisungen").insert({ internet_message_id: m.internetMessageId, message_id: m.id, postfach: m.konto.name,
      betreff: m.subject, absender: m.from && m.from.emailAddress && m.from.emailAddress.address, text: text }).then(function (r) {
      if (r.error) throw new Error(r.error.message === "new row violates row-level security policy for table \"mail_anweisungen\"" ? "Bitte einmal auf der Kontaktseite anmelden." : r.error.message);
      m.anweisung = { text: text, status: "offen" };
    });
  }

  /* ---------- Entwurf senden (nur durch Daniels Klick) ---------- */
  function senden(m) {
    if (demo) return Promise.resolve();
    return token().then(function (t) {
      return fetch(GRAPH + m.konto.pfad + "/messages/" + m.id + "/send", { method: "POST", headers: { Authorization: "Bearer " + t } });
    }).then(function (r) { if (r.status !== 202 && !r.ok) throw new Error("Graph " + r.status); });
  }

  /* ---------- Volltext beim Aufklappen ---------- */
  function volltext(m) {
    if (demo) return Promise.resolve(m.bodyPreview + "\n\n(Beispieltext – im echten Betrieb steht hier die ganze Mail.)");
    return graph(m.konto.pfad + "/messages/" + m.id + "?$select=body", { Prefer: 'outlook.body-content-type="text"' })
      .then(function (d) { return ((d.body && d.body.content) || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(); });
  }

  /* ---------- Hilfen für die Darstellung ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short" }); }
  function wann(d) {
    var x = new Date(d), t = tageAlt(d);
    if (t === 0 && x.getDate() === new Date().getDate()) return x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (t < 2) return "gestern";
    if (t < 7) return x.toLocaleDateString("de-DE", { weekday: "short" });
    return datum(d);
  }
  function badge(k) { return '<span class="kb-konto kb-konto--' + k.key + '">' + esc(k.name) + "</span>"; }
  function absender(m) { return m.from ? name(m.from) : "An " + (m.toRecipients || []).map(name).join(", "); }

  /* ---------- Beispieldaten (nur mit ?demo, erfundene Namen) ---------- */
  function DEMO() {
    function h(st) { return new Date(Date.now() - st * 36e5).toISOString(); }
    function p(n, a) { return { emailAddress: { name: n, address: a } }; }
    var me = p("Daniel Ströbel", "daniel.stroebel@empiria.de"), ss = p("Daniel Ströbel", "daniel.stroebel@sofortsichtbar.de"),
        ms = p("Daniel Ströbel", "daniel@muellerundstroebel.de"), ko = p("sofort sichtbar", "kontakt@sofortsichtbar.de");
    var i = 0;
    function e(von, an, betreff, text, st, x) {
      x = x || {};
      return { id: "d" + (++i), conversationId: "c" + i, subject: betreff, bodyPreview: text, from: von, toRecipients: [an], ccRecipients: [],
        receivedDateTime: h(st), isRead: !!x.gelesen, inferenceClassification: x.sonst ? "other" : "focused",
        flag: { flagStatus: x.flag ? "flagged" : "notFlagged" }, categories: x.claude ? [CLAUDE_KATEGORIE] : [], webLink: "#", importance: "normal",
        singleValueExtendedProperties: x.a ? [{ id: ANALYSE, value: JSON.stringify(x.a) }] : [] };
    }
    var ein = [
      e(p("Anna Beispiel", "anna@beispiel-gmbh.de"), me, "Rückfrage zum Angebot Strategieworkshop", "Hallo Daniel, danke für das Angebot. Kurze Frage zu Position 3: Ist der Vorbereitungstag im Tagessatz enthalten?", 70,
        { a: { kategorie: "nobrainer", zusammenfassung: "Anna fragt zum Angebot Strategieworkshop, ob der Vorbereitungstag (Position 3) im Tagessatz enthalten ist.", vorschlag: "Kurz bestätigen: Vorbereitung ist enthalten.", entwurf: "Hallo Anna,\n\nja, der Vorbereitungstag ist im Tagessatz enthalten – da kommt nichts dazu.\n\nViele Grüße\nDaniel" } }),
      e(p("Jonas Muster", "j.muster@muster-ag.de"), me, "Termin für das Kick-off", "Hi Daniel, wann passt es dir nächste Woche für das Kick-off? Dienstag oder Donnerstag Vormittag wären bei uns frei.", 30,
        { gelesen: true, a: { kategorie: "termin", zusammenfassung: "Jonas möchte das Kick-off nächste Woche machen und bietet Dienstag oder Donnerstag Vormittag an.", vorschlag: "Einen der beiden Vormittage zusagen – laut Kalender ist Dienstag frei." } }),
      e(p("Petra Probe", "probe@verband-beispiel.de"), me, "Strategiepapier – Ihre Einschätzung", "Sehr geehrter Herr Ströbel, anbei der Entwurf. Wir würden uns über Ihre Einschätzung bis Ende der Woche freuen.", 120,
        { flag: true, a: { kategorie: "tiefer", zusammenfassung: "Der Verband schickt den Entwurf seines Strategiepapiers und bittet bis Ende der Woche um deine fachliche Einschätzung.", vorschlag: "Entwurf lesen und Kernpunkte einschätzen – ich kann dir eine Zusammenfassung des Anhangs vorbereiten." } }),
      e(p("Lea Test", "lea@test-praxis.de"), ss, "Website-Check sofort sichtbar", "Hallo, wir haben den Check gemacht und hätten gerne ein Gespräch zu den Ergebnissen.", 20),
      e(p("Max Vorlage", "max@vorlage-hr.de"), ms, "Vertrag zur Durchsicht", "Hallo Daniel, anbei der Vertrag zur Durchsicht. Bitte kurz Freigabe, dann geht er raus.", 50,
        { a: { kategorie: "aufgabe", zusammenfassung: "Max schickt den Vertrag zur Durchsicht und wartet auf deine Freigabe, bevor er rausgeht.", vorschlag: "Vertrag durchsehen und freigeben." } }),
      e(p("Kurt Kunde", "kurt@kunde.de"), me, "Kurze Frage zur Rechnung", "Moin Daniel, auf der Rechnung fehlt die Bestellnummer, kannst du die ergänzen?", 6,
        { a: { kategorie: "nobrainer", zusammenfassung: "Kurt bittet, die Bestellnummer auf der Rechnung zu ergänzen.", vorschlag: "Rechnung mit Bestellnummer neu erstellen (Papierkram) und schicken.", entwurf: "Moin Kurt,\n\nsorry, da hat die Bestellnummer gefehlt – die korrigierte Rechnung hängt an.\n\nViele Grüße\nDaniel" } }),
      e(p("Newsletter Beispiel", "newsletter@beispiel.de"), me, "Die Woche im Überblick", "Die wichtigsten Themen dieser Woche …", 10, { sonst: true }),
      e(p("LinkedIn", "notifications-noreply@linkedin.com"), me, "Sie haben 4 neue Profilaufrufe", "Sehen Sie, wer Ihr Profil besucht hat.", 15, { sonst: true }),
      e(p("Interessent Neu", "neu@interessent.de"), ko, "Anfrage über die Website", "Guten Tag, wir interessieren uns für Ihr Angebot und bitten um Rückruf.", 4),
      e(p("Interessentin Zwei", "zwei@interessent.de"), ko, "Frage zu Paketen", "Hallo, welches Paket passt für eine Praxis mit zwei Standorten?", 40, { gelesen: true })
    ];
    var aus = [{ id: "s1", conversationId: "x1", subject: "Angebot Landingpage", bodyPreview: "Hallo Herr Beispiel, wie besprochen anbei das Angebot …",
      toRecipients: [p("Herbert Beispiel", "h@beispiel.de")], ccRecipients: [], sentDateTime: h(170), webLink: "#" },
      { id: "s2", conversationId: "x2", subject: "Unterlagen für den Workshop", bodyPreview: "Liebe Frau Muster, anbei die Unterlagen …",
      toRecipients: [p("Sabine Muster", "s@muster.de")], ccRecipients: [], sentDateTime: h(40), webLink: "#" }];
    var adressen = { "daniel.stroebel@empiria.de": "empiria", "daniel.stroebel@sofortsichtbar.de": "ss", "daniel@muellerundstroebel.de": "ms", "kontakt@sofortsichtbar.de": "kontakt" };
    var nach = {};
    KONTEN.forEach(function (k) { nach[k.key] = { konto: k, ein: [], aus: [] }; });
    ein.forEach(function (m) { nach[adressen[adr(m.toRecipients[0])]].ein.push(m); });
    aus.forEach(function (m) { nach.empiria.aus.push(m); });
    return { ich: { displayName: "Daniel Ströbel" }, adressen: adressen, postfaecher: KONTEN.map(function (k) { return nach[k.key]; }) };
  }

  window.BetaMail = { senden: senden, arten: ARTEN, entscheiden: entscheiden, anweisen: anweisen, entscheidungLesen: entscheidungLesen, start: start, anmelden: anmelden, abmelden: abmelden, laden: laden, volltext: volltext,
    konten: KONTEN, esc: esc, wann: wann, badge: badge, absender: absender, istDemo: function () { return demo; } };
})();
