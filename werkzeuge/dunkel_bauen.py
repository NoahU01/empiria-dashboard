#!/usr/bin/env python3
"""Dunkle Darstellung (Daniel, 18.11.2026: „Button im Menüband, Darstellung hell / dunkel“).

Leitet aus allen Stilblättern eine dunkle Fassung ab und schreibt assets/dunkel.css. Jede Regel mit Farbwerten wird mit
dem Vorsatz html[data-farbe="dunkel"] wiederholt, die Farben werden nach Rolle umgesetzt:
  Flächen (background, box-shadow-Flächen): Weiß → #1c1c1e, Hellgrau → #2c2c2e, Schwarz (Knöpfe, Pillen) → Hell
  Schrift (color): Schwarz/Dunkelgrau → Hell, Mittelgrau bleibt lesbar
  Linien (border, outline, feine box-shadows): → gedämpftes Grau
  Bedeutungsfarben (Lila, Magenta, Cyan, Rot, Ampel, Gelb) bleiben unverändert.
Nach jeder Änderung an einem Stilblatt neu ausführen:  python3 werkzeuge/dunkel_bauen.py"""
import colorsys, glob, os, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLEN = ["styles.css"] + sorted(os.path.relpath(p, REPO) for p in glob.glob(os.path.join(REPO, "assets", "*.css")) if not p.endswith("dunkel.css"))
VOR = 'html[data-farbe="dunkel"]'
FARBE = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b")


def rgb(c):
    c = c.strip().lower()
    if c == "white": return (255, 255, 255, 1)
    if c == "black": return (0, 0, 0, 1)
    if c.startswith("#"):
        h = c[1:]
        if len(h) in (3, 4): h = "".join(x * 2 for x in h)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    z = [x.strip() for x in c[c.index("(") + 1:-1].replace("/", ",").split(",")]
    try:
        v = [float(x.rstrip("%")) for x in z]
    except ValueError:
        return None
    return (v[0], v[1], v[2], v[3] if len(v) > 3 else 1)


def art(c):
    """'hell', 'mittel', 'dunkel' oder 'bunt' (Bedeutungsfarbe, bleibt)."""
    r, g, b, a = c
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s > 0.25 and 0.15 < l < 0.85: return "bunt"
    if l >= 0.86: return "hell"
    if l <= 0.30: return "dunkel"
    return "mittel"


def ersetzen(wert, rolle, ctx):
    def f(m):
        c = rgb(m.group(0))
        if not c: return m.group(0)
        r, g, b, a = c
        k = art(c)
        if k == "bunt": return m.group(0)
        l = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)[1]
        if rolle == "flaeche":
            if k == "hell":
                if a < 1: return f"rgba(28,28,30,{a:g})"
                return "#1c1c1e" if l >= 0.985 else "#2c2c2e"
            if k == "dunkel":
                if a < 0.6: return m.group(0)             # Schatten bleiben Schatten
                ctx["umgedreht"] = True; return "#f2f2f7"
            return "#3a3a3c" if l > 0.6 else m.group(0)
        if rolle == "schrift":
            if k == "dunkel": return "#f2f2f7"
            if k == "mittel": return "#c7c7cc" if l < 0.45 else "#a1a1a6"
            return m.group(0)                             # helle Schrift bleibt (auf Farbflächen); Sonderfall unten
        if rolle == "linie":
            if k == "hell": return "#38383a" if l > 0.9 else "#48484a"
            if k == "dunkel": return "#e5e5ea"
            return "#636366"
        return m.group(0)
    return FARBE.sub(f, wert)


ROLLE = {"color": "schrift", "-webkit-text-fill-color": "schrift", "caret-color": "schrift", "fill": "schrift", "stroke": "linie",
         "background": "flaeche", "background-color": "flaeche", "background-image": "flaeche", "box-shadow": "flaeche",
         "outline": "linie", "outline-color": "linie", "text-decoration-color": "linie", "column-rule": "linie"}


def rolle(prop, wert):
    if prop.startswith("--"):
        n = prop.lower()
        if n in ("--black", "--white", "--schwarz", "--weiss", "--hl"): return None   # bewusst dunkle Flächen mit weißer Schrift bleiben
        if any(w in n for w in ("tinte", "ink", "text", "farbe-text")): return "schrift"
        if any(w in n for w in ("linie", "line", "rand", "border")): return "linie"
        return "flaeche" if any(w in n for w in ("grund", "bg", "flaeche", "paper", "weiss")) else "schrift"
    if prop.startswith("border"): return "linie"
    if prop == "box-shadow" and re.search(r"\b0 0 0 1px\b|\b0 -?1px 0\b|inset 0 -?1px", wert) and "inset 3px" not in wert: return "linie"
    return ROLLE.get(prop)


