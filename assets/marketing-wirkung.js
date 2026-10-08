/* Marketing → Wirkung: Verläufe aus Noahs Analytics-Dashboard (Tabelle web_daten, täglich 9:30 vom Mac übernommen)
   und vor allem die Aussage dahinter (Daniels Management-Logik):
     Aufmerksamkeit – kommen mehr Leute, und über welchen Kanal?   Halten – bleiben sie, oder verlassen sie die Seite schnell?
     Google – werden wir gesehen und geklickt?   Anfragen – was kommt dabei heraus?   LinkedIn – Reichweite der Unternehmensseite.
   Zeichnet in [data-wirkung]. Vergleich: letzte 28 Tage gegen die 28 Tage davor. */
(function () {
  "use strict";
  var db = window.empiriaDb, ziel = document.querySelector("[data-wirkung]");
  if (!db || !ziel) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function zahl(v) { var n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isNaN(n) ? 0 : n; }
  function f(n, d) { return Number(n).toLocaleString("de-DE", { maximumFractionDigits: d || 0 }); }
  function proz(a, b) { if (!b) return a ? "neu" : "±0 %"; var p = Math.round((a - b) / b * 100); return (p > 0 ? "+" : "") + p + " %"; }
  var KONTEN = [["empiria", "empiria"], ["sofortsichtbar", "sofortsichtbar"], ["mueller-stroebel", "Müller&Ströbel."]];
  var wahl = "empiria", D = {}, OFFEN = true;
  try { wahl = localStorage.getItem("wirkung-konto") || "empiria"; } catch (x) {}

  db.auth.getSession().then(function (s) {
    if (!s.data.session) return;
    db.from("web_daten").select("konto, blatt, daten, stand").in("blatt", ["Taeglich", "Kanäle", "Seiten", "LinkedIn-Tage"]).then(function (r) {
      (r.data || []).forEach(function (x) { (D[x.konto] = D[x.konto] || { stand: x.stand })[x.blatt] = x.daten || []; });
      zeichnen();
    });
  });

  function tag(z) { return String(z || "").slice(0, 10); }
  function fenster(rows, feld) { // letzte 28 Tage bis zum letzten Datum vs. 28 Tage davor
    var tage = rows.map(function (r) { return tag(r[feld] || r.Zeitraum); }).filter(Boolean).sort(); var bis = tage[tage.length - 1];
    if (!bis) return null;
    var e = new Date(bis + "T12:00:00"), a = new Date(+e - 27 * 864e5), va = new Date(+a - 28 * 864e5);
    var iso = function (d) { return d.toISOString().slice(0, 10); };
    return { bis: bis, von: iso(a), vorVon: iso(va), vorBis: iso(new Date(+a - 864e5)) };
  }
  function summe(rows, feld, von, bis, datum) { return rows.filter(function (r) { var t = tag(r[datum || "Zeitraum"]); return t >= von && t <= bis; }).reduce(function (s, r) { return s + zahl(r[feld]); }, 0); }

  /* ---------- Diagramme (schlichtes SVG im CD) ---------- */
  function linie(punkte, reihen, titel) {
    var B = 560, H = 150, L = 30, R = 8, O = 10, U = 22, w = B - L - R, h = H - O - U;
    var max = Math.max(1, Math.max.apply(null, reihen.map(function (r) { return Math.max.apply(null, r.werte); })));
    var x = function (i) { return L + (punkte.length < 2 ? 0 : i * w / (punkte.length - 1)); }, y = function (v) { return O + h - v / max * h; };
    var svg = '<svg viewBox="0 0 ' + B + " " + H + '" class="wk-svg" role="img" aria-label="' + esc(titel) + '">';
    [0, .5, 1].forEach(function (g) { svg += '<line x1="' + L + '" x2="' + (B - R) + '" y1="' + y(max * g) + '" y2="' + y(max * g) + '" class="wk-gitter"/><text x="' + (L - 6) + '" y="' + (y(max * g) + 3) + '" class="wk-achse" text-anchor="end">' + f(max * g) + "</text>"; });
    [0, Math.floor((punkte.length - 1) / 2), punkte.length - 1].forEach(function (i) { if (punkte[i]) svg += '<text x="' + x(i) + '" y="' + (H - 4) + '" class="wk-achse" text-anchor="' + (i === 0 ? "start" : i === punkte.length - 1 ? "end" : "middle") + '">' + new Date(punkte[i] + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + "</text>"; });
    reihen.forEach(function (r) { svg += '<polyline class="wk-l ' + r.k + '" points="' + r.werte.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ") + '"/>'; });
    return svg + "</svg>" + '<p class="wk-leg">' + reihen.map(function (r) { return '<span class="' + r.k + '">' + esc(r.n) + "</span>"; }).join("") + "</p>";
  }
  function schnitt7(w) { return w.map(function (_, i) { var t = w.slice(Math.max(0, i - 6), i + 1); return t.reduce(function (a, b) { return a + b; }, 0) / t.length; }); }

  function konto(k) {
    var d = D[k]; if (!d || !d.Taeglich || !d.Taeglich.length) return '<p class="kt3-leise">Noch keine Daten für dieses Konto.</p>';
    var T = d.Taeglich.filter(function (r) { return /_tag$/.test(r.Zeitraum); }).sort(function (a, b) { return tag(a.Zeitraum) < tag(b.Zeitraum) ? -1 : 1; });
    var F = fenster(T, "Zeitraum"), s = function (feld, von, bis, rows, dat) { return summe(rows || T, feld, von, bis, dat); };
    var sit = s("Sitzungen", F.von, F.bis), sitV = s("Sitzungen", F.vorVon, F.vorBis), leads = s("Leads gesamt", F.von, F.bis);
    var imp = s("GSC Impressionen", F.von, F.bis), impV = s("GSC Impressionen", F.vorVon, F.vorBis), kl = s("GSC Klicks", F.von, F.bis), klV = s("GSC Klicks", F.vorVon, F.vorBis);
    var posR = T.filter(function (r) { var t = tag(r.Zeitraum); return t >= F.von && t <= F.bis && zahl(r["GSC Impressionen"]); });
    var pos = posR.reduce(function (a, r) { return a + zahl(r["GSC Ø Position"]) * zahl(r["GSC Impressionen"]); }, 0) / Math.max(1, posR.reduce(function (a, r) { return a + zahl(r["GSC Impressionen"]); }, 0));
    // Kanäle im Fenster
    var K = {}; (d["Kanäle"] || []).filter(function (r) { var t = tag(r.Zeitraum); return /_tag$/.test(r.Zeitraum) && t >= F.von && t <= F.bis; }).forEach(function (r) { K[r.Kanal] = (K[r.Kanal] || 0) + zahl(r.Sitzungen); });
    var kSum = Object.keys(K).reduce(function (a, x) { return a + K[x]; }, 0) || 1, kSort = Object.keys(K).sort(function (a, b) { return K[b] - K[a]; });
    var anteil = function (n) { return Math.round((K[n] || 0) / kSum * 100); };
    // Startseite halten
    var S = (d.Seiten || []).filter(function (r) { var t = tag(r.Zeitraum); return /_tag$/.test(r.Zeitraum) && t >= F.von && t <= F.bis && (r.Seite === "/" || r.Seite === "/index.html"); });
    var auf = S.reduce(function (a, r) { return a + zahl(r.Aufrufe); }, 0), verw = S.reduce(function (a, r) { return a + zahl(r["Ø Verweildauer je Aufruf (s)"]) * zahl(r.Aufrufe); }, 0) / Math.max(1, auf);
    var abspr = S.reduce(function (a, r) { return a + zahl(r["Absprungrate %"]) * zahl(r.Aufrufe); }, 0) / Math.max(1, auf);
    // LinkedIn Unternehmensseite
    var LI = (d["LinkedIn-Tage"] || []).filter(function (r) { return r.Profil === "unternehmen"; }).sort(function (a, b) { return a.Datum < b.Datum ? -1 : 1; });
    var LF = LI.length ? fenster(LI, "Datum") : null, liImp = LF ? summe(LI, "Impressions", LF.von, LF.bis, "Datum") : 0, liImpV = LF ? summe(LI, "Impressions", LF.vorVon, LF.vorBis, "Datum") : 0;
    var PD = (d["LinkedIn-Tage"] || []).filter(function (r) { return r.Profil === "daniel"; }).sort(function (a, b) { return a.Datum < b.Datum ? -1 : 1; });
    var PF = PD.length ? fenster(PD, "Datum") : null, pdImp = PF ? summe(PD, "Impressions", PF.von, PF.bis, "Datum") : 0, pdImpV = PF ? summe(PD, "Impressions", PF.vorVon, PF.vorBis, "Datum") : 0;

    // Aussagen
    var A = [];
    var kanalText = anteil("Direct") >= 60 ? "Die meisten kommen **direkt** (" + anteil("Direct") + " %) – über persönliche Ansprache, Links in Mails oder Nachrichten, nicht über Google. Die Aufmerksamkeit entsteht im Netzwerk."
      : (K["Organic Search"] || 0) / kSum >= .3 ? "Ein großer Teil kommt über **Google** (" + anteil("Organic Search") + " %) – die Seite wird gefunden."
      : "Die Besucher kommen über mehrere Kanäle, keiner dominiert.";
    if ((K["Organic Social"] || 0) > 0) kanalText += " LinkedIn & Co. bringen " + anteil("Organic Social") + " %.";
    A.push(["Aufmerksamkeit", f(sit) + " Besuche · " + proz(sit, sitV), (sit > sitV * 1.2 ? "Es kommen deutlich mehr Leute als im Vormonat – die Aufmerksamkeit ist gestiegen. " : sit < sitV * .8 ? "Es kommen weniger Leute als im Vormonat. " : "Etwa so viele Besucher wie im Vormonat. ") + kanalText]);
    A.push(["Halten", auf ? "Startseite Ø " + f(verw) + " s · Absprung " + f(abspr) + " %" : "zu wenig Daten",
      !auf ? "Für eine Aussage zur Startseite reichen die Aufrufe noch nicht." : (verw < 20 || abspr > 60) ? "Die Aufmerksamkeit kommt an, aber die Seite hält nicht: Wer kommt, geht schnell wieder. Das, was wir dahinter versprechen, ist zu schwach – oder zu schwach dargestellt." : "Wer kommt, bleibt und liest – die Seite hält, was die Aufmerksamkeit verspricht."]);
    A.push(["Google", f(imp) + " Einblendungen · " + proz(imp, impV) + " · " + f(kl) + " Klicks · Position " + f(pos, 1),
      !imp ? "Bei Google findet praktisch nicht statt." : pos > 20 ? "Wir werden zwar eingeblendet, aber meist erst ab Seite 3 – praktisch unsichtbar." : (imp > impV * 1.2 && kl <= klV) ? "Wir werden häufiger gesehen, aber nicht häufiger geklickt – Titel und Beschreibung überzeugen nicht." : "Wir werden gefunden und geklickt – vor allem über den eigenen Namen."]);
    A.push(["Anfragen", f(leads) + " in 28 Tagen", leads ? "Aus " + f(sit) + " Besuchen wurden " + f(leads) + " Anfragen." : "Aus " + f(sit) + " Besuchen kam keine Anfrage – die Seite führt noch nicht zum nächsten Schritt."]);
    if (LF || PF) {
      var stand = new Date(((LF && LF.bis) || PF.bis) + "T12:00:00").toLocaleDateString("de-DE");
      var t = !liImp && !liImpV ? "Die Unternehmensseite hat keine messbare Reichweite – sichtbar ist vor allem dein persönliches Profil" + (pdImp ? " (" + f(pdImp) + " Impressionen, " + proz(pdImp, pdImpV) + ")." : ".")
        : liImp > liImpV * 1.1 ? "Die Unternehmensseite erreicht mehr Menschen als im Vormonat." : liImp < liImpV * .9 ? "Die Reichweite der Unternehmensseite ist rückläufig." : "Die Reichweite der Unternehmensseite ist stabil.";
      A.push(["LinkedIn", "Unternehmensseite " + f(liImp) + " · dein Profil " + f(pdImp) + " Impressionen", t + " Stand der Daten: " + stand + " (Export in Noahs Dashboard)."]);
    }

    var tage = T.map(function (r) { return tag(r.Zeitraum); }), sitW = T.map(function (r) { return zahl(r.Sitzungen); });
    var md = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); };
    return '<div class="wk-aussagen">' + A.map(function (a) { return '<div class="wk-a"><p class="wk-a-k">' + esc(a[0]) + '</p><p class="wk-a-z">' + esc(a[1]) + '</p><p class="wk-a-t">' + md(a[2]) + "</p></div>"; }).join("") + "</div>" +
      '<div class="wk-charts">' +
        '<figure><figcaption>Besuche pro Tag</figcaption>' + linie(tage, [{ n: "Besuche", k: "wk-l1", werte: sitW }, { n: "7-Tage-Schnitt", k: "wk-l2", werte: schnitt7(sitW) }], "Besuche") + "</figure>" +
        '<figure><figcaption>Woher die Besucher kommen (28 Tage)</figcaption><ul class="wk-balken">' + kSort.map(function (n) { return '<li><span>' + esc(n) + '</span><i style="width:' + Math.max(2, anteil(n)) + '%"></i><b>' + anteil(n) + " %</b></li>"; }).join("") + "</ul></figure>" +
        '<figure><figcaption>Google: Einblendungen und Klicks pro Tag</figcaption>' + linie(tage, [{ n: "Einblendungen", k: "wk-l1", werte: T.map(function (r) { return zahl(r["GSC Impressionen"]); }) }, { n: "Klicks", k: "wk-l3", werte: T.map(function (r) { return zahl(r["GSC Klicks"]); }) }], "Google") + "</figure>" +
        (PD.length ? '<figure><figcaption>LinkedIn: Impressionen pro Tag</figcaption>' + linie(PD.map(function (r) { return r.Datum; }), [{ n: "dein Profil", k: "wk-l1", werte: PD.map(function (r) { return zahl(r.Impressions); }) }, { n: "Unternehmensseite", k: "wk-l3", werte: PD.map(function (r) { var u = LI.filter(function (x) { return x.Datum === r.Datum; })[0]; return u ? zahl(u.Impressions) : 0; }) }], "LinkedIn") + "</figure>" : "") +
      "</div>" + '<p class="wk-stand">Quelle: Noahs Analytics-Dashboard · übernommen ' + new Date(d.stand).toLocaleString("de-DE", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr · Vergleich: letzte 28 Tage gegen die 28 davor</p>";
  }

  function zeichnen() {
    ziel.innerHTML = '<section class="kt3-box kt3-breit kg-bereich wk' + (OFFEN ? "" : " pr-zu") + '"><h3><button type="button" class="pr-klapp" aria-expanded="' + OFFEN + '"><span>Wirkung</span><span class="tl-dreieck" aria-hidden="true"></span></button></h3>' +
      '<div class="kg-inhalt"><div class="kp-filter">' + KONTEN.map(function (k) { return '<button type="button" data-wk="' + k[0] + '" aria-pressed="' + (wahl === k[0]) + '">' + esc(k[1]) + "</button>"; }).join("") + "</div>" + konto(wahl) + "</div></section>";
    ziel.querySelector(".pr-klapp").onclick = function () { OFFEN = !OFFEN; zeichnen(); };
    ziel.querySelectorAll("[data-wk]").forEach(function (b) { b.onclick = function () { wahl = b.getAttribute("data-wk"); try { localStorage.setItem("wirkung-konto", wahl); } catch (x) {} zeichnen(); }; });
  }
})();
