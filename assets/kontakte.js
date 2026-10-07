/* Kontakte – CRM. Drei Ebenen, per Adresse (#…) ansteuerbar:
   Übersicht (#personen, #firmen, #faellig, #todo, #marken, #klaeren, #vorschlaege),
   Firma (#f=ID) und Person (#k=ID, volle Breite – ohne Liste daneben).
   Anmeldung per Login-Link; lesen darf nur, wer auf der Freigabeliste steht (Datenbank-Regel),
   der Schlüssel unten ist bewusst öffentlich und allein wertlos. */
(function () {
  "use strict";
  var db = window.supabase.createClient("https://abwynhhoyhppvcecrxxa.supabase.co", "sb_publishable_P7tU5WUl5L4QuhAgzxqW3g_jTG1CxON",
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var wurzel = document.querySelector("[data-kontakte]");
  var kopfKonto = document.querySelector("[data-kb-konto]");
  var alle = [], vorschlaege = [], aufgaben = [], zustand = { tab: "personen", suche: "" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : "–"; }
  function name(k) { return [k.vorname, k.nachname].filter(Boolean).join(" "); }
  function firma(k) { return k.organisationen ? k.organisationen.name : ""; }
  function zuletzt(d) {
    if (!d) return '<span class="kt3-leise">noch kein Kontakt</span>';
    var t = Math.floor((Date.now() - new Date(d)) / 864e5);
    return t < 1 ? "heute" : t < 2 ? "gestern" : t < 60 ? "vor " + t + " Tagen" : datum(d);
  }
  function faellig(k) {
    if (k.kontaktstopp || !k.rhythmus_tage) return false;
    if (!k.letzter_kontakt) return true;
    return new Date(k.letzter_kontakt).getTime() + k.rhythmus_tage * 864e5 <= Date.now();
  }
  var EBENE = ["Vorstand", "Geschäftsführung", "Bereichsleitung", "Hauptabteilungsleitung", "Abteilungsdirektion", "Organisationsdirektion",
               "Regionaldirektion", "Regionalleitung", "Abteilungsleitung", "Gruppenleitung", "Teamleitung", "Leitung, Ebene offen", "Fach-/Expertenrolle"];
  function ebeneRang(k) { var i = EBENE.indexOf(k.entscheidungsebene); return i < 0 ? 99 : i; }
  // In Listen immer „Nachname, Vorname“ und nach Nachname sortiert (Daniel, 07.10.2026)
  function nv(k) { return [k.nachname, k.vorname].filter(Boolean).join(", "); }
  function nachNachname(a, b) { return (a.nachname || "").localeCompare(b.nachname || "", "de") || (a.vorname || "").localeCompare(b.vorname || "", "de"); }
  function lk(k) { return '<a class="kt3-p" href="#k=' + k.id + '">' + esc(nv(k)) + "</a>"; }
  function lf(o) { return o ? '<a class="kt3-f" href="#f=' + o.id + '">' + esc(o.name) + "</a>" : '<span class="kt3-leise">ohne Firma</span>'; }

  /* ---------- Anmeldung ---------- */
  function anmeldenZeigen(hinweis) {
    if (kopfKonto) kopfKonto.innerHTML = "";
    wurzel.innerHTML = '<div class="kb-hinweis kt-login"><p>' + (hinweis || "Melde dich einmal an: Du bekommst einen Login-Link an deine Mailadresse. Danach bleibst du auf diesem Gerät angemeldet.") + "</p>" +
      '<form data-login><input class="kb-suche" type="email" required value="daniel.stroebel@empiria.de" aria-label="Mailadresse"> ' +
      '<button class="kb-knopf" type="submit">Login-Link schicken</button></form></div>';
    wurzel.querySelector("[data-login]").addEventListener("submit", function (e) {
      e.preventDefault();
      var mail = e.target.querySelector("input").value.trim();
      db.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } }).then(function (r) {
        anmeldenZeigen(r.error ? "Das hat nicht geklappt: " + esc(r.error.message) : "Link ist unterwegs an <b>" + esc(mail) + "</b>. Öffne ihn auf diesem Gerät.");
      });
    });
  }

  /* ---------- Laden ---------- */
  var AUFGABEN_FELDER = "id, titel, beschreibung, faellig_am, angelegt_am, kontakt_id, organisation_id, organisationen(id, name), kontakte(id, vorname, nachname)";
  function laden() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span><span></span></div>';
    return Promise.all([
      db.from("kontakte").select("id, kontakt_nr, vorname, nachname, position, entscheidungsebene, prioritaet, beziehungsstatus, kontaktart, " +
        "rhythmus_tage, letzter_kontakt, naechster_kontakt, kontaktstopp, klaeren, organisationen(id, name, gruppe, klaeren), kontakt_marken(marke, bestaetigt)").order("nachname"),
      db.from("vorschlaege").select("id, kontakt_id, feld, wert, beleg, quelle, sicherheit").eq("status", "offen").order("sicherheit"),
      db.from("aufgaben").select(AUFGABEN_FELDER).eq("status", "offen").order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Fehler: ' + esc(r[0].error.message) + "</p></div>"; return; }
      alle = r[0].data || []; vorschlaege = r[1].data || []; aufgaben = r[2].data || [];
      if (!alle.length) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Keine Kontakte sichtbar – ist diese Mailadresse freigegeben?</p></div>'; return; }
      route();
    });
  }

  /* ---------- Navigation über die Adresse ---------- */
  function route() {
    var h = location.hash.replace("#", "");
    document.body.classList.toggle("kt3-detail", /^[kf]=\d+$/.test(h));
    if (/^k=\d+$/.test(h)) return person(+h.slice(2));
    if (/^f=\d+$/.test(h)) return firmaSeite(+h.slice(2));
    if (h && TABS.some(function (t) { return t[0] === h; })) zustand.tab = h;
    uebersicht();
  }
  window.addEventListener("hashchange", function () { if (alle.length) { route(); window.scrollTo(0, 0); } });

  /* ---------- Übersicht ---------- */
  var TABS = [["personen", "Personen"], ["firmen", "Firmen"], ["faellig", "Wieder dran"], ["todo", "To-dos"], ["marken", "Marken"], ["klaeren", "Klärfälle"], ["vorschlaege", "Vorschläge"]];
  function tabsHtml() {
    return '<nav class="kt-tabs" aria-label="Ansicht">' + TABS.filter(function (t) {
      return !(t[0] === "vorschlaege" && !vorschlaege.length) && !(t[0] === "todo" && !aufgaben.length);
    }).map(function (t) {
      return '<a href="#' + t[0] + '" aria-current="' + (zustand.tab === t[0] ? "page" : "false") + '">' + t[1] + "</a>";
    }).join("") + "</nav>";
  }
  function suchfeld(platzhalter) {
    return '<input class="kb-suche kt3-suche" type="search" placeholder="' + platzhalter + '" value="' + esc(zustand.suche) + '" data-suche>';
  }
  function treffer(k, q) { return !q || (name(k) + " " + firma(k) + " " + (k.position || "")).toLowerCase().indexOf(q) > -1; }

  function uebersicht() {
    var t = zustand.tab, html = tabsHtml(), q = zustand.suche.toLowerCase();
    if (t === "personen") html += suchfeld("Name, Firma oder Position") + personenTabelle(alle.filter(function (k) { return treffer(k, q); }).sort(nachNachname));
    if (t === "firmen") html += suchfeld("Firma suchen") + firmenTabelle();
    if (t === "faellig") html += '<p class="kt3-hinweis">Laut Rhythmus wieder dran – wichtigste zuerst.</p>' + personenTabelle(alle.filter(faellig).sort(function (a, b) {
      return (a.prioritaet || "Z").localeCompare(b.prioritaet || "Z") || new Date(a.letzter_kontakt || 0) - new Date(b.letzter_kontakt || 0); }));
    if (t === "klaeren") html += klaerHtml();
    if (t === "todo") html += todoHtml();
    if (t === "marken") html += suchfeld("Name oder Firma") + markenHtml();
    if (t === "vorschlaege") html += vorschlaegeHtml();
    wurzel.innerHTML = html;
    var s = wurzel.querySelector("[data-suche]");
    if (s) s.oninput = function () { zustand.suche = s.value; var pos = s.selectionStart; uebersicht(); var n = wurzel.querySelector("[data-suche]"); n.focus(); n.setSelectionRange(pos, pos); };
    zeilenKlickbar();
    if (t === "todo") todoVerdrahten();
    if (t === "marken") markenVerdrahten();
    if (t === "vorschlaege") vorschlaegeVerdrahten();
  }

  function personenTabelle(liste) {
    if (!liste.length) return '<p class="kb-leer">Nichts gefunden.</p>';
    return '<table class="kt3-tab kt3-tab--personen"><colgroup><col class="c-name"><col class="c-firma"><col class="c-pos"><col class="c-letzt"></colgroup>' +
      '<thead><tr><th>Name</th><th>Firma</th><th>Position</th><th>Letzter Kontakt</th></tr></thead><tbody>' +
      liste.slice(0, 300).map(function (k) {
        return '<tr data-href="#k=' + k.id + '"><td>' + lk(k) + (k.kontaktstopp ? ' <small class="kt-stopp">Stopp</small>' : "") +
          "</td><td>" + lf(k.organisationen) + '</td><td class="kt3-pos">' + esc(k.position || "") + '</td><td class="kt3-letzt">' + zuletzt(k.letzter_kontakt) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function firmenListe() {
    var je = {};
    alle.forEach(function (k) {
      if (!k.organisationen) return;
      var o = je[k.organisationen.id] = je[k.organisationen.id] || { org: k.organisationen, leute: [], letzt: null };
      o.leute.push(k);
      if (k.letzter_kontakt && (!o.letzt || k.letzter_kontakt > o.letzt)) o.letzt = k.letzter_kontakt;
    });
    return Object.keys(je).map(function (i) { return je[i]; });
  }
  function firmenTabelle() {
    var q = zustand.suche.toLowerCase();
    var liste = firmenListe().filter(function (f) { return !q || (f.org.name + " " + (f.org.gruppe || "")).toLowerCase().indexOf(q) > -1; })
      .sort(function (a, b) { return a.org.name.localeCompare(b.org.name, "de"); });
    return '<table class="kt3-tab kt3-tab--firmen"><colgroup><col class="c-firma"><col class="c-leute"><col class="c-letzt"></colgroup>' +
      '<thead><tr><th>Firma</th><th>Wichtigste Personen</th><th>Letzter Kontakt</th></tr></thead><tbody>' + liste.map(function (f) {
      var top = f.leute.slice().sort(function (a, b) { return ebeneRang(a) - ebeneRang(b) || (a.prioritaet || "Z").localeCompare(b.prioritaet || "Z"); }).slice(0, 3);
      return '<tr data-href="#f=' + f.org.id + '"><td>' + lf(f.org) + (f.org.gruppe && f.org.gruppe !== f.org.name ? '<small class="kt3-leise kt3-block">' + esc(f.org.gruppe) + "</small>" : "") +
        "</td><td>" + top.map(function (k) { return lk(k) + (k.position ? ' <span class="kt3-leise">· ' + esc(k.position) + "</span>" : ""); }).join("<br>") +
        '</td><td class="kt3-letzt">' + zuletzt(f.letzt) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function klaerHtml() {
    var p = alle.filter(function (k) { return k.klaeren; }).sort(nachNachname);
    if (!p.length) return '<p class="kb-leer">Keine Klärfälle.</p>';
    return '<table class="kt3-tab kt3-tab--klaer"><colgroup><col class="c-name"><col class="c-firma"><col class="c-text"></colgroup>' +
      '<thead><tr><th>Person</th><th>Firma</th><th>Zu klären</th></tr></thead><tbody>' + p.map(function (k) {
      return '<tr data-href="#k=' + k.id + '"><td>' + lk(k) + "</td><td>" + lf(k.organisationen) + '</td><td class="kt3-pos">' + esc(k.klaeren) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  /* ---------- Firma ---------- */
  function firmaSeite(id) {
    var leute = alle.filter(function (k) { return k.organisationen && k.organisationen.id === id; });
    var ids = leute.map(function (k) { return k.id; });
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("organisationen").select("id, name, gruppe, marktumfeld, website, klaeren").eq("id", id).single(),
      Promise.resolve({ data: [] }),
      ids.length ? db.from("kontakt_merkmale").select("kontakt_id, merkmale(kategorie, wert)").in("kontakt_id", ids) : Promise.resolve({ data: [] })
    ]).then(function (r) {
      var org = r[0].data || { name: "Firma" }, akt = einmal(r[1].data || []), merk = r[2].data || [];
      var h = '<a class="kb-zurueck" href="#firmen"><span aria-hidden="true">&larr;</span> Firmen</a>';
      h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc(org.name) + '</h2><p class="kt3-sub">' +
        esc([org.gruppe && org.gruppe !== org.name ? "gehört zu " + org.gruppe : "", org.marktumfeld].filter(Boolean).join(" · ")) +
        (org.website ? ' · <a href="' + esc(org.website) + '" target="_blank" rel="noopener">Website</a>' : "") + "</p></div></div>";
      if (org.klaeren) h += '<p class="kt3-klaer">' + esc(org.klaeren) + "</p>";
      h += '<div class="kt3-raster">';
      var ansatz = {};
      merk.forEach(function (m) { if (m.merkmale && (m.merkmale.kategorie === "Bedarf" || m.merkmale.kategorie === "Angebot")) (ansatz[m.merkmale.kategorie] = ansatz[m.merkmale.kategorie] || {})[m.merkmale.wert] = 1; });
      h += box("Ansatzpunkte", (ansatz.Bedarf ? '<p class="kt3-zeile"><span>Bedarf</span>' + esc(Object.keys(ansatz.Bedarf).join(", ")) + "</p>" : "") +
        (ansatz.Angebot ? '<p class="kt3-zeile"><span>Passt von uns</span>' + esc(Object.keys(ansatz.Angebot).join(", ")) + "</p>" : ""), "Noch keine Ansatzpunkte erfasst.");
      var td = aufgaben.filter(function (a) { return a.organisation_id === id || (a.kontakt_id && ids.indexOf(a.kontakt_id) > -1); });
      h += box("Nächste Schritte", td.length ? '<ul class="kt3-todo">' + td.map(function (a) {
          return '<li data-a="' + a.id + '"><button type="button" class="st-haken" aria-label="Erledigt"></button><span>' + esc(a.titel) + (a.kontakte ? ' <span class="kt3-leise">· ' + esc(name(a.kontakte)) + "</span>" : "") + "</span></li>"; }).join("") + "</ul>" : "",
        "Nichts offen.", '<form class="kt3-neu" data-neu-todo data-org="' + id + '"><input type="text" placeholder="Nächsten Schritt notieren …"><button type="submit">+</button></form>');
      h += '<section class="kt3-box kt3-breit" data-klapp><h3>Personen</h3><table class="kt3-tab kt3-tab--eng"><tbody>' + leute.slice().sort(nachNachname).map(function (k, i) {
        return '<tr data-href="#k=' + k.id + '"' + (i >= KURZ ? ' class="kt3-mehr" hidden' : "") + '><td>' + lk(k) + '</td><td class="kt3-pos">' + esc(k.position || "") + "</td><td>" + esc(k.beziehungsstatus || "") + "</td><td>" + zuletzt(k.letzter_kontakt) + "</td></tr>";
      }).join("") + "</tbody></table>" + klappKnopf(leute.length) + "</section>";
      var wer = {}; leute.forEach(function (k) { wer[k.id] = k; });
      wurzel.innerHTML = h + "</div>";
      zeilenKlickbar(); neuTodoVerdrahten(); todoVerdrahten();
    });
  }

  /* ---------- Person (volle Breite) ---------- */
  function person(id) {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    Promise.all([
      db.from("kontakte").select("*, organisationen(id, name, gruppe, klaeren), kontaktwege(art, wert, kontext, bevorzugt, status), kontakt_marken(marke), " +
        "kontakt_merkmale(merkmale(kategorie, wert)), kampagnen_teilnehmer(status, zuordnungsgrund, kampagnen(name, zeitraum)), " +
        "aktivitaeten(datum, kanal, richtung, anlass, inhalt, ergebnis, teilnehmer, ort, link)").eq("id", id).single(),
      db.from("aufgaben").select("id, titel, faellig_am").eq("kontakt_id", id).eq("status", "offen").order("angelegt_am")
    ]).then(function (r) {
      if (r[0].error) { wurzel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r[0].error.message) + "</p>"; return; }
      wurzel.innerHTML = personHtml(r[0].data, r[1].data || []);
      neuTodoVerdrahten(); todoVerdrahten();
    });
  }

  function personHtml(k, todos) {
    var o = k.organisationen, h = '<a class="kb-zurueck" href="#' + zustand.tab + '"><span aria-hidden="true">&larr;</span> Kontakte</a>';
    var wege = (k.kontaktwege || []).filter(function (w) { return w.status !== "veraltet" && (w.art === "E-Mail" || w.art === "Mobil" || w.art === "Telefon"); })
      .sort(function (a, b) { return b.bevorzugt - a.bevorzugt; });
    var mail = wege.filter(function (w) { return w.art === "E-Mail"; })[0], tel = wege.filter(function (w) { return w.art !== "E-Mail"; })[0];
    var ART = { direkt: "direkter Kontakt", LinkedIn: "nur LinkedIn", "Sales Navigator": "aus Sales Navigator", recherchiert: "recherchiert" };
    h += '<div class="kt3-kopf"><div><h2 class="kt3-name">' + esc([k.titel, k.vorname].filter(Boolean).join(" ")) + ' <span class="kt3-nachname">' + esc(k.nachname) + "</span></h2>" +
      '<p class="kt3-sub">' + esc(k.position || "") + (o ? (k.position ? " · " : "") + lf(o) : "") + "</p>" +
      '<p class="kt3-tags">' + [ART[k.kontaktart], k.ansprache && "per " + k.ansprache, k.prioritaet && "Priorität " + k.prioritaet,
        (k.kontakt_marken || []).map(function (m) { return m.marke; }).join(", ")].filter(Boolean).map(esc).join(" · ") +
      (k.kontaktstopp ? ' · <b class="kt-stopp">Kontaktstopp</b>' : "") + "</p></div>" +
      '<div class="kt3-erreich">' + (mail ? '<a href="mailto:' + esc(mail.wert) + '">' + esc(mail.wert) + "</a>" : "") +
      (tel ? '<a href="tel:' + esc(tel.wert.replace(/[^\d+]/g, "")) + '">' + esc(tel.wert) + "</a>" : "") +
      (k.linkedin_url ? '<a href="' + esc(k.linkedin_url) + '" target="_blank" rel="noopener">LinkedIn</a>' : "") + "</div></div>";
    var naechst = k.naechster_kontakt ? "Termin am " + datum(k.naechster_kontakt) : faellig(k) ? "<b>jetzt wieder dran</b>" :
      k.rhythmus_tage && k.letzter_kontakt ? datum(new Date(new Date(k.letzter_kontakt).getTime() + k.rhythmus_tage * 864e5)) : "–";
    h += '<p class="kt3-stand"><span>Letzter Kontakt</span>' + zuletzt(k.letzter_kontakt) + '<span>Nächster Kontakt</span>' + naechst +
      (k.beziehungsstatus ? "<span>Beziehung</span>" + esc(k.beziehungsstatus) : "") + "</p>";
    var klaer = [k.klaeren, o && o.klaeren && "Firma: " + o.klaeren].filter(Boolean);
    if (klaer.length) h += '<p class="kt3-klaer">' + klaer.map(esc).join(" · ") + "</p>";

    h += '<div class="kt3-raster">';
    var m = {}; (k.kontakt_merkmale || []).forEach(function (x) { if (x.merkmale) (m[x.merkmale.kategorie] = m[x.merkmale.kategorie] || []).push(x.merkmale.wert); });
    var kamp = (k.kampagnen_teilnehmer || []).filter(function (t) { return t.status === "freigegeben" || t.status === "vorgeschlagen"; });
    h += box("Ansatzpunkte",
      (k.kontaktbriefing ? '<p class="kt3-t">' + esc(k.kontaktbriefing) + "</p>" : "") +
      (m.Bedarf ? '<p class="kt3-zeile"><span>Bedarf</span>' + esc(m.Bedarf.join(", ")) + "</p>" : "") +
      (m.Angebot ? '<p class="kt3-zeile"><span>Passt von uns</span>' + esc(m.Angebot.join(", ")) + "</p>" : "") +
      (kamp.length ? '<p class="kt3-zeile"><span>Kampagnen</span>' + kamp.map(function (t) { return esc(t.kampagnen.name) + (t.kampagnen.zeitraum ? " (" + esc(t.kampagnen.zeitraum) + ")" : ""); }).join(", ") + "</p>" : ""),
      "Noch keine Ansatzpunkte erfasst.");
    h += box("Nächste Schritte", todos.length ? '<ul class="kt3-todo">' + todos.map(function (a) {
        return '<li data-a="' + a.id + '"><button type="button" class="st-haken" aria-label="Erledigt"></button><span>' + esc(a.titel) + "</span></li>"; }).join("") + "</ul>" : "",
      "Nichts offen.", '<form class="kt3-neu" data-neu-todo data-kontakt="' + k.id + '"><input type="text" placeholder="Nächsten Schritt notieren …"><button type="submit">+</button></form>');
    var akt = einmal((k.aktivitaeten || []).slice().sort(function (a, b) { return new Date(b.datum) - new Date(a.datum); }));
    h += box("Termine", liste(akt.filter(istTermin)), "Keine Termine erfasst.");
    h += box("Kommunikation", liste(akt.filter(function (a) { return !istTermin(a); })), "Noch nichts erfasst – einfach diktieren, z. B. „Habe heute mit " + esc(k.vorname || name(k)) + " telefoniert …“.");
    return h + "</div>";
  }

  /* ---------- Bausteine ---------- */
  function istTermin(a) { return a.kanal === "Termin" || a.kanal === "Treffen"; }
  function einmal(akt) { var s = {}; return akt.filter(function (a) { var k = a.datum + "|" + a.anlass; if (s[k]) return false; s[k] = 1; return true; }); }
  var KURZ = 5;
  function klappKnopf(n) { return n > KURZ ? '<button type="button" class="kt3-klapp" data-klapp-knopf aria-expanded="false">Alle zeigen</button>' : ""; }
  // Auf- und Zuklappen: alles hinter den ersten KURZ Einträgen
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-klapp-knopf]"); if (!b) return;
    var auf = b.getAttribute("aria-expanded") !== "true", box = b.closest(".kt3-box");
    box.querySelectorAll("[data-mehr], .kt3-mehr").forEach(function (x) { x.hidden = !auf; });
    b.setAttribute("aria-expanded", String(auf)); b.textContent = auf ? "Weniger zeigen" : "Alle zeigen";
  });
  function box(titel, inhalt, leer, fuss) {
    return '<section class="kt3-box"><h3>' + titel + "</h3>" + (inhalt || '<p class="kt3-leise">' + leer + "</p>") + (fuss || "") + "</section>";
  }
  function liste(akt, wer) {
    if (!akt.length) return "";
    var jetzt = Date.now();
    return '<ul class="kt3-v">' + akt.slice(0, 40).map(function (a, i) {
      var zuk = new Date(a.datum) > jetzt, person = wer && wer[a.kontakt_id] ? " · " + esc(name(wer[a.kontakt_id])) : "";
      var titel = esc((a.kanal === "E-Mail" ? (a.richtung === "eingehend" ? "← " : "→ ") : "") + (a.anlass || a.kanal));
      return "<li" + (i >= KURZ ? ' hidden data-mehr' : "") + (zuk ? ' class="kt3-zuk"' : "") + '><span class="kt3-d">' + (zuk ? "geplant " + new Date(a.datum).toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : datum(a.datum)) + "</span>" +
        (a.link ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener">' + titel + "</a>" : "<span>" + titel + "</span>") +
        (person || (a.kanal !== "Termin" && a.kanal !== "E-Mail") ? '<span class="kt3-leise">' + person + (a.kanal !== "Termin" && a.kanal !== "E-Mail" ? " · " + esc(a.kanal) : "") + "</span>" : "") + "</li>";
    }).join("") + "</ul>" + klappKnopf(Math.min(akt.length, 40));
  }
  function zeilenKlickbar() {
    wurzel.querySelectorAll("tr[data-href]").forEach(function (tr) {
      tr.addEventListener("click", function (e) { if (!e.target.closest("a")) location.hash = tr.getAttribute("data-href"); });
    });
  }
  function neuTodoVerdrahten() {
    wurzel.querySelectorAll("[data-neu-todo]").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = f.querySelector("input").value.trim(); if (!t) return;
        var zeile = { titel: t, bereich: "Kontakte" };
        if (f.getAttribute("data-kontakt")) zeile.kontakt_id = +f.getAttribute("data-kontakt");
        if (f.getAttribute("data-org")) zeile.organisation_id = +f.getAttribute("data-org");
        f.classList.add("laedt");
        db.from("aufgaben").insert(zeile).then(function (r) {
          if (r.error) { f.classList.remove("laedt"); alert("Nicht gespeichert: " + r.error.message); return; }
          db.from("aufgaben").select(AUFGABEN_FELDER).eq("status", "offen").order("angelegt_am").then(function (a) { aufgaben = a.data || aufgaben; route(); });
        });
      });
    });
  }

  /* ---------- To-dos ---------- */
  function todoHtml() {
    if (!aufgaben.length) return '<p class="kb-leer">Keine offenen To-dos.</p>';
    return '<ul class="kt3-todo kt3-todo--gross">' + aufgaben.map(function (a) {
      var bezug = a.kontakte ? '<a href="#k=' + a.kontakte.id + '">' + esc(name(a.kontakte)) + "</a>" : a.organisationen ? '<a href="#f=' + a.organisationen.id + '">' + esc(a.organisationen.name) + "</a>" : "";
      return '<li data-a="' + a.id + '"><button type="button" class="st-haken" aria-label="Erledigt"></button><div><b>' + esc(a.titel) + "</b>" + (bezug ? '<span class="kt3-leise kt3-block">' + bezug + "</span>" : "") + "</div></li>";
    }).join("") + "</ul>";
  }
  function todoVerdrahten() {
    wurzel.querySelectorAll("[data-a] .st-haken").forEach(function (b) {
      b.onclick = function () {
        var li = b.closest("li"), id = +li.getAttribute("data-a"); li.classList.add("st-weg");
        db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", id).then(function (r) {
          if (r.error) { li.classList.remove("st-weg"); alert("Nicht gespeichert: " + r.error.message); return; }
          aufgaben = aufgaben.filter(function (x) { return x.id !== id; }); setTimeout(function () { li.remove(); }, 400);
        });
      };
    });
  }

  /* ---------- Marken: alle Kontakte nach Firma, ein Klick setzt/entfernt ---------- */
  var MARKEN = ["empiria", "sofort sichtbar", "Müller & Ströbel", "außerhalb Versicherung"];
  function markenHtml() {
    var q = zustand.suche.toLowerCase(), zuletztF = null;
    var l = alle.filter(function (k) { return treffer(k, q); }).sort(function (a, b) {
      return (firma(a) || "~").localeCompare(firma(b) || "~", "de") || (a.nachname || "").localeCompare(b.nachname || "", "de"); });
    var h = '<table class="kt-marken"><thead><tr><th>Kontakt</th>' + MARKEN.map(function (m) { return "<th>" + esc(m) + "</th>"; }).join("") + "</tr></thead><tbody>";
    l.forEach(function (k) {
      var f = firma(k) || "ohne Firma";
      if (f !== zuletztF) { h += '<tr class="kt-marken-firma"><td colspan="5">' + esc(f) + "</td></tr>"; zuletztF = f; }
      var hat = (k.kontakt_marken || []).map(function (m) { return m.marke; });
      h += "<tr><td>" + esc(nv(k)) + "</td>" + MARKEN.map(function (m) {
        return '<td><input type="checkbox" aria-label="' + esc(m) + '" data-k="' + k.id + '" data-m="' + esc(m) + '"' + (hat.indexOf(m) > -1 ? " checked" : "") + "></td>"; }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }
  function markenVerdrahten() {
    wurzel.querySelectorAll("[data-m]").forEach(function (c) {
      c.onchange = function () {
        var kid = +c.getAttribute("data-k"), m = c.getAttribute("data-m"), k = alle.filter(function (x) { return x.id === kid; })[0];
        c.disabled = true;
        (c.checked ? db.from("kontakt_marken").upsert({ kontakt_id: kid, marke: m, bestaetigt: true })
                   : db.from("kontakt_marken").delete().eq("kontakt_id", kid).eq("marke", m)).then(function (res) {
          c.disabled = false;
          if (res.error) { c.checked = !c.checked; alert("Nicht gespeichert: " + res.error.message); return; }
          k.kontakt_marken = (k.kontakt_marken || []).filter(function (x) { return x.marke !== m; });
          if (c.checked) k.kontakt_marken.push({ marke: m, bestaetigt: true });
        });
      };
    });
  }

  /* ---------- Vorschläge aus der Suche ---------- */
  var FELD = { linkedin_url: "LinkedIn", position: "Position", firma: "Firma", email: "E-Mail", telefon: "Telefon" };
  function vorschlaegeHtml() {
    if (!vorschlaege.length) return '<p class="kb-leer">Keine offenen Vorschläge.</p>';
    var sicher = vorschlaege.some(function (v) { return v.sicherheit === "hoch"; }), nachK = {};
    vorschlaege.forEach(function (v) { (nachK[v.kontakt_id] = nachK[v.kontakt_id] || []).push(v); });
    return '<div class="kt-vs-kopf"><p>Aus der Suche – bitte kurz prüfen: stimmen Person und Firma?</p>' +
      (sicher ? '<button type="button" class="kb-knopf" data-alle-sicher>Alle sicheren übernehmen</button>' : "") + "</div>" +
      '<ul class="kt-vs">' + Object.keys(nachK).map(function (kid) {
        var k = alle.filter(function (x) { return x.id === +kid; })[0] || {};
        return '<li><p class="kt-vs-name"><b>' + esc(name(k)) + "</b> · " + esc(firma(k) || "ohne Firma") + "</p>" + nachK[kid].map(function (v) {
          var wert = v.feld === "linkedin_url" ? '<a href="' + esc(v.wert) + '" target="_blank" rel="noopener">Profil öffnen ↗</a>' : esc(v.wert);
          return '<div class="kt-vs-zeile" data-v="' + v.id + '"><span class="kt-vs-feld">' + FELD[v.feld] + '</span><span class="kt-vs-wert">' + wert +
            (v.sicherheit === "mittel" ? " <small>unsicher</small>" : "") + (v.beleg ? '<small class="kt-vs-beleg">' + esc(v.beleg) + "</small>" : "") + "</span>" +
            '<span class="kt-vs-knoepfe"><button type="button" data-ja>Übernehmen</button><button type="button" data-nein>Verwerfen</button></span></div>';
        }).join("") + "</li>";
      }).join("") + "</ul>";
  }
  function entscheiden(id, ja) {
    return db.rpc("vorschlag_entscheiden", { p_id: id, p_annehmen: ja }).then(function (r) {
      if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      vorschlaege = vorschlaege.filter(function (v) { return v.id !== id; });
    });
  }
  function vorschlaegeVerdrahten() {
    wurzel.querySelectorAll("[data-v]").forEach(function (z) {
      var id = +z.getAttribute("data-v");
      z.querySelector("[data-ja]").onclick = function () { z.classList.add("laedt"); entscheiden(id, true).then(laden); };
      z.querySelector("[data-nein]").onclick = function () { z.classList.add("laedt"); entscheiden(id, false).then(uebersicht); };
    });
    var b = wurzel.querySelector("[data-alle-sicher]");
    if (b) b.onclick = function () {
      b.disabled = true; b.textContent = "Wird übernommen …";
      vorschlaege.filter(function (v) { return v.sicherheit === "hoch"; }).reduce(function (p, v) { return p.then(function () { return entscheiden(v.id, true); }); }, Promise.resolve()).then(laden);
    };
  }

  /* ---------- Start ---------- */
  db.auth.getSession().then(function (r) {
    var s = r.data && r.data.session;
    if (!s) return anmeldenZeigen();
    if (kopfKonto) {
      kopfKonto.innerHTML = "<span>Angemeldet als " + esc(s.user.email) + '</span><button type="button">Abmelden</button>';
      kopfKonto.querySelector("button").onclick = function () { db.auth.signOut().then(function () { location.reload(); }); };
    }
    laden();
  });
  db.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_IN" && wurzel.querySelector("[data-login]")) location.replace(location.pathname); });
})();