def bloecke(css):
    """Zerlegt CSS in (Kopf, Inhalt)-Paare, verschachtelt für @media/@supports."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@(import|charset|namespace)[^;]*;", "", css)   # sonst hängt die Anweisung vor dem ersten Block (:root)
    i, n, aus = 0, len(css), []
    while i < n:
        a = css.find("{", i)
        if a < 0: break
        kopf = css[i:a].strip()
        tiefe, j = 1, a + 1
        while j < n and tiefe:
            if css[j] == "{": tiefe += 1
            elif css[j] == "}": tiefe -= 1
            j += 1
        aus.append((kopf, css[a + 1:j - 1]))
        i = j
    return aus


def vorsatz(sel):
    aus = []
    for s in sel.split(","):
        s = s.strip()
        if not s: continue
        if s.startswith(":root"): aus.append(VOR + s[5:])
        elif s.startswith("html"): aus.append(VOR + s[4:])
        else: aus.append(VOR + " " + s)
    return ", ".join(aus)


def regel(kopf, inhalt):
    decls = [d.strip() for d in inhalt.split(";") if ":" in d]
    ctx, neu, hatfarbe = {}, [], False
    for d in decls:
        p, w = d.split(":", 1); p = p.strip().lower(); w = w.strip()
        r = rolle(p, w)
        if not r: continue
        if r == "flaeche" and re.search(r"var\(--(white|weiss)\)", w):   # weiße Fläche über Variable (Knöpfe, Karten)
            neu.append((p, re.sub(r"var\(--(white|weiss)\)", "#1c1c1e", w))); hatfarbe = True; continue
        if not FARBE.search(w):
            # Farbe über Variable (var(--tinte)) oder Schlüsselwort: unverändert wiederholen, damit die Rangfolge
            # zwischen den dunklen Regeln dieselbe bleibt wie im Original (sonst schlägt eine allgemeine Regel die speziellere)
            if "var(" in w or w.split()[0] in ("none", "transparent", "inherit", "currentcolor", "currentColor"): neu.append((p, w))
            continue
        w2 = ersetzen(w, r, ctx)
        neu.append((p, w2)); hatfarbe = hatfarbe or w2 != w
    # Fläche in Tinte (var(--tinte)) wird im Dunkeln hell – wie ein schwarzer Knopf
    if any(re.match(r"background(-color)?\s*:\s*var\(--(tinte|ink)", d.strip(), re.I) for d in decls): ctx["umgedreht"] = True
    # Weiße Schrift auf jetzt hell gewordener Fläche (schwarze Knöpfe) wird dunkel
    if ctx.get("umgedreht"):
        for d in decls:
            p, w = d.split(":", 1); p = p.strip().lower()
            if p == "color" and re.search(r"#fff\b|#ffffff\b|\bwhite\b", w.strip()):
                neu.append((p, "#1c1c1e" + (" !important" if "!important" in w else "")))
    if not hatfarbe and not neu: return ""
    return vorsatz(kopf) + " { " + " ".join(f"{p}: {w};" for p, w in neu) + " }"


def bauen(css):
    aus = []
    for kopf, inhalt in bloecke(css):
        if kopf.startswith("@media") or kopf.startswith("@supports"):
            innen = bauen(inhalt)
            if innen: aus.append(kopf + " {\n" + innen + "\n}")
        elif kopf.startswith("@"):
            continue
        else:
            r = regel(kopf, inhalt)
            if r: aus.append(r)
    return "\n".join(aus)


def main():
    teile = ["/* erzeugt von werkzeuge/dunkel_bauen.py – nicht von Hand ändern; Nachsteuerung am Ende der Datei */",
             VOR + " { color-scheme: dark; }",
             VOR + " body { background: #000; color: #d1d1d6; }"]
    for q in QUELLEN:
        css = open(os.path.join(REPO, q), encoding="utf-8").read()
        teile.append(f"\n/* ---- {q} ---- */\n" + bauen(css))
    teile.append(open(os.path.join(REPO, "werkzeuge", "dunkel_nachsteuerung.css"), encoding="utf-8").read())
    open(os.path.join(REPO, "assets", "dunkel.css"), "w", encoding="utf-8").write("\n".join(teile) + "\n")
    print("assets/dunkel.css aus", len(QUELLEN), "Stilblättern")


if __name__ == "__main__":
    main()
