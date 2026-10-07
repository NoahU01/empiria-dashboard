/* Kontakte – liest die Kontaktdatenbank (Supabase „dashboard empiria“).
   Anmeldung per Login-Link an die eigene Mailadresse. Gelesen werden kann nur,
   wer auf der Freigabeliste steht (Datenbank-Regel), der Schlüssel unten ist
   bewusst öffentlich und allein wertlos. */
(function () {
  "use strict";
  var URL_ = "https://abwynhhoyhppvcecrxxa.supabase.co";
  var SCHLUESSEL = "sb_publishable_P7tU5WUl5L4QuhAgzxqW3g_jTG1CxON";
  var db = window.supabase.createClient(URL_, SCHLUESSEL, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var wurzel = document.querySelector("[data-kontakte]");
  var kopfKonto = document.querySelector("[data-kb-konto]");
  var alle = [], vorschlaege = [], zustand = { tab: "alle", suche: "", gewaehlt: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function datum(d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }) : "–"; }
  function name(k) { return [k.vorname, k.nachname].filter(Boolean).join(" "); }

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
  function laden() {
    wurzel.innerHTML = '<div class="kb-laedt"><span></span><span></span><span></span></div>';
    db.from("kontakte").select("id, kontakt_nr, anrede, vorname, nachname, position, ansprache, prioritaet, beziehungsstatus, beziehungsnaehe, " +
      "kontaktfrequenz, rhythmus_tage, letzter_kontakt, naechster_kontakt, profiltiefe, kontaktstopp, klaeren, linkedin_url, " +
      "organisationen(name, gruppe, klaeren), kontakt_marken(marke, bestaetigt), kampagnen_teilnehmer(status, kampagnen(name))")
      .order("nachname").then(function (r) {
        if (r.error) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Fehler: ' + esc(r.error.message) + "</p></div>"; return; }
        alle = r.data;
        return db.from("vorschlaege").select("id, kontakt_id, feld, wert, beleg, quelle, sicherheit").eq("status", "offen").order("sicherheit").then(function (v) {
          vorschlaege = v.data || [];
        if (!alle.length) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Keine Kontakte sichtbar – ist diese Mailadresse freigegeben?</p></div>'; return; }
        zeichnen();
        });
      });
  }

  function faellig(k) {
    if (k.kontaktstopp || !k.rhythmus_tage) return false;
    if (!k.letzter_kontakt) return true;
    return new Date(k.letzter_kontakt).getTime() + k.rhythmus_tage * 864e5 <= Date.now();
  }
  function klaerfall(k) { return !!(k.klaeren || (k.organisationen && k.organisationen.klaeren)); }
  function markeOffen(k) { return (k.kontakt_marken || []).some(function (m) { return !m.bestaetigt; }); }

  var TABS = [
    ["alle", "Alle", function () { return true; }],
    ["klaeren", "Klärfälle", klaerfall],
    ["faellig", "Wieder dran", faellig],
    ["a", "Priorität A", function (k) { return k.prioritaet === "A"; }],
    ["vorschlaege", "Vorschläge", function (k) { return vorschlaege.some(function (v) { return v.kontakt_id === k.id; }); }]
  ];

  function gefiltert() {
    var t = TABS.filter(function (x) { return x[0] === zustand.tab; })[0], q = zustand.suche.toLowerCase();
    return alle.filter(function (k) {
      if (!t[2](k)) return false;
      if (!q) return true;
      return (name(k) + " " + (k.organisationen ? k.organisationen.name : "") + " " + (k.position || "")).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ---------- Darstellung ---------- */
  var FELD = { linkedin_url: "LinkedIn", position: "Position", firma: "Firma", email: "E-Mail", telefon: "Telefon" };
  function vorschlaegeHtml() {
    if (!vorschlaege.length) return '<p class="kb-leer">Keine offenen Vorschläge.</p>';
    var sicher = vorschlaege.filter(function (v) { return v.sicherheit === "hoch"; }).length;
    var nachK = {};
    vorschlaege.forEach(function (v) { (nachK[v.kontakt_id] = nachK[v.kontakt_id] || []).push(v); });
    return '<div class="kt-vs-kopf"><p>' + vorschlaege.length + " offene Vorschläge aus der Suche. Bitte kurz prüfen – stimmt Person und Firma?</p>" +
      (sicher ? '<button type="button" class="kb-knopf" data-alle-sicher>Alle ' + sicher + " sicheren übernehmen</button>" : "") + "</div>" +
      '<ul class="kt-vs">' + Object.keys(nachK).map(function (kid) {
        var k = alle.filter(function (x) { return x.id === +kid; })[0] || {};
        return '<li><p class="kt-vs-name"><b>' + esc(name(k)) + "</b> · " + esc(k.organisationen ? k.organisationen.name : "ohne Firma") + "</p>" +
          nachK[kid].map(function (v) {
            var wert = v.feld === "linkedin_url" ? '<a href="' + esc(v.wert) + '" target="_blank" rel="noopener">' + esc(v.wert.replace(/^https:\/\/www\.linkedin\.com\/in\//, "").replace(/\/$/, "")) + " ↗</a>" : esc(v.wert);
            return '<div class="kt-vs-zeile" data-v="' + v.id + '"><span class="kt-vs-feld">' + FELD[v.feld] + '</span><span class="kt-vs-wert">' + wert +
              (v.sicherheit === "mittel" ? ' <small>unsicher</small>' : "") + (v.beleg ? '<small class="kt-vs-beleg">' + esc(v.beleg) + "</small>" : "") + "</span>" +
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

  function zeichnen() {
    if (zustand.tab === "vorschlaege") {
      wurzel.innerHTML = tabsHtml() + vorschlaegeHtml();
      tabsVerdrahten();
      wurzel.querySelectorAll("[data-v]").forEach(function (z) {
        var id = +z.getAttribute("data-v");
        z.querySelector("[data-ja]").onclick = function () { z.classList.add("laedt"); entscheiden(id, true).then(function () { laden(); }); };
        z.querySelector("[data-nein]").onclick = function () { z.classList.add("laedt"); entscheiden(id, false).then(zeichnen); };
      });
      var alleB = wurzel.querySelector("[data-alle-sicher]");
      if (alleB) alleB.onclick = function () {
        alleB.disabled = true; alleB.textContent = "Wird übernommen …";
        vorschlaege.filter(function (v) { return v.sicherheit === "hoch"; }).reduce(function (p, v) { return p.then(function () { return entscheiden(v.id, true); }); }, Promise.resolve()).then(laden);
      };
      return;
    }
    var liste = gefiltert();
    var html = tabsHtml() + '<input class="kb-suche kt-suche" type="search" placeholder="Name, Firma, Position" value="' + esc(zustand.suche) + '" data-suche>';
    html += '<div class="ve"><div class="ve-liste kt-liste">' + (liste.length ? liste.map(function (k) {
      return '<button type="button" class="ve-eintrag' + (zustand.gewaehlt === k.id ? " aktiv" : "") + '" data-id="' + k.id + '"><span class="ve-name">' + esc(name(k)) +
        (klaerfall(k) ? ' <i class="kt-punkt" title="Klärfall"></i>' : "") + '</span><span class="ve-zeit">' + esc(k.prioritaet || "") + '</span><span class="ve-betreff">' +
        esc(k.organisationen ? k.organisationen.name : "ohne Firma") + "</span></button>";
    }).join("") : '<p class="kb-leer">Nichts gefunden.</p>') + '</div><div class="ve-detail" data-detail><p class="kb-leer">Links einen Kontakt wählen.</p></div></div>';
    wurzel.innerHTML = html;
    tabsVerdrahten();
    var s = wurzel.querySelector("[data-suche]");
    s.oninput = function () { zustand.suche = s.value; var pos = s.selectionStart; zeichnen(); var n = wurzel.querySelector("[data-suche]"); n.focus(); n.setSelectionRange(pos, pos); };
    wurzel.querySelectorAll(".ve-eintrag").forEach(function (b) {
      b.onclick = function () {
        zustand.gewaehlt = +b.getAttribute("data-id");
        wurzel.querySelectorAll(".ve-eintrag").forEach(function (x) { x.classList.toggle("aktiv", x === b); });
        detail(zustand.gewaehlt);
      };
    });
    if (zustand.gewaehlt) detail(zustand.gewaehlt);
  }

  function tabsHtml() {
    return '<div class="kt-tabs">' + TABS.map(function (t) {
      var n = t[0] === "vorschlaege" ? vorschlaege.length : alle.filter(t[2]).length;
      if (t[0] === "vorschlaege" && !n && zustand.tab !== t[0]) return "";
      return '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + (zustand.tab === t[0]) + '">' + t[1] + " <span>" + n + "</span></button>";
    }).join("") + "</div>";
  }
  function tabsVerdrahten() {
    wurzel.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { zustand.tab = b.getAttribute("data-tab"); zeichnen(); }; });
  }

  function detail(id) {
    var ziel = wurzel.querySelector("[data-detail]");
    ziel.innerHTML = '<div class="kb-laedt"><span></span><span></span></div>';
    if (window.innerWidth < 900) ziel.scrollIntoView({ behavior: "smooth" });
    db.from("kontakte").select("*, organisationen(name, gruppe, marktumfeld, klaeren), kontaktwege(art, wert, kontext, bevorzugt, status), " +
      "anschriften(typ, strasse, plz, ort, status), kontakt_marken(marke, rolle, bestaetigt), kontakt_merkmale(herkunft, merkmale(kategorie, wert)), " +
      "kampagnen_teilnehmer(status, zuordnungsgrund, individueller_ansatz, kampagnen(name, zeitraum)), notizen(art, text, datum, quelle), " +
      "aktivitaeten(datum, kanal, richtung, anlass, inhalt, ergebnis)").eq("id", id).single().then(function (r) {
      if (r.error) { ziel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r.error.message) + "</p>"; return; }
      ziel.innerHTML = detailHtml(r.data);
    });
  }

  function zeile(label, wert) { return wert ? '<div class="kt-feld"><span>' + label + "</span><b>" + wert + "</b></div>" : ""; }

  function detailHtml(k) {
    var o = k.organisationen || {}, h = "";
    h += '<p class="ve-meta">' + esc(k.kontakt_nr) + " · Profil: " + esc(k.profiltiefe) + (k.kontaktstopp ? ' · <b class="kt-stopp">Kontaktstopp</b>' : "") + "</p>";
    h += '<h2 class="h-serif ve-titel">' + esc([k.anrede, k.titel, name(k)].filter(Boolean).join(" ")) + "</h2>";
    h += '<p class="ve-von">' + esc(k.position || "") + (o.name ? " · " + esc(o.name) : "") + "</p>";
    var klaer = [k.klaeren, o.klaeren && "Firma: " + o.klaeren].filter(Boolean);
    if (klaer.length) h += '<div class="kt-klaeren"><p class="kb-label">Zu klären</p>' + klaer.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") + "</div>";
    h += '<div class="kt-felder">' +
      zeile("Ansprache", esc(k.ansprache)) + zeile("Priorität", esc(k.prioritaet)) + zeile("Beziehung", esc(k.beziehungsstatus)) +
      zeile("Nähe", esc(k.beziehungsnaehe)) + zeile("Rhythmus", k.rhythmus_tage ? esc(k.kontaktfrequenz) + " (" + k.rhythmus_tage + " Tage)" : "") +
      zeile("Letzter Kontakt", datum(k.letzter_kontakt)) + zeile("Einfluss", esc(k.einflussrolle)) + zeile("Ebene", esc(k.entscheidungsebene)) +
      zeile("Marke", (k.kontakt_marken || []).map(function (m) { return esc(m.marke) + (m.bestaetigt ? "" : " (noch prüfen)"); }).join(", ")) + "</div>";
    if (k.kontaktbriefing) h += '<div class="kb-block"><p class="kb-label">Kontaktbriefing</p><p>' + esc(k.kontaktbriefing) + "</p></div>";
    if (k.kontaktziel) h += '<div class="kb-block"><p class="kb-label">Kontaktziel</p><p>' + esc(k.kontaktziel) + "</p></div>";
    var wege = (k.kontaktwege || []).slice().sort(function (a, b) { return b.bevorzugt - a.bevorzugt; });
    if (wege.length || k.linkedin_url) {
      h += '<div class="kb-block"><p class="kb-label">Erreichbar</p><ul class="kt-wege">' + wege.map(function (w) {
        var link = w.art === "E-Mail" ? "mailto:" + w.wert : w.art === "Web" ? (/^http/.test(w.wert) ? w.wert : "https://" + w.wert) : "tel:" + w.wert.replace(/[^\d+]/g, "");
        return '<li class="' + (w.status === "veraltet" ? "alt" : "") + '"><span>' + esc(w.art) + (w.kontext === "privat" ? " privat" : "") + '</span><a href="' + esc(link) + '">' + esc(w.wert) + "</a>" +
          (w.status !== "geprüft" ? "<small>" + esc(w.status) + "</small>" : "") + "</li>";
      }).join("") + (k.linkedin_url ? '<li><span>LinkedIn</span><a href="' + esc(k.linkedin_url) + '" target="_blank" rel="noopener">Profil öffnen</a></li>' : "") + "</ul></div>";
    }
    var merk = {};
    (k.kontakt_merkmale || []).forEach(function (m) { if (m.merkmale) (merk[m.merkmale.kategorie] = merk[m.merkmale.kategorie] || []).push(m.merkmale.wert); });
    if (Object.keys(merk).length) h += '<div class="kb-block"><p class="kb-label">Merkmale</p>' + Object.keys(merk).map(function (kat) {
      return '<p class="kt-merk"><span>' + esc(kat) + "</span>" + esc(merk[kat].join(", ")) + "</p>"; }).join("") + "</div>";
    if ((k.kampagnen_teilnehmer || []).length) h += '<div class="kb-block"><p class="kb-label">Kampagnen</p>' + k.kampagnen_teilnehmer.map(function (t) {
      return '<p class="kt-merk"><span>' + esc(t.kampagnen.name) + "</span>" + esc(t.status) + (t.zuordnungsgrund ? " – " + esc(t.zuordnungsgrund) : "") + "</p>"; }).join("") + "</div>";
    var akt = (k.aktivitaeten || []).sort(function (a, b) { return new Date(b.datum) - new Date(a.datum); });
    h += '<div class="kb-block"><p class="kb-label">Verlauf</p>' + (akt.length ? akt.map(function (a) {
      return '<p class="kt-merk"><span>' + datum(a.datum) + " · " + esc(a.kanal) + "</span>" + esc(a.anlass || a.inhalt || "") + (a.ergebnis ? " → " + esc(a.ergebnis) : "") + "</p>"; }).join("")
      : '<p class="kt-leise">Noch nichts erfasst. Einfach im Chat diktieren, z. B. „Habe heute mit ' + esc(k.vorname || name(k)) + ' telefoniert …“.</p>') + "</div>";
    var notes = (k.notizen || []).sort(function (a, b) { return (a.art === "Interview" ? 0 : 1) - (b.art === "Interview" ? 0 : 1); });
    if (notes.length) h += '<div class="kb-block ve-orig"><p class="kb-label">Dein Wissen (' + notes.length + ")</p>" + notes.map(function (n) {
      return '<p class="kt-notiz-kopf">' + esc(n.art) + (n.datum ? " · " + datum(n.datum) : "") + (n.quelle ? " · " + esc(n.quelle) : "") + "</p><pre>" + esc(n.text) + "</pre>"; }).join("") + "</div>";
    return h;
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
