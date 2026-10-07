/* Dashboard Beta – Startseite: Termine, Aufgaben und „Wieder dran“ aus der Datenbank.
   Braucht die Anmeldung per Login-Link (gleich wie auf der Kontaktseite). */
(function () {
  "use strict";
  var db = window.empiriaDb;
  var ziele = { termine: document.querySelector("[data-start-termine]"), aufgaben: document.querySelector("[data-start-aufgaben]"),
                dran: document.querySelector("[data-start-dran]") };
  if (!db || !ziele.termine) return;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function tag(d) {
    var x = new Date(d), heute = new Date(); heute.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(x.getFullYear(), x.getMonth(), x.getDate()) - heute) / 864e5);
    return diff === 0 ? "heute" : diff === 1 ? "morgen" : x.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  }
  function uhr(d) { return new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
  function name(k) { return [k.vorname, k.nachname].filter(Boolean).join(" "); }
  function alle(html) { Object.keys(ziele).forEach(function (k) { if (ziele[k]) ziele[k].innerHTML = html; }); }

  db.auth.getSession().then(function (s) {
    if (!s.data.session) {
      alle('<p class="db-folgt">Einmal auf der <a href="/strategie/kontakte.html">Kontaktseite</a> anmelden, dann erscheint das hier.</p>');
      return;
    }
    termine(); aufgaben(); dran();
  });

  // Nächste Termine (aus dem Kalender, je Termin einmal, mit den Kontakten dahinter)
  function termine() {
    db.from("aktivitaeten").select("datum, anlass, ort, externe_id, kontakte(vorname, nachname)").eq("kanal", "Termin")
      .gte("datum", new Date().toISOString()).order("datum").limit(40).then(function (r) {
        var je = {}, liste = [];
        (r.data || []).forEach(function (a) {
          if (!je[a.externe_id]) { je[a.externe_id] = { datum: a.datum, anlass: a.anlass, ort: a.ort, mit: [] }; liste.push(je[a.externe_id]); }
          if (a.kontakte) je[a.externe_id].mit.push(name(a.kontakte));
        });
        ziele.termine.innerHTML = liste.length ? '<ul class="st-liste">' + liste.slice(0, 5).map(function (t) {
          return '<li><span class="st-wann">' + tag(t.datum) + "<br>" + uhr(t.datum) + '</span><div><b>' + esc(t.anlass) + "</b><small>" +
            esc(t.mit.join(", ")) + "</small></div></li>";
        }).join("") + "</ul>" : '<p class="db-folgt">Keine anstehenden Termine mit Kontakten.</p>';
      });
  }

  // Offene Aufgaben, abhakbar
  function aufgaben() {
    db.from("aufgaben").select("id, titel, faellig_am, organisationen(name), kontakte(vorname, nachname)").eq("status", "offen")
      .order("faellig_am", { nullsFirst: false }).order("angelegt_am").limit(6).then(function (r) {
        var liste = r.data || [];
        ziele.aufgaben.innerHTML = liste.length ? '<ul class="st-liste st-aufgaben">' + liste.map(function (a) {
          var bezug = a.kontakte ? name(a.kontakte) : a.organisationen ? a.organisationen.name : "";
          return '<li data-a="' + a.id + '"><button type="button" class="st-haken" aria-label="Erledigt"></button><div><b>' + esc(a.titel) + "</b><small>" +
            esc([bezug, a.faellig_am && "fällig " + tag(a.faellig_am)].filter(Boolean).join(" · ")) + "</small></div></li>";
        }).join("") + "</ul>" : '<p class="db-folgt">Keine offenen Aufgaben.</p>';
        ziele.aufgaben.querySelectorAll(".st-haken").forEach(function (b) {
          b.onclick = function () {
            var li = b.closest("li"); li.classList.add("st-weg");
            db.from("aufgaben").update({ status: "erledigt", erledigt_am: new Date().toISOString() }).eq("id", +li.getAttribute("data-a"))
              .then(function (x) { if (x.error) { li.classList.remove("st-weg"); alert("Nicht gespeichert: " + x.error.message); } else setTimeout(aufgaben, 600); });
          };
        });
      });
  }

  // Wieder dran: Rhythmus überschritten, nach Priorität und am längsten überfällig zuerst
  function dran() {
    db.from("kontakte_faellig").select("id, vorname, nachname, organisation, prioritaet, letzter_kontakt, faellig_seit")
      .order("prioritaet").order("faellig_seit").limit(5).then(function (r) {
        var liste = r.data || [];
        ziele.dran.innerHTML = liste.length ? '<ul class="st-liste">' + liste.map(function (k) {
          var seit = k.letzter_kontakt ? "letzter Kontakt vor " + Math.round((Date.now() - new Date(k.letzter_kontakt)) / 864e5) + " Tagen" : "noch kein Kontakt erfasst";
          return '<li><span class="st-prio">' + esc(k.prioritaet || "–") + '</span><div><a href="/strategie/kontakte.html#k=' + k.id + '"><b>' + esc(name(k)) + "</b></a><small>" +
            esc([k.organisation, seit].filter(Boolean).join(" · ")) + "</small></div></li>";
        }).join("") + "</ul>"
          : '<p class="db-folgt">Niemand ist gerade fällig.</p>';
      });
  }
})();
