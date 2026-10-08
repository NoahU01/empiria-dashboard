/* Kampagne „Homepage persönlich“ (K-2026-01) – vor dem Versand prüfen.
   Je Person: Anrede, Links (Startseite für alle + höchstens ein Zusatzlink), Kernaussagen der Mail, Hinweis, Passt · Anders …
   Daten: kampagnen.startlink, kampagnen_teilnehmer (zusatz_*, kernaussagen, hinweis, pruefung, pruefung_text).
   Wird auf der Marketing-Seite in [data-kampagne] gezeichnet. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-kampagne]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var K = 1, D = { k: null, t: [] }, filter = "alle";
  try { filter = localStorage.getItem("kp-filter") || "alle"; } catch (x) {}

  db.auth.getSession().then(function (s) {
    if (!s.data.session) return;
    Promise.all([
      db.from("kampagnen").select("id, kampagnen_nr, name, ziel, arbeitsprinzip, startlink").eq("id", K).single(),
      db.from("kampagnen_teilnehmer").select("kontakt_id, status, zuordnungsgrund, zusatz_titel, zusatz_url, zusatz_satz, kernaussagen, hinweis, pruefung, pruefung_text, kontakte(vorname, nachname, ansprache, position, organisationen(name))").eq("kampagne_id", K)
    ]).then(function (r) {
      D.k = r[0].data; D.t = (r[1].data || []).filter(function (t) { return t.status !== "ausgeschlossen"; })
        .sort(function (a, b) { return (a.kontakte.nachname || "").localeCompare(b.kontakte.nachname || "", "de"); });
      zeichnen();
    });
  });

  function sichtbar(t) {
    if (filter === "hinweis") return !!t.hinweis;
    if (filter === "zusatz") return !!t.zusatz_url;
    if (filter === "offen") return t.pruefung !== "passt";
    return true;
  }
  function zeile(t) {
    var k = t.kontakte, org = k.organisationen ? k.organisationen.name : "";
    var stand = t.pruefung === "passt" ? '<p class="kp-stand">✓ Passt</p>' : t.pruefung === "anders" ? '<p class="kp-stand kp-stand--anders"><span>Anders</span>' + esc(t.pruefung_text) + "</p>" : "";
    return '<li class="kp-zeile' + (t.pruefung === "passt" ? " kp-zeile--ok" : "") + '" data-kp="' + t.kontakt_id + '">' +
      '<div class="kp-wer"><b>' + esc(k.vorname + " " + k.nachname) + "</b><small>" + esc(org) + "</small>" +
        '<span class="kp-anrede">' + esc(k.ansprache || "?") + (t.status === "vorgeschlagen" ? " · noch vorgeschlagen" : "") + "</span></div>" +
      '<div class="kp-links"><a href="' + esc(D.k.startlink) + '" target="_blank" rel="noopener">Startseite</a>' +
        (t.zusatz_url ? '<a class="kp-zusatz" href="' + esc(t.zusatz_url) + '" target="_blank" rel="noopener">+ ' + esc(t.zusatz_titel) + "</a>" : "") + "</div>" +
      '<div class="kp-was"><ul>' + String(t.kernaussagen || "").split("\n").filter(Boolean).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        (t.zusatz_satz ? '<p class="kp-satz">„' + esc(t.zusatz_satz) + "“</p>" : "") +
        (t.hinweis ? '<p class="kp-hinweis">' + esc(t.hinweis) + "</p>" : "") + stand + "</div>" +
      '<div class="kp-knoepfe"><button type="button" data-kp-e="passt" aria-pressed="' + (t.pruefung === "passt") + '">Passt</button><button type="button" data-kp-anders>Anders …</button></div>' +
      '<form class="kp-anders" hidden><textarea rows="3" placeholder="Was soll anders sein? – z. B. „Zusätzlich KI zum Anfassen“, „Per Sie“, „Nur WhatsApp“, „Rausnehmen“."></textarea><div><button type="submit">An Claude geben</button><button type="button" data-kp-zu>Abbrechen</button></div></form></li>';
  }
  function zeichnen() {
    if (!D.k) return;
    var mitZ = D.t.filter(function (t) { return t.zusatz_url; }).length, mitH = D.t.filter(function (t) { return t.hinweis; }).length;
    var offen = D.t.filter(function (t) { return t.pruefung !== "passt"; }).length;
    var F = [["alle", "Alle (" + D.t.length + ")"], ["offen", "Noch offen (" + offen + ")"], ["hinweis", "Mit Hinweis (" + mitH + ")"], ["zusatz", "Mit Zusatzlink (" + mitZ + ")"]];
    wurzel.innerHTML = '<section class="st4-block" id="kampagne"><h2 class="st4-h">Kampagne „' + esc(D.k.name) + '“ – vor dem Versand prüfen</h2>' +
      '<p class="kp-regel">Alle bekommen den Link zur Startseite. Wo ein Thema besonders passt, kommt ein Absatz mit einem Zusatzlink dazu. Pro Person: Passt oder Anders … – Claude schreibt danach die Mails im Stil eurer bisherigen Korrespondenz, gesendet wird erst nach deiner Freigabe.</p>' +
      '<div class="kp-filter">' + F.map(function (f) { return '<button type="button" data-kp-f="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      '<div class="kp-kopf"><span>Person</span><span>Links</span><span>Kernaussagen der Mail</span><span></span></div>' +
      '<ol class="kp-liste">' + D.t.filter(sichtbar).map(zeile).join("") + "</ol></section>";
    verdrahten();
  }
  function speichern(t, felder, li) {
    li.classList.add("laedt");
    db.from("kampagnen_teilnehmer").update(felder).eq("kampagne_id", K).eq("kontakt_id", t.kontakt_id).then(function (r) {
      li.classList.remove("laedt");
      if (r.error) { alert("Nicht gespeichert: " + r.error.message); return; }
      for (var k in felder) t[k] = felder[k];
      zeichnen();
    });
  }
  function verdrahten() {
    wurzel.querySelectorAll("[data-kp-f]").forEach(function (b) {
      b.onclick = function () { filter = b.getAttribute("data-kp-f"); try { localStorage.setItem("kp-filter", filter); } catch (x) {} zeichnen(); };
    });
    wurzel.querySelectorAll(".kp-zeile").forEach(function (li) {
      var t = D.t.filter(function (x) { return x.kontakt_id === +li.getAttribute("data-kp"); })[0], form = li.querySelector(".kp-anders");
      li.querySelector('[data-kp-e="passt"]').onclick = function () { speichern(t, { pruefung: t.pruefung === "passt" ? "offen" : "passt", pruefung_text: null }, li); };
      li.querySelector("[data-kp-anders]").onclick = function () { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("textarea").focus(); };
      form.querySelector("[data-kp-zu]").onclick = function () { form.hidden = true; };
      form.onsubmit = function (ev) { ev.preventDefault(); var x = form.querySelector("textarea").value.trim(); if (x) speichern(t, { pruefung: "anders", pruefung_text: x }, li); };
    });
  }
})();
