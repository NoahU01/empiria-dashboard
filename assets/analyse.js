/* Analyse – „Bin ich an den richtigen Sachen dran?“
   Signale mit Zahl, jedes führt per Klick dorthin, wo es bearbeitet wird:
     Entscheidungsvorschläge · Termine ohne Vorbereitung · Mails (neu / Handlungsbedarf) · Aufgaben · Rückmeldungen · LinkedIn
   Darunter: Termine der nächsten 14 Tage mit Vorbereitungsstand (offen · vorbereitet · nicht nötig),
   Ideensprint zur Vorbereitung startbar. Pendant zur Steuerung (dort die Vorschläge). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-analyse]");
  if (!db || !wurzel) return;
  var B = window.BetaMail;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var JETZT = new Date(), HEUTE = new Date(JETZT.toDateString());
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var D = { mails: "laedt" };

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = '<div class="kb-hinweis"><p>Bitte einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden – dann erscheint hier die Analyse.</p></div>'; return; }
    var bis14 = new Date(+HEUTE + 15 * 864e5).toISOString();
    Promise.all([
      db.from("vorlagen").select("id, entscheidung").eq("status", "offen"),
      db.from("termine").select("id, start, ende, ganztags, betreff, ort, teilnehmer, extern, postfach, projekt_id, vorbereitung, abgesagt").gte("ende", JETZT.toISOString()).lte("start", bis14).order("start"),
      db.from("aufgaben").select("id, status, faellig_am, antwort_am, mail_gesendet_am").eq("status", "offen"),
      db.from("projekte").select("id, name")
    ]).then(function (r) {
      D.vorlagen = r[0].data || []; D.termine = (r[1].data || []).filter(function (t) { return !t.abgesagt; }); D.aufgaben = r[2].data || []; D.projekte = r[3].data || [];
      zeichnen(); mails();
    });
  });

  function projekt(id) { return D.projekte.filter(function (p) { return p.id === id; })[0]; }
  function kachel(link, zahl, titel, unter, ton) {
    return '<a class="an-k' + (ton ? " an-k--" + ton : "") + '" href="' + link + '"><span class="an-zahl">' + zahl + '</span><b>' + titel + "</b>" + (unter ? "<small>" + unter + "</small>" : "") + "</a>";
  }

  function signale() {
    var vor = D.vorlagen.filter(function (v) { return v.entscheidung !== "spaeter"; }).length;
    var bis7 = new Date(+HEUTE + 8 * 864e5);
    var offen = D.termine.filter(function (t) { return t.vorbereitung === "offen"; });
    var offen7 = offen.filter(function (t) { return new Date(t.start) < bis7; }).length;
    var morgen = iso(new Date(+HEUTE + 864e5)), sonntag = new Date(HEUTE); sonntag.setDate(sonntag.getDate() + (7 - ((sonntag.getDay() + 6) % 7)) - 1);
    var ueber = D.aufgaben.filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) < iso(HEUTE); }).length;
    var woche = D.aufgaben.filter(function (a) { return a.faellig_am && a.faellig_am.slice(0, 10) >= iso(HEUTE) && a.faellig_am.slice(0, 10) <= iso(sonntag); }).length;
    var rueck = D.aufgaben.filter(function (a) { return a.antwort_am; }).length;
    var warten = D.aufgaben.filter(function (a) { return a.mail_gesendet_am && !a.antwort_am; }).length;
    var m;
    if (D.mails === "laedt") m = kachel("/strategie/korrespondenz-beta.html", "…", "Mails", "werden geprüft");
    else if (D.mails === "anmelden") m = '<button type="button" class="an-k an-k--leer" data-ms><span class="an-zahl">–</span><b>Mails</b><small>mit Microsoft anmelden</small></button>';
    else m = kachel("/strategie/korrespondenz-beta.html", D.mails.handlung, "Mails mit Handlungsbedarf", D.mails.neu + " neu in den letzten 24 Stunden", D.mails.handlung ? "achtung" : "");
    return '<div class="an-signale">' +
      kachel("/strategie/steuerung.html", vor, "Entscheidungs&shy;vorschläge", "liegen auf deinem Tisch", vor ? "achtung" : "") +
      kachel("#termine", offen7, "Termine ohne Vorbereitung", "in den nächsten 7 Tagen · " + offen.length + " in 14 Tagen", offen7 ? "achtung" : "") +
      m +
      kachel("/strategie/aufgaben.html", ueber, "Aufgaben überfällig", woche + " fällig bis Sonntag", ueber ? "achtung" : "") +
      kachel("/strategie/aufgaben.html", rueck, "Rückmeldungen eingegangen", warten + " warten noch auf Antwort") +
      '<div class="an-k an-k--leer"><span class="an-zahl">–</span><b>LinkedIn</b><small>Kontakte und Postings – noch nicht angebunden</small></div>' +
      "</div>";
  }

  function termine() {
    if (!D.termine.length) return '<p class="an-leer">Keine Termine in den nächsten 14 Tagen.</p>';
    var tage = {};
    D.termine.forEach(function (t) { var k = iso(new Date(t.start)); (tage[k] = tage[k] || []).push(t); });
    return Object.keys(tage).sort().map(function (k) {
      var d = new Date(k + "T12:00:00");
      return '<section class="an-tag"><h4>' + d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) + "</h4><ul>" + tage[k].map(function (t) {
        var p = projekt(t.projekt_id), zeit = t.ganztags ? "ganztags" : new Date(t.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        var mit = (t.teilnehmer || []).slice(0, 3).join(", ") + ((t.teilnehmer || []).length > 3 ? " …" : "");
        return '<li class="an-t an-t--' + t.vorbereitung + '" data-t="' + t.id + '"><span class="an-zeit">' + zeit + "</span>" +
          '<span class="an-was"><b>' + esc(t.betreff || "(ohne Titel)") + "</b><small>" + [p ? esc(p.name) : "", esc(mit), esc(t.postfach)].filter(Boolean).join(" · ") + "</small></span>" +
          '<span class="an-vorb" role="group" aria-label="Vorbereitung">' +
            '<button type="button" data-v="offen" aria-pressed="' + (t.vorbereitung === "offen") + '">offen</button>' +
            '<button type="button" data-v="vorbereitet" aria-pressed="' + (t.vorbereitung === "vorbereitet") + '">vorbereitet</button>' +
            '<button type="button" data-v="nicht_noetig" aria-pressed="' + (t.vorbereitung === "nicht_noetig") + '">nicht nötig</button></span></li>';
      }).join("") + "</ul></section>";
    }).join("");
  }

  function zeichnen() {
    wurzel.innerHTML = signale() +
      '<section class="an-block" id="termine"><div class="an-block-kopf"><h2 class="st4-h">Termine der nächsten 14 Tage</h2>' +
      '<button type="button" class="an-sprint" data-sprint>Ideensprint zur Vorbereitung starten</button></div>' +
      '<p class="an-hinweis" data-sprint-hinweis hidden></p>' + termine() + "</section>";
    var kopf = document.querySelector(".db-kopf");
    if (kopf && !kopf.querySelector(".st4-nav")) kopf.insertAdjacentHTML("beforeend", '<nav class="st4-nav" aria-label="Hauptseiten"><a class="st4-nav-sicht" href="/strategie/steuerung.html">Steuerung</a>' +
      [["Projekte", "/strategie/projekte.html"], ["Aufgaben", "/strategie/aufgaben.html"], ["Korrespondenz", "/strategie/korrespondenz-beta.html"], ["Kontakte", "/strategie/kontakte.html"]]
        .map(function (x) { return '<a href="' + x[1] + '">' + x[0] + "</a>"; }).join("") + "</nav>");
    verdrahten();
  }

  function verdrahten() {
    var ms = wurzel.querySelector("[data-ms]"); if (ms && B) ms.onclick = B.anmelden;
    wurzel.querySelectorAll(".an-t").forEach(function (li) {
      li.querySelectorAll("[data-v]").forEach(function (b) {
        b.onclick = function () {
          var v = b.getAttribute("data-v"), id = +li.getAttribute("data-t");
          li.classList.add("laedt");
          db.from("termine").update({ vorbereitung: v, von_hand: true }).eq("id", id).then(function (r) {
            li.classList.remove("laedt");
            if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
            D.termine.forEach(function (t) { if (t.id === id) t.vorbereitung = v; });
            zeichnen();
          });
        };
      });
    });
    var sp = wurzel.querySelector("[data-sprint]"), hw = wurzel.querySelector("[data-sprint-hinweis]");
    sp.onclick = function () {
      var offen = D.termine.filter(function (t) { return t.vorbereitung === "offen"; });
      var satz = "Ideensprint zur Terminvorbereitung starten. Offen: " + offen.map(function (t) {
        return new Date(t.start).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + " " + (t.betreff || ""); }).join("; ") + ".";
      db.from("sparring").insert({ modus: "Ideensprint Terminvorbereitung" }).then(function () {});
      var fertig = function () { hw.hidden = false; hw.textContent = "Angefragt – der Startsatz mit allen offenen Terminen liegt in der Zwischenablage, einfach im Chat mit Claude einfügen."; };
      if (navigator.clipboard) navigator.clipboard.writeText(satz).then(fertig, fertig); else fertig();
    };
  }

  // Mails: neu in 24 h und Handlungsbedarf – nur mit Microsoft-Anmeldung (wie Korrespondenz)
  function mails() {
    if (!B) { D.mails = "anmelden"; zeichnen(); return; }
    B.start().then(function (k) {
      if (!k) { D.mails = "anmelden"; zeichnen(); return; }
      return B.laden().then(function (d) {
        var vor24 = Date.now() - 864e5;
        var neu = d.relevant.concat(d.nichtRelevant).filter(function (m) { return new Date(m.receivedDateTime) > vor24; }).length;
        D.mails = { neu: neu, handlung: d.handlung.length }; zeichnen();
      });
    }).catch(function () { D.mails = "anmelden"; zeichnen(); });
  }
})();
