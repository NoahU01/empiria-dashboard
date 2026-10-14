/* Bei Leads kommentieren (Daniel, 14.10.2026) – Tabelle kommentar_vorschlaege.
   Der Lesezeichen-Knopf „An Claude“ öffnet diese Seite mit #beitrag=<Text des offenen Beitrags>. Die Seite legt die Zeile an
   (status neu), der Wächter auf dem Always-on-Mac startet sofort eine kleine Claude-Sitzung (kommentar_vorschlaege.sh), der
   Vorschlag erscheint hier. Daniel kopiert ihn und kommentiert selbst – in LinkedIn wird nichts automatisch eingetragen. */
(function () {
  "use strict";
  var db = window.empiriaDb, wurzel = document.querySelector("[data-kv-liste]");
  if (!db || !wurzel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var V = [], takt = null;

  // Lesezeichen-Knopf: nimmt den markierten Text oder den Beitrag im offenen Pop-up („Weitere Infos“) des Sales Navigators
  var BM = "(function(){var t=String(window.getSelection()).trim();" +
    "if(!t){var c=[].slice.call(document.querySelectorAll('div,section,aside,article')).filter(function(e){var x=e.innerText||'';return x.indexOf('Weitere Infos')>=0&&x.indexOf('Kommentar hinzuf')>=0&&x.length<20000;})" +
    ".sort(function(a,b){return a.innerText.length-b.innerText.length;})[0];t=c?c.innerText:'';}" +
    "if(!t){alert('Kein Beitrag gefunden. Bitte den Beitrag im Sales Navigator öffnen (Pop-up rechts) oder den Text markieren.');return;}" +
    "t=t.replace(/^\\s*Weitere Infos\\s*/,'').split(/\\n\\s*(?:Gefällt mir|Kommentieren|Reaktionen)\\s*\\n/)[0].trim().slice(0,6000);" +
    "window.open('" + location.origin + "/strategie/linkedin-antworten.html#beitrag='+encodeURIComponent(t),'empiria-antworten');})();";
  var bm = document.querySelector("[data-bm]");
  if (bm) { bm.href = "javascript:" + encodeURIComponent(BM).replace(/'/g, "%27"); bm.addEventListener("click", function (e) { e.preventDefault(); alert("Bitte den Knopf in die Lesezeichenleiste ziehen – hier anklicken bewirkt nichts."); }); }

  function wann(iso) {
    var d = new Date(iso), min = Math.round((Date.now() - d) / 60000);
    if (min < 60) return "vor " + Math.max(1, min) + " Min.";
    return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + " Uhr";
  }
  // Kopfzeilen des Pop-ups (Name, Rolle, „2 Tage“) nicht doppelt zeigen – nur den Beitrag selbst
  function teile(t) {
    var z = String(t || "").split("\n"), i = z.findIndex(function (x) { return /^\s*\d+\s*(Min|Std|Stunde|Tag|Woche|Monat|Jahr|h\b|d\b|w\b)/i.test(x); });
    return { name: (z[0] || "").replace(/\s*·.*$/, "").trim(), text: (i >= 0 && i < 6 ? z.slice(i + 1) : z).join("\n").trim() };
  }
  function karte(v) {
    var tt = teile(v.post_text);
    var kopf = '<p class="la-wer"><b>' + esc(v.autor || tt.name || "Beitrag") + "</b><span>" + esc(wann(v.angelegt_am)) + "</span></p>" +
      '<p class="la-beitrag">' + esc(tt.text) + '</p><button type="button" class="la-mehr" data-mehr>ganzen Beitrag zeigen</button>';
    if (v.status === "neu") return '<article class="la-karte">' + kopf + '<span class="la-zustand la-zustand--warten">Vorschlag wird geschrieben … (meist 1–2 Minuten)</span></article>';
    if (v.status !== "vorschlag") return '<article class="la-karte">' + kopf + '<span class="la-zustand la-zustand--warten">' + (v.status === "erledigt" ? "✓ Kopiert" : "Verworfen") + "</span></article>";
    if (!v.vorschlag) return '<article class="la-karte" data-id="' + v.id + '">' + kopf + '<p class="la-warum">Kein Kommentar empfohlen' + (v.einschaetzung ? ": " + esc(v.einschaetzung) : ".") + '</p><div class="la-knoepfe"><button type="button" class="la-knopf la-knopf--weg" data-weg>Ausblenden</button></div></article>';
    return '<article class="la-karte" data-id="' + v.id + '">' + kopf +
      '<label class="la-label" for="kv-' + v.id + '">Kommentarvorschlag</label>' +
      '<textarea class="la-antwort" id="kv-' + v.id + '" data-text rows="4">' + esc(v.vorschlag) + "</textarea>" +
      (v.einschaetzung ? '<p class="la-warum">' + esc(v.einschaetzung) + "</p>" : "") +
      '<div class="la-knoepfe"><button type="button" class="la-knopf la-knopf--senden" data-kopieren>Kopieren</button>' +
      '<p class="la-folge">Kopiert den Text – dann im Sales Navigator ins Feld „Kommentar hinzufügen“ einfügen und selbst senden.</p>' +
      '<button type="button" class="la-knopf la-knopf--weg" data-weg>Nicht kommentieren</button></div></article>';
  }
  function zeichnen() {
    var offen = V.filter(function (v) { return v.status === "neu" || v.status === "vorschlag"; }), fertig = V.filter(function (v) { return v.status === "erledigt"; });
    wurzel.innerHTML = offen.map(karte).join("") +
      (fertig.length ? '<details class="la-erledigt"><summary>Kopiert in den letzten 3 Tagen</summary>' + fertig.map(karte).join("") + "</details>" : "");
    clearTimeout(takt);
    if (V.some(function (v) { return v.status === "neu"; })) takt = setTimeout(laden, 5000);   // bis der Vorschlag da ist
  }
  function laden() {
    return db.from("kommentar_vorschlaege").select("id, post_text, autor, status, vorschlag, einschaetzung, angelegt_am")
      .gte("angelegt_am", new Date(Date.now() - 3 * 864e5).toISOString()).order("angelegt_am", { ascending: false })
      .then(function (r) { if (r.error) throw r.error; V = r.data || []; zeichnen(); });
  }

  wurzel.addEventListener("click", function (e) {
    var m = e.target.closest("[data-mehr]");
    if (m) { var b = m.previousElementSibling; b.classList.toggle("offen"); m.textContent = b.classList.contains("offen") ? "weniger zeigen" : "ganzen Beitrag zeigen"; return; }
    var k = e.target.closest("[data-kopieren],[data-weg]"); if (!k) return;
    var c = k.closest("[data-id]"), id = +c.dataset.id;
    if (k.hasAttribute("data-kopieren")) {
      var t = c.querySelector("[data-text]").value;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        k.textContent = "Kopiert ✓"; db.from("kommentar_vorschlaege").update({ status: "erledigt", vorschlag: t }).eq("id", id).then(function () { setTimeout(laden, 1200); });
      }, function () { c.querySelector("[data-text]").select(); k.textContent = "Bitte markieren und kopieren"; });
    } else {
      db.from("kommentar_vorschlaege").update({ status: "verworfen" }).eq("id", id).then(laden);
    }
  });

  db.auth.getSession().then(function (s) {
    if (!s.data.session) { wurzel.innerHTML = ""; return; }   // Anmeldehinweis zeigt der Bereich darunter
    var h = location.hash.match(/^#beitrag=(.*)$/);
    var neu = h ? decodeURIComponent(h[1]).trim() : "";
    if (h) history.replaceState(null, "", location.pathname);
    var los = neu ? db.from("kommentar_vorschlaege").select("id").eq("post_text", neu).gte("angelegt_am", new Date(Date.now() - 36e5).toISOString()).then(function (r) {
      if ((r.data || []).length) return;                       // derselbe Beitrag eben schon geschickt
      return db.from("kommentar_vorschlaege").insert({ post_text: neu });
    }) : Promise.resolve();
    los.then(laden).catch(function (e) { wurzel.innerHTML = '<p class="la-leer">Hat nicht geklappt: ' + esc(e.message || e) + "</p>"; });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) laden().catch(function () {}); });
  });
})();
