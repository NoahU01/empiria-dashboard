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
  var alle = [], vorschlaege = [], aufgaben = [], zustand = { tab: "alle", suche: "", gewaehlt: null };

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
          return db.from("aufgaben").select("id, titel, beschreibung, faellig_am, angelegt_am, organisationen(name), kontakte(vorname, nachname)").eq("status", "offen").order("angelegt_am");
        }).then(function (a) {
          aufgaben = (a && a.data) || [];
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
    ["todo", "To-dos", function () { return false; }],
    ["marken", "Marken", function () { return true; }],
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

  // Marken: alle Kontakte auf einen Blick, nach Firma, ein Klick setzt/entfernt eine Marke
  var MARKEN = ["empiria", "sofort sichtbar", "Müller & Ströbel", "außerhalb Versicherung"];
  function markenHtml() {
    var q = zustand.suche.toLowerCase();
    var liste = alle.filter(function (k) {
      return !q || (name(k) + " " + (k.organisationen ? k.organisationen.name : "")).toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) {
      var fa = a.organisationen ? a.organisationen.name : "~", fb = b.organisationen ? b.organisationen.name : "~";
      return fa.localeCompare(fb, "de") || (a.nachname || "").localeCompare(b.nachname || "", "de");
    });
    var zuletzt = null, h = '<input class="kb-suche kt-suche" type="search" placeholder="Name oder Firma" value="' + esc(zustand.suche) + '" data-suche>' +
      '<table class="kt-marken"><thead><tr><th>Kontakt</th>' + MARKEN.map(function (m) { return "<th>" + esc(m) + "</th>"; }).join("") + "</tr></thead><tbody>";
    liste.forEach(function (k) {
      var firma = k.organisationen ? k.organisationen.name : "ohne Firma";
      if (firma !== zuletzt) { h += '<tr class="kt-marken-firma"><td colspan="5">' + esc(firma) + "</td></tr>"; zuletzt = firma; }
      var hat = (k.kontakt_marken || []).map(function (m) { return m.marke; });
      h += "<tr><td>" + esc(name(k)) + "</td>" + MARKEN.map(function (m) {
        return '<td><input type="checkbox" aria-label="' + esc(m) + '" data-k="' + k.id + '" data-m="' + esc(m) + '"' + (hat.indexOf(m) > -1 ? " checked" : "") + "></td>";
      }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }
  function markenVerdrahten() {
    var s = wurzel.querySelector("[data-suche]");
    s.oninput = function () { zustand.suche = s.value; var pos = s.selectionStart; zeichnen(); var n = wurzel.querySelector("[data-suche]"); n.focus(); n.setSelectionRange(pos, pos); };
    wurzel.querySelectorAll("[data-m]").forEach(function (c) {
      c.onchange = function () {
        var kid = +c.getAttribute("data-k"), m = c.getAttribute("data-m"), k = alle.filter(function (x) { return x.id === kid; })[0];
        c.disabled = true;
        var auftrag = c.checked
          ? db.from("kontakt_marken").upsert({ kontakt_id: kid, marke: m, bestaetigt: true })
          : db.from("kontakt_marken").delete().eq("kontakt_id", kid).eq("marke", m);
        auftrag.then(function (res) {
          c.disabled = false;
          if (res.error) { c.checked = !c.checked; alert("Nicht gespeichert: " + res.error.message); return; }
          k.kontakt_marken = (k.kontakt_marken || []).filter(function (x) { return x.marke !== m; });
          if (c.checked) k.kontakt_marken.push({ marke: m, bestaetigt: true });
        });
      };
    });
  }

  function todoHtml() {
    if (!aufgaben.length) return '<p class="kb-leer">Keine offenen To-dos.</p>';
    return '<ul class="kt-todo">' + aufgaben.map(function (a) {
      var bezug = a.kontakte ? name(a.kontakte) : a.organisationen ? a.organisationen.name : "";
      return '<li data-a="' + a.id + '"><div><b>' + esc(a.titel) + "</b>" + (bezug ? "<span>" + esc(bezug) + "</span>" : "") +
        (a.beschreibung && a.beschreibung !== a.titel ? "<p>" + esc(a.beschreibung) + "</p>" : "") + "</div>" +
        '<button type="button">Erledigt</button></li>';
    }).join("") + "</ul>";
  }

  function zeichnen() {
    if (zustand.tab === "todo") {
      wurzel.innerHTML = tabsHtml() + todoHtml();
      tabsVerdrahten();
      wurzel.querySelectorAll("[data-a] button").forEach(function (b) {
        b.onclick = function () {
          var id = +b.parentNode.getAttribute("data-a"); b.disabled = true;
          db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", id).then(function (r) {
            if (r.error) { b.disabled = false; alert("Nicht gespeichert: " + r.error.message); return; }
            aufgaben = aufgaben.filter(function (x) { return x.id !== id; }); zeichnen();
          });
        };
      });
      return;
    }
    if (zustand.tab === "marken") {
      wurzel.innerHTML = tabsHtml() + markenHtml();
      tabsVerdrahten(); markenVerdrahten();
      return;
    }
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
      var n = t[0] === "vorschlaege" ? vorschlaege.length : t[0] === "todo" ? aufgaben.length : alle.filter(t[2]).length;
      if (t[0] === "todo" && !n && zustand.tab !== t[0]) return "";
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
      "aktivitaeten(datum, kanal, richtung, anlass, inhalt, ergebnis, teilnehmer, ort, link)").eq("id", id).single().then(function (r) {
      if (r.error) { ziel.innerHTML = '<p class="kb-leer">Fehler: ' + esc(r.error.message) + "</p>"; return; }
      ziel.innerHTML = detailHtml(r.data);
    });
  }

  // Detail für Entscheidungen: wer, wann zuletzt, was ist offen, wie erreichbar.
  // Merkmale und Interviewwissen bleiben in der Datenbank (für Claude), werden hier nicht gezeigt.
  function tageSeit(d) { return Math.floor((Date.now() - new Date(d)) / 864e5); }
  function abschnitt(titel, inhalt) { return inhalt ? '<section class="kt-a"><h3>' + titel + "</h3>" + inhalt + "</section>" : ""; }

  function detailHtml(k) {
    var o = k.organisationen || {};
    var marken = (k.kontakt_marken || []).map(function (m) { return m.marke; }).join(", ");
    var h = '<div class="kt-d">';
    h += '<h2 class="kt-name">' + esc(name(k)) + "</h2>";
    h += '<p class="kt-sub">' + esc([k.position, o.name].filter(Boolean).join(" · ")) + "</p>";
    h += '<p class="kt-tags">' + [k.ansprache && "per " + esc(k.ansprache), k.prioritaet && "Priorität " + esc(k.prioritaet), marken && esc(marken)]
      .filter(Boolean).join('<span aria-hidden="true">·</span>') + (k.kontaktstopp ? '<span aria-hidden="true">·</span><b class="kt-stopp">Kontaktstopp</b>' : "") + "</p>";

    // Stand der Beziehung
    var letzt = k.letzter_kontakt ? datum(k.letzter_kontakt) + " (vor " + tageSeit(k.letzter_kontakt) + " Tagen)" : "noch nicht erfasst";
    var faelligAm = k.rhythmus_tage ? (k.letzter_kontakt ? new Date(new Date(k.letzter_kontakt).getTime() + k.rhythmus_tage * 864e5) : new Date()) : null;
    var istFaellig = faelligAm && faelligAm <= new Date();
    h += '<dl class="kt-stand">' +
      "<div><dt>Letzter Kontakt</dt><dd>" + letzt + "</dd></div>" +
      (faelligAm ? "<div><dt>Nächster Kontakt</dt><dd" + (istFaellig ? ' class="kt-faellig"' : "") + ">" + (istFaellig ? "jetzt fällig" : datum(faelligAm)) + "</dd></div>" : "") +
      (k.beziehungsstatus ? "<div><dt>Beziehung</dt><dd>" + esc(k.beziehungsstatus) + "</dd></div>" : "") + "</dl>";

    // Offen / zu entscheiden
    var offen = [];
    if (k.klaeren) offen.push(esc(k.klaeren));
    if (o.klaeren) offen.push("Firma: " + esc(o.klaeren));
    (k.kampagnen_teilnehmer || []).forEach(function (t) {
      if (t.status === "freigegeben" || t.status === "vorgeschlagen") offen.push("Kampagne „" + esc(t.kampagnen.name) + "“ – " + esc(t.status) + (t.kampagnen.zeitraum ? ", " + esc(t.kampagnen.zeitraum) : ""));
    });
    h += abschnitt("Offen", offen.length ? '<ul class="kt-l">' + offen.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" : "");

    // Anlass für den nächsten Kontakt
    h += abschnitt("Anlass", k.kontaktbriefing ? '<p class="kt-t">' + esc(k.kontaktbriefing) + "</p>" : "");

    // Verlauf: eine Zeile je Kontakt, Details aufklappbar; Geplantes oben
    var akt = (k.aktivitaeten || []).slice().sort(function (a, b) { return new Date(b.datum) - new Date(a.datum); });
    var jetzt = Date.now(), geplant = akt.filter(function (a) { return new Date(a.datum) > jetzt; }).reverse(),
        war = akt.filter(function (a) { return new Date(a.datum) <= jetzt; });
    function eintrag(a) {
      var d = new Date(a.datum), zeit = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      var mit = (a.teilnehmer || []).join(", ");
      var mehr = [a.kanal === "Termin" || a.kanal === "Treffen" ? zeit + " Uhr" : "", a.ort ? esc(a.ort) : "", mit ? "mit " + esc(mit) : "",
                  a.ergebnis ? esc(a.ergebnis) : "", a.inhalt ? esc(a.inhalt) : "", a.link ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener">In Outlook öffnen</a>' : ""]
                 .filter(Boolean).map(function (x) { return "<p>" + x + "</p>"; }).join("");
      return '<li><details><summary><span>' + datum(a.datum) + "</span><b>" + esc(a.kanal) + "</b><em>" + esc(a.anlass || "") + "</em></summary>" +
        (mehr ? '<div class="kt-v-mehr">' + mehr + "</div>" : "") + "</details></li>";
    }
    h += abschnitt("Geplant", geplant.length ? '<ul class="kt-v">' + geplant.map(eintrag).join("") + "</ul>" : "");
    var sichtbar = 6;
    h += abschnitt("Verlauf", war.length ? '<ul class="kt-v">' + war.map(function (a, i) {
        return i < sichtbar ? eintrag(a) : eintrag(a).replace("<li>", '<li class="kt-v-weitere" hidden>'); }).join("") + "</ul>" +
        (war.length > sichtbar ? '<button type="button" class="kt-v-alle" onclick="this.previousElementSibling.querySelectorAll(\'[hidden]\').forEach(function(x){x.hidden=false});this.remove()">Alle ' + war.length + " anzeigen</button>" : "")
      : '<p class="kt-t kt-leise">Noch nichts erfasst. Diktiere mir einfach, wenn du ' + esc(k.vorname || "die Person") + " getroffen oder gesprochen hast.</p>");

    // Erreichbar: nur die bevorzugten, gültigen Wege
    var wege = (k.kontaktwege || []).filter(function (w) { return w.status !== "veraltet" && w.art !== "Fax" && w.art !== "Web"; })
      .sort(function (a, b) { return b.bevorzugt - a.bevorzugt; });
    var je = {}; wege.forEach(function (w) { var g = w.art === "E-Mail" ? "E-Mail" : "Telefon"; if (!je[g]) je[g] = w; });
    var zeilen = Object.keys(je).map(function (g) {
      var w = je[g], link = g === "E-Mail" ? "mailto:" + w.wert : "tel:" + w.wert.replace(/[^\d+]/g, "");
      return "<div><dt>" + g + '</dt><dd><a href="' + esc(link) + '">' + esc(w.wert) + "</a></dd></div>";
    });
    if (k.linkedin_url) zeilen.push('<div><dt>LinkedIn</dt><dd><a href="' + esc(k.linkedin_url) + '" target="_blank" rel="noopener">Profil öffnen</a></dd></div>');
    h += abschnitt("Erreichbar", zeilen.length ? '<dl class="kt-stand">' + zeilen.join("") + "</dl>" : "");
    return h + "</div>";
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
