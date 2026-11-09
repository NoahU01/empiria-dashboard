/* sofort sichtbar · Calls – Gesprächsprotokolle hochladen und durchsuchen.

   Die Daten liegen NICHT in der empiria-Datenbank, sondern in der
   sofort-sichtbar-Datenbank (Supabase-Projekt „Datenbank“). Diese Seite spricht
   mit der Edge Function `dashboard` dort und schickt das Login-Token dieses
   Dashboards mit. Die Function prüft das Token hier beim Dashboard-Login und
   ob die E-Mail für sofort sichtbar freigegeben ist.
   Code der Gegenseite: github.com/NoahU01/sofortsichtbar-db

   Ablauf beim Hochladen: Termin aus Cal.com wählen (Kontakt kommt dann
   automatisch) – oder Kontakt suchen / neu anlegen –, Transkript und
   Zusammenfassung aus ChatGPT einfügen, Zustimmung zur Aufnahme bestätigen. */
(function () {
  "use strict";
  var API = "https://udrcjopiixhlntmnsosj.supabase.co/functions/v1/dashboard";
  var db = window.empiriaDb;
  var wurzel = document.querySelector("[data-sc]"); if (!wurzel) return;
  var konto = document.querySelector("[data-sc-konto]");

  var Z = { calls: [], suche: "", offen: null, detail: {}, form: null, termine: [], kontakte: [] };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  // Treffer kommen als ⟦…⟧ – erst alles escapen, dann markieren
  function markiert(s) { return esc(s).replace(/⟦/g, "<mark>").replace(/⟧/g, "</mark>"); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : "–"; }
  function zeit(d) { return d ? new Date(d).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
  function lokal(d) { // für <input type="datetime-local">
    var x = d ? new Date(d) : new Date(); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16);
  }
  function absaetze(t) {
    return String(t || "").split(/\n\s*\n/).map(function (a) { return a.trim() ? "<p>" + esc(a).replace(/\n/g, "<br>") + "</p>" : ""; }).join("");
  }

  function api(aktion, daten) {
    return db.auth.getSession().then(function (s) {
      var t = s.data.session && s.data.session.access_token;
      if (!t) throw Object.assign(new Error("nicht angemeldet"), { status: 401 });
      return fetch(API, {
        method: "POST",
        headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ aktion: aktion }, daten || {}))
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw Object.assign(new Error(j.fehler || "Fehler " + r.status), { status: r.status, email: j.email });
          return j;
        });
      });
    });
  }

  function hinweis(html) { wurzel.innerHTML = '<div class="kb-hinweis">' + html + "</div>"; }
  function fehlerAnzeigen(e) {
    if (e.status === 401) return hinweis('<p>Bitte einmal auf der <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">Kontaktseite</a> anmelden.</p>');
    if (e.status === 403) return hinweis("<p>Dein Login" + (e.email ? " (" + esc(e.email) + ")" : "") + " ist für sofort sichtbar noch nicht freigegeben. Noah kann das einrichten.</p>");
    hinweis("<p>Die sofort-sichtbar-Datenbank ist gerade nicht erreichbar: " + esc(e.message) + "</p>");
  }

  /* ---------- Start ---------- */
  if (!db) return hinweis("<p>Supabase konnte nicht geladen werden.</p>");
  api("ich").then(function (r) {
    if (konto) konto.textContent = r.email;
    return liste();
  }).catch(fehlerAnzeigen);

  function liste() {
    return api("calls", { suche: Z.suche }).then(function (r) { Z.calls = r; zeichnen(); });
  }

  /* ---------- Darstellung ---------- */
  function zeichnen() {
    var fokus = document.activeElement && document.activeElement.getAttribute("data-sc-suche") !== null;
    wurzel.innerHTML =
      (Z.form ? formular() : '<div class="sc-leiste"><button type="button" class="sc-haupt" data-neu>+ Protokoll hochladen</button>' +
        '<input type="search" class="sc-suche" data-sc-suche placeholder="In allen Gesprächen suchen – z. B. Bestandsübertragung" value="' + esc(Z.suche) + '"></div>') +
      (Z.form ? "" : '<p class="sc-zahl">' + (Z.suche ? Z.calls.length + " Treffer" : Z.calls.length + (Z.calls.length === 1 ? " Gespräch" : " Gespräche")) + "</p>" +
        (Z.calls.length ? '<ul class="sc-liste">' + Z.calls.map(zeile).join("") + "</ul>" :
          '<div class="kb-hinweis"><p>' + (Z.suche ? "Nichts gefunden." : "Noch keine Gespräche abgelegt.") + "</p></div>"));
    if (fokus) { var f = wurzel.querySelector("[data-sc-suche]"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  }

  function zeile(c) {
    var auf = Z.offen === c.call_id, d = Z.detail[c.call_id];
    return '<li class="sc-z' + (auf ? " sc-z--auf" : "") + '">' +
      '<button type="button" class="sc-kopf" data-auf="' + c.call_id + '" aria-expanded="' + auf + '">' +
        '<span class="sc-datum">' + datum(c.stattgefunden_am) + "</span>" +
        '<span class="sc-wer"><b>' + esc(c.titel || "Gespräch") + "</b><small>" + esc(c.name || c.email || "ohne Kontakt") + "</small>" +
          (Z.suche && c.ausschnitt ? '<small class="sc-ausschnitt">… ' + markiert(c.ausschnitt) + " …</small>" :
           c.zusammenfassung ? '<small class="sc-ausschnitt">' + esc(c.zusammenfassung) + "</small>" : "") +
        "</span>" +
      "</button>" +
      (auf ? '<div class="sc-det">' + (d ? detail(d) : '<div class="kb-laedt"><span></span><span></span></div>') + "</div>" : "") +
      "</li>";
  }

  function detail(d) {
    return '<p class="tr-meta">' + esc(zeit(d.stattgefunden_am)) + (d.email ? ' · <a href="mailto:' + esc(d.email) + '">' + esc(d.email) + "</a>" : "") +
        " · hochgeladen von " + esc(d.hochgeladen_von) + "</p>" +
      (d.zusammenfassung ? '<div class="sc-block"><span class="sc-block__titel">Zusammenfassung</span>' + absaetze(d.zusammenfassung) + "</div>" : "") +
      '<details class="sc-transkript"' + (d.zusammenfassung ? "" : " open") + "><summary>Transkript (" + d.transkript.length.toLocaleString("de-DE") + " Zeichen)</summary>" + absaetze(d.transkript) + "</details>" +
      '<div class="tr-knoepfe"><button type="button" data-bearbeiten="' + d.call_id + '">Bearbeiten</button>' +
        '<button type="button" class="sc-loeschen" data-loeschen="' + d.call_id + '">Löschen</button></div>';
  }

  /* ---------- Formular ---------- */
  function neuesFormular(vorlage) {
    Z.form = vorlage || { modus: "termin", booking_uid: "", contact_id: "", email: "", vorname: "", nachname: "", kontaktName: "",
                          stattgefunden_am: lokal(), titel: "", transkript: "", zusammenfassung: "", aufnahme_zugestimmt: false };
    zeichnen();
    if (Z.form.modus === "termin") api("termine").then(function (r) { Z.termine = r; if (Z.form) zeichnen(); }).catch(function () {});
  }

  function formular() {
    var f = Z.form;
    var wahl =
      '<div class="sc-modus" role="tablist">' +
        ["termin", "kontakt", "neu"].map(function (m) {
          return '<button type="button" role="tab" data-modus="' + m + '" aria-selected="' + (f.modus === m) + '">' +
            { termin: "Termin aus Cal.com", kontakt: "Bestehender Kontakt", neu: "Neuer Kontakt" }[m] + "</button>";
        }).join("") +
      "</div>";
    var feld = "";
    if (f.modus === "termin") {
      feld = !Z.termine.length ? '<p class="tr-meta">Keine Termine in den letzten 14 Tagen.</p>' :
        '<ul class="sc-termine">' + Z.termine.map(function (t) {
          var gew = f.booking_uid === t.booking_uid;
          return '<li><button type="button" class="sc-termin' + (gew ? " sc-termin--gew" : "") + '" data-termin="' + esc(t.booking_uid) + '"' + (t.abgesagt ? " disabled" : "") + ">" +
            '<span class="sc-termin__zeit">' + esc(zeit(t.termin_start)) + "</span>" +
            "<b>" + esc(t.name || t.email) + "</b>" +
            "<small>" + esc([t.unternehmen, t.titel].filter(Boolean).join(" · ")) + "</small>" +
            (t.abgesagt ? '<span class="tr-status tr-status--leise">abgesagt</span>' : t.call_id ? '<span class="tr-status tr-status--ok">Protokoll vorhanden</span>' : "") +
            "</button></li>";
        }).join("") + "</ul>";
    } else if (f.modus === "kontakt") {
      feld = (f.contact_id ? '<p class="sc-gewaehlt">' + esc(f.kontaktName) + ' <button type="button" data-kontakt-weg>ändern</button></p>' :
        '<input type="search" data-kontakt-suche placeholder="Name oder E-Mail" autocomplete="off">' +
        '<ul class="sc-treffer">' + Z.kontakte.map(function (k) {
          var n = [k.vorname, k.nachname].filter(Boolean).join(" ");
          return '<li><button type="button" data-kontakt="' + k.contact_id + '" data-name="' + esc(n || k.email) + '"><b>' + esc(n || k.email) + "</b> <small>" + esc(n ? k.email || "" : "") + "</small></button></li>";
        }).join("") + "</ul>");
    } else {
      feld = '<div class="sc-reihe"><label>Vorname<input data-f="vorname" value="' + esc(f.vorname) + '"></label>' +
        '<label>Nachname<input data-f="nachname" value="' + esc(f.nachname) + '"></label></div>' +
        '<label>E-Mail<input type="email" data-f="email" value="' + esc(f.email) + '" placeholder="pflicht – darüber wird der Kontakt erkannt"></label>';
    }

    return '<div class="sc-form tr-det">' +
      '<div class="sc-form__kopf"><h2>' + (f.call_id ? "Protokoll bearbeiten" : "Protokoll hochladen") + '</h2><button type="button" data-abbrechen>Abbrechen</button></div>' +
      (f.call_id ? "" : '<div class="sc-schritt"><span class="sc-schritt__titel">Mit wem?</span>' + wahl + feld + "</div>") +
      '<div class="sc-reihe"><label>Wann<input type="datetime-local" data-f="stattgefunden_am" value="' + esc(f.stattgefunden_am) + '"></label>' +
        '<label>Titel<input data-f="titel" value="' + esc(f.titel) + '" placeholder="z. B. Kennenlernen"></label></div>' +
      '<label>Transkript<small>Aus ChatGPT kopieren und einfügen – oder eine Textdatei wählen</small>' +
        '<textarea data-f="transkript" rows="10">' + esc(f.transkript) + "</textarea></label>" +
      '<label class="sc-datei"><input type="file" accept=".txt,.md,.vtt,.srt,text/plain" data-datei><span>Oder Textdatei wählen (.txt, .md)</span></label>' +
      '<label>Zusammenfassung<small>Optional – die Zusammenfassung von ChatGPT</small>' +
        '<textarea data-f="zusammenfassung" rows="5">' + esc(f.zusammenfassung) + "</textarea></label>" +
      (f.call_id ? "" : '<label class="sc-zustimmung"><input type="checkbox" data-f="aufnahme_zugestimmt"' + (f.aufnahme_zugestimmt ? " checked" : "") + "> Alle Teilnehmer haben der Aufnahme zugestimmt.</label>") +
      '<p class="kb-fehler" data-sc-fehler></p>' +
      '<div class="tr-knoepfe"><button type="button" class="tr-ja" data-speichern>Speichern</button></div>' +
      "</div>";
  }

  function fehlerImFormular(t) { var p = wurzel.querySelector("[data-sc-fehler]"); if (p) p.textContent = t; }

  function speichern() {
    var f = Z.form;
    if (!f.transkript.trim()) return fehlerImFormular("Bitte das Transkript einfügen.");
    if (!f.call_id && !f.aufnahme_zugestimmt) return fehlerImFormular("Bitte bestätigen, dass alle der Aufnahme zugestimmt haben.");
    if (!f.call_id && f.modus === "termin" && !f.booking_uid) return fehlerImFormular("Bitte einen Termin wählen.");
    if (!f.call_id && f.modus === "kontakt" && !f.contact_id) return fehlerImFormular("Bitte einen Kontakt wählen.");
    if (!f.call_id && f.modus === "neu" && f.email.indexOf("@") < 0) return fehlerImFormular("Bitte eine E-Mail-Adresse angeben.");
    var knopf = wurzel.querySelector("[data-speichern]"); knopf.disabled = true; knopf.textContent = "Speichert …";
    var call = {
      call_id: f.call_id || null,
      booking_uid: f.modus === "termin" || f.call_id ? f.booking_uid : "",
      contact_id: f.modus === "kontakt" || f.call_id ? f.contact_id : "",
      email: f.modus === "neu" ? f.email : "", vorname: f.modus === "neu" ? f.vorname : "", nachname: f.modus === "neu" ? f.nachname : "",
      stattgefunden_am: f.stattgefunden_am ? new Date(f.stattgefunden_am).toISOString() : null,
      titel: f.titel, transkript: f.transkript, zusammenfassung: f.zusammenfassung,
      aufnahme_zugestimmt: true   // beim Bearbeiten bereits bestätigt (Datenbank lässt nichts anderes zu)
    };
    api("speichern", { call: call }).then(function (id) {
      Z.form = null; Z.offen = id; delete Z.detail[id]; Z.suche = "";
      return liste().then(function () { oeffnen(id); });
    }).catch(function (e) {
      knopf.disabled = false; knopf.textContent = "Speichern";
      fehlerImFormular(e.status === 401 || e.status === 403 ? "Nicht angemeldet bzw. nicht freigegeben." : e.message);
    });
  }

  function oeffnen(id) {
    Z.offen = id; zeichnen();
    if (!Z.detail[id]) api("call", { call_id: id }).then(function (d) { Z.detail[id] = d; if (Z.offen === id) zeichnen(); }).catch(fehlerAnzeigen);
  }

  /* ---------- Bedienung ---------- */
  var suchTimer, kontaktTimer;
  wurzel.addEventListener("input", function (e) {
    var el = e.target;
    if (el.hasAttribute("data-sc-suche")) {
      clearTimeout(suchTimer);
      suchTimer = setTimeout(function () { Z.suche = el.value.trim(); Z.offen = null; liste().catch(fehlerAnzeigen); }, 300);
      return;
    }
    if (el.hasAttribute("data-kontakt-suche")) {
      clearTimeout(kontaktTimer);
      kontaktTimer = setTimeout(function () {
        api("kontakte", { suche: el.value.trim() }).then(function (r) {
          Z.kontakte = r;
          var ul = wurzel.querySelector(".sc-treffer"); if (!ul) return;
          ul.innerHTML = r.map(function (k) {
            var n = [k.vorname, k.nachname].filter(Boolean).join(" ");
            return '<li><button type="button" data-kontakt="' + k.contact_id + '" data-name="' + esc(n || k.email) + '"><b>' + esc(n || k.email) + "</b> <small>" + esc(n ? k.email || "" : "") + "</small></button></li>";
          }).join("") || '<li class="tr-meta">Kein Treffer – „Neuer Kontakt“ wählen.</li>';
        }).catch(function () {});
      }, 250);
      return;
    }
    var f = el.getAttribute("data-f");
    if (f && Z.form) Z.form[f] = el.type === "checkbox" ? el.checked : el.value;
  });
  wurzel.addEventListener("change", function (e) {
    var el = e.target;
    if (el.getAttribute("data-f") === "aufnahme_zugestimmt" && Z.form) Z.form.aufnahme_zugestimmt = el.checked;
    if (el.hasAttribute("data-datei") && el.files && el.files[0]) {
      var r = new FileReader();
      r.onload = function () { Z.form.transkript = String(r.result); var ta = wurzel.querySelector('[data-f="transkript"]'); if (ta) ta.value = Z.form.transkript; };
      r.readAsText(el.files[0]);
    }
  });
  wurzel.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-neu")) return neuesFormular();
    if (b.hasAttribute("data-abbrechen")) { Z.form = null; return zeichnen(); }
    if (b.hasAttribute("data-speichern")) return speichern();
    if (b.hasAttribute("data-modus")) {
      Z.form.modus = b.getAttribute("data-modus"); zeichnen();
      if (Z.form.modus === "kontakt" && !Z.form.contact_id) {
        var s = wurzel.querySelector("[data-kontakt-suche]"); if (s) s.focus();
        api("kontakte", { suche: "" }).then(function (r) { Z.kontakte = r; if (Z.form && Z.form.modus === "kontakt" && !Z.form.contact_id) zeichnen(); }).catch(function () {});
      }
      if (Z.form.modus === "termin" && !Z.termine.length) api("termine").then(function (r) { Z.termine = r; if (Z.form) zeichnen(); }).catch(function () {});
      return;
    }
    if (b.hasAttribute("data-termin")) {
      var t = Z.termine.filter(function (x) { return x.booking_uid === b.getAttribute("data-termin"); })[0]; if (!t) return;
      Z.form.booking_uid = t.booking_uid;
      Z.form.stattgefunden_am = lokal(t.termin_start);
      if (!Z.form.titel) Z.form.titel = [t.titel ? t.titel.split(/ (zwischen|between) /)[0] : "Gespräch", t.name].filter(Boolean).join(" – ");
      return zeichnen();
    }
    if (b.hasAttribute("data-kontakt")) { Z.form.contact_id = b.getAttribute("data-kontakt"); Z.form.kontaktName = b.getAttribute("data-name"); return zeichnen(); }
    if (b.hasAttribute("data-kontakt-weg")) { Z.form.contact_id = ""; Z.form.kontaktName = ""; return zeichnen(); }
    if (b.hasAttribute("data-auf")) {
      var id = b.getAttribute("data-auf");
      if (Z.offen === id) { Z.offen = null; return zeichnen(); }
      return oeffnen(id);
    }
    if (b.hasAttribute("data-bearbeiten")) {
      var d = Z.detail[b.getAttribute("data-bearbeiten")];
      return neuesFormular({ call_id: d.call_id, modus: "bestand", booking_uid: d.booking_uid || "", contact_id: d.contact_id || "",
        stattgefunden_am: lokal(d.stattgefunden_am), titel: d.titel || "", transkript: d.transkript, zusammenfassung: d.zusammenfassung || "",
        aufnahme_zugestimmt: true });
    }
    if (b.hasAttribute("data-loeschen")) {
      if (!confirm("Dieses Gesprächsprotokoll endgültig löschen?")) return;
      var lid = b.getAttribute("data-loeschen");
      api("loeschen", { call_id: lid }).then(function () { delete Z.detail[lid]; Z.offen = null; return liste(); }).catch(fehlerAnzeigen);
    }
  });
})();
