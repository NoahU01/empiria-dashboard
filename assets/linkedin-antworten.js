/* LinkedIn-Antworten (Daniel, 13.10.2026) – Tabelle linkedin_kommentare.
   Ablauf: Mac holt Kommentare aus Buffer (neu) → Claude schreibt Vorschlag (vorschlag) → Daniel gibt hier frei (senden)
   oder lässt weg (ignoriert) → Mac trägt die Antwort über Buffer ein (gesendet / fehler). */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-la]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var K = [], entwurf = {};   // entwurf: was Daniel gerade tippt (bleibt beim Neuladen erhalten)

  function wann(iso) {
    if (!iso) return "";
    var d = new Date(iso), h = new Date(), tage = Math.floor((new Date(h.toDateString()) - new Date(d.toDateString())) / 864e5);
    var uhr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (tage <= 0) return "heute, " + uhr;
    if (tage === 1) return "gestern, " + uhr;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function karte(k) {
    var kopf = '<p class="la-post">' + esc(k.post_kopf || "") + "</p>" +
      '<p class="la-wer"><b>' + esc(k.autor) + "</b><span>" + esc(wann(k.kommentar_zeit)) + "</span></p>" +
      '<p class="la-kommentar">' + esc(k.kommentar) + (k.kommentar_url ? ' <a href="' + esc(k.kommentar_url) + '" target="_blank" rel="noopener">auf LinkedIn ↗</a>' : "") + "</p>";
    if (k.status === "neu") return '<article class="la-karte">' + kopf + '<span class="la-zustand la-zustand--warten">Vorschlag wird geschrieben …</span></article>';
    if (k.status === "senden") return '<article class="la-karte">' + kopf + '<span class="la-label">Deine Antwort</span><p class="la-kommentar">' + esc(k.antwort) + '</p><span class="la-zustand la-zustand--warten">Wird über Buffer eingetragen …</span></article>';
    if (k.status === "gesendet") return '<article class="la-karte">' + kopf + '<span class="la-label">Deine Antwort</span><p class="la-kommentar">' + esc(k.antwort) + '</p><span class="la-zustand la-zustand--ok">✓ Gesendet ' + esc(wann(k.gesendet_am)) + "</span></article>";
    if (k.status === "ignoriert") return '<article class="la-karte">' + kopf + '<span class="la-zustand la-zustand--warten">Nicht beantwortet' + (k.einschaetzung ? " – " + esc(k.einschaetzung) : "") + "</span></article>";
    var text = entwurf[k.id] != null ? entwurf[k.id] : (k.status === "fehler" ? (k.antwort || k.vorschlag || "") : (k.vorschlag || ""));
    return '<article class="la-karte" data-id="' + k.id + '">' + kopf +
      (k.status === "fehler" ? '<span class="la-zustand la-zustand--fehler">Nicht gesendet</span><p class="la-fehler">' + esc(k.fehler || "") + "</p>" : "") +
      '<label class="la-label" for="la-' + k.id + '">Antwortvorschlag</label>' +
      '<textarea class="la-antwort" id="la-' + k.id + '" data-text rows="4" placeholder="Keine Antwort nötig – oder eigene schreiben">' + esc(text) + "</textarea>" +
      (k.einschaetzung ? '<p class="la-warum">' + esc(k.einschaetzung) + "</p>" : "") +
      '<div class="la-knoepfe"><button type="button" class="la-knopf la-knopf--senden" data-senden' + (text.trim() ? "" : " disabled") + ">" + (k.status === "fehler" ? "Erneut senden" : "Antwort senden") + "</button>" +
      '<p class="la-folge">Der Mac trägt den Text über Buffer als Antwort auf LinkedIn ein – meist innerhalb von 5 Minuten.</p>' +
      '<button type="button" class="la-knopf la-knopf--weg" data-weg>Nicht antworten</button></div></article>';
  }

  function zeichnen() {
    var offen = K.filter(function (k) { return ["neu", "vorschlag", "fehler", "senden"].indexOf(k.status) >= 0; });
    var fertig = K.filter(function (k) { return k.status === "gesendet" || k.status === "ignoriert"; });
    wurzel.innerHTML = (offen.length ? offen.map(karte).join("") :
      '<p class="la-leer">Gerade wartet kein Kommentar auf eine Antwort. Neue Kommentare der letzten zwei Wochen erscheinen hier – du bekommst eine Meldung aufs Handy.</p>') +
      (fertig.length ? '<details class="la-erledigt"><summary>Erledigt in den letzten 14 Tagen</summary>' + fertig.map(karte).join("") + "</details>" : "");
  }

  function laden() {
    var seit = new Date(Date.now() - 14 * 864e5).toISOString();
    return db.from("linkedin_kommentare").select("id, autor, kommentar, kommentar_zeit, kommentar_url, post_kopf, status, vorschlag, einschaetzung, antwort, fehler, gesendet_am")
      .gte("kommentar_zeit", seit).order("kommentar_zeit", { ascending: false })
      .then(function (r) { if (r.error) throw r.error; K = r.data || []; zeichnen(); });
  }

  wurzel.addEventListener("input", function (e) {
    var t = e.target.closest("[data-text]"); if (!t) return;
    var c = t.closest("[data-id]"); entwurf[c.dataset.id] = t.value;
    c.querySelector("[data-senden]").disabled = !t.value.trim();
  });
  wurzel.addEventListener("click", function (e) {
    var b = e.target.closest("[data-senden],[data-weg]"); if (!b) return;
    var c = b.closest("[data-id]"), id = +c.dataset.id, senden = b.hasAttribute("data-senden");
    var text = c.querySelector("[data-text]").value.trim();
    if (senden && !text) return;
    var f = senden ? { status: "senden", antwort: text, freigegeben_am: new Date().toISOString(), fehler: null }
                   : { status: "ignoriert", einschaetzung: "Von Daniel bewusst nicht beantwortet." };
    [].forEach.call(c.querySelectorAll("button"), function (x) { x.disabled = true; });
    db.from("linkedin_kommentare").update(f).eq("id", id).then(function (r) {
      if (r.error) { alert("Speichern hat nicht geklappt: " + r.error.message); laden(); return; }
      delete entwurf[id]; laden();
    });
  });

  db.auth.getSession().then(function (s) {
    if (!s.data.session) {
      wurzel.innerHTML = '<p class="la-leer">Bitte einmal anmelden: <a href="/strategie/kontakte.html?zurueck=' + encodeURIComponent(location.pathname) + '">zur Anmeldung</a>. Auf dem iPhone als App: den Code aus der Mail eingeben.</p>';
      return;
    }
    laden().catch(function (e) { wurzel.innerHTML = '<p class="la-leer">Laden hat nicht geklappt: ' + esc(e.message || e) + "</p>"; });
    // Aktuell halten, solange die Seite offen ist (Vorschläge und Sendestatus kommen vom Mac)
    setInterval(function () { if (!document.hidden && !document.activeElement.matches("[data-text]")) laden().catch(function () {}); }, 30000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) laden().catch(function () {}); });
  });
})();
