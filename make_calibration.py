#!/usr/bin/env python3
# Calibration — a single-page specimen plate. Vector SVG -> PNG + PDF.
import cairosvg

W, H = 1240, 1754
M = 104
X0, X1 = M, W - M          # 104 .. 1136
Y0, Y1 = M, H - M          # 104 .. 1650
CW = X1 - X0               # 1032

# ── palette ─────────────────────────────────────────────────────────
GROUND   = "#0A0A0C"
PANEL    = "#101015"
INK      = "#E9E9EE"
INK_DIM  = "#9B9BA8"
INK_FAINT= "#5C5C68"
HAIR     = "#26262E"
HAIR_S   = "#191920"
RAMP = ["#EEF2FF","#E0E7FF","#C7D2FE","#A5B4FC","#818CF8",
        "#6366F1","#4F46E5","#4338CA","#3730A3","#312E81"]
INDIGO   = "#6366F1"
AMBER    = "#FBBF24"

# ── fonts ───────────────────────────────────────────────────────────
DISP  = "Big Shoulders"
MONO  = "Geist Mono"
LAB   = "Jura Light"
LABM  = "Jura Medium"
SER   = "Instrument Serif"

s = []
def add(x): s.append(x)

def line(x1,y1,x2,y2,stroke=HAIR,w=1,op=1,dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{stroke}" stroke-width="{w}" opacity="{op}"{d}/>')

def rect(x,y,w,h,fill="none",stroke="none",sw=1,rx=0,op=1):
    add(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{op}"/>')

def text(x,y,t,size,fill=INK,family=MONO,weight=400,anchor="start",ls=0,italic=False,tl=None,op=1):
    style = ' font-style="italic"' if italic else ""
    lsp = f' letter-spacing="{ls}"' if ls else ""
    tll = f' textLength="{tl:.2f}" lengthAdjust="spacing"' if tl else ""
    add(f'<text x="{x:.2f}" y="{y:.2f}" font-family="{family}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{lsp}{style}{tll} opacity="{op}">{t}</text>')

def crosshair(cx,cy,r=9,stroke=INK_DIM,w=1,op=0.8):
    line(cx-r,cy,cx+r,cy,stroke,w,op); line(cx,cy-r,cx,cy+r,stroke,w,op)

# ════════════════════════════════════════════════════════════════════
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')

# defs: dot-grid pattern + continuous ramp gradient
add('<defs>')
add(f'<pattern id="dots" width="31" height="31" patternUnits="userSpaceOnUse">'
    f'<circle cx="0.6" cy="0.6" r="0.7" fill="{INK}"/></pattern>')
stops = "".join(f'<stop offset="{i/(len(RAMP)-1)*100:.1f}%" stop-color="{c}"/>' for i,c in enumerate(RAMP))
add(f'<linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient>')
add(f'<radialGradient id="amberGlow" cx="50%" cy="50%" r="50%">'
    f'<stop offset="0%" stop-color="{AMBER}" stop-opacity="0.5"/>'
    f'<stop offset="100%" stop-color="{AMBER}" stop-opacity="0"/></radialGradient>')
add('</defs>')

# background
rect(0,0,W,H,fill=GROUND)
# faint dot substrate within content
add(f'<g opacity="0.05"><rect x="{X0}" y="{Y0}" width="{CW}" height="{Y1-Y0}" fill="url(#dots)"/></g>')

# corner registration crosshairs
for cx,cy in [(X0,Y0),(X1,Y0),(X0,Y1),(X1,Y1)]:
    crosshair(cx,cy)

# left spine label (in outer margin)
add(f'<g transform="translate(58,{ (Y0+Y1)/2 :.1f}) rotate(-90)">')
text(0,0,"C A L I B R A T I O N&#160;&#160;&#8212;&#160;&#160;P L A T E&#160;&#160;0 6",11,INK_FAINT,LAB,400,"middle",ls=1)
add('</g>')

# ── HEADER ──────────────────────────────────────────────────────────
text(X0,150,"C A L I B R A T I O N&#160;&#160;S E R I E S",14,INK_DIM,LAB,400,"start",ls=3)
text(X1,150,"PLATE 06 / 09",14,INK_DIM,MONO,400,"end")
line(X0,170,X1,170,HAIR,1)
# fine top ruler ticks
n=64
for i in range(n+1):
    tx = X0 + CW*i/n
    th = 9 if i%8==0 else 5
    line(tx,170,tx,170+th,HAIR if i%8==0 else HAIR_S,1,op=0.9 if i%8==0 else 0.7)

# ── TITLE ───────────────────────────────────────────────────────────
text(X0,372,"CALIBRATION",176,INK,DISP,700,"start",tl=CW)
line(X0,400,X1,400,HAIR_S,1)
text(X0,432,"A&#160;&#160;S T U D Y&#160;&#160;I N&#160;&#160;T H E&#160;&#160;P A T I E N T&#160;&#160;T U N I N G&#160;&#160;O F&#160;&#160;A&#160;&#160;S Y S T E M",15,INK_DIM,LAB,400,"start",ls=2)
text(X1,432,"297 &#215; 420 MM",14,INK_FAINT,MONO,400,"end")

# ── FIG 1 — STEP WEDGE ──────────────────────────────────────────────
fy = 506
text(X0,fy,"FIG. 1",12,INK_DIM,LABM,500,"start",ls=2)
text(X0+78,fy,"ACCENT RAMP &#183; CONTINUOUS &amp; STEP WEDGE",12,INK_FAINT,LAB,400,"start",ls=2)
# continuous strip
rect(X0,fy+18,CW,40,fill="url(#ramp)")
text(X1,fy+12,"00 &#8594; 09",11,INK_FAINT,MONO,400,"end")
# step wedge
gap=6; ncell=10
cw=(CW-gap*(ncell-1))/ncell
wy=fy+74; wh=150
for i,c in enumerate(RAMP):
    cx=X0+i*(cw+gap)
    rect(cx,wy,cw,wh,fill=c)
    # primary marker bracket (cell 5)
    txt_fill = INK if i<5 else "#0A0A0C"
    text(cx+cw/2,wy+wh+22,f"{i:02d}",12,INK_DIM,MONO,400,"middle")
    text(cx+cw/2,wy+wh+40,c.replace('#','#'),10.5,INK_FAINT,MONO,400,"middle")
# primary bracket under cell 5
pcx=X0+5*(cw+gap)
line(pcx,wy+wh+52,pcx+cw,wy+wh+52,INK_DIM,1)
line(pcx+cw/2,wy+wh+52,pcx+cw/2,wy+wh+58,INK_DIM,1)
text(pcx+cw/2,wy+wh+72,"PRIMARY",10,INK_DIM,LABM,500,"middle",ls=2)

# ── FIG 2 — RATIONED ACCENT AXIS ────────────────────────────────────
ay=864
text(X0,ay,"FIG. 2",12,INK_DIM,LABM,500,"start",ls=2)
text(X0+78,ay,"RATIONED ACCENT &#183; ONE WARM ANOMALY",12,INK_FAINT,LAB,400,"start",ls=2)
axisy=ay+96
line(X0,axisy,X1,axisy,INK_DIM,1)
nt=40
for i in range(nt+1):
    tx=X0+CW*i/nt
    major=(i%10==0)
    line(tx,axisy,tx,axisy+(11 if major else 6),INK_DIM if major else HAIR,1,op=0.9 if major else 0.7)
    if major:
        text(tx,axisy+28,f"{int(i/nt*100)}",10,INK_FAINT,MONO,400,"middle")
# indigo active marker at 60
def marker(frac,color,label,code,up=True):
    mx=X0+CW*frac
    # triangle
    if up:
        add(f'<path d="M {mx-7:.1f} {axisy-2:.1f} L {mx+7:.1f} {axisy-2:.1f} L {mx:.1f} {axisy-15:.1f} Z" fill="{color}"/>')
        ly=axisy-26
        line(mx,axisy-15,mx,ly,color,1)
        text(mx,ly-8,label,10,color,LABM,500,"middle",ls=2)
        text(mx,ly-24,code,11,INK,MONO,400,"middle")
    return mx
# soft amber glow behind anomaly
amx=X0+CW*0.86
add(f'<circle cx="{amx:.1f}" cy="{axisy:.1f}" r="30" fill="url(#amberGlow)"/>')
marker(0.58,INDIGO,"ACTIVE","#6366F1")
marker(0.86,AMBER,"RATION","#FBBF24")

# ── FIG 3 — SYSTEM REGISTER ─────────────────────────────────────────
ry=1066
text(X0,ry,"FIG. 3",12,INK_DIM,LABM,500,"start",ls=2)
text(X0+78,ry,"SYSTEM REGISTER",12,INK_FAINT,LAB,400,"start",ls=2)
# columns
cSw=X0+8; cTok=X0+60; cVal=X0+360; cRole=X0+660
hy=ry+34
text(cTok,hy,"TOKEN",11,INK_DIM,LABM,500,"start",ls=2)
text(cVal,hy,"VALUE",11,INK_DIM,LABM,500,"start",ls=2)
text(cRole,hy,"ROLE",11,INK_DIM,LABM,500,"start",ls=2)
line(X0,hy+12,X1,hy+12,HAIR,1)
rows=[
 ("GROUND","#0A0A0C","field / page",GROUND,INK),
 ("SURFACE","#1C1C22","card",PANEL,INK),
 ("BASE","#14141A","recessed",  "#14141A",INK),
 ("INK","#E9E9EE","text · primary","#E9E9EE",INK),
 ("MUTED","#8A8A99","text · muted","#8A8A99",INK),
 ("ACCENT","#6366F1","active · cta",INDIGO,INK),
 ("ACCENT&#183;L","#4F46E5","active (light)","#4F46E5",INK),
 ("RATION","#FBBF24","rating",AMBER,AMBER),
]
rh=46
for i,(tok,val,role,chip,valcol) in enumerate(rows):
    yy=hy+34+i*rh
    rect(cSw,yy-15,20,20,fill=chip,stroke=HAIR,sw=1)
    text(cTok,yy,tok,15,INK_DIM,MONO,400,"start")
    text(cVal,yy,val,15,valcol,MONO,400,"start")
    text(cRole,yy,role,14,INK_FAINT,LAB,400,"start",ls=1)
    if i<len(rows)-1:
        line(X0,yy+15,X1,yy+15,HAIR_S,1,op=0.6)

# ── INTENT LINE ─────────────────────────────────────────────────────
iy=hy+34+len(rows)*rh+62
text(X0,iy,"&#8220;The improvement is the silence between two values.&#8221;",30,INK,SER,400,"start",italic=True)

# ── FOOTER ──────────────────────────────────────────────────────────
fyy=Y1-14
line(X0,Y1-44,X1,Y1-44,HAIR,1)
text(X0,fyy,"T O L E R A N C E&#160;&#160;&#177; 0",11,INK_FAINT,LAB,400,"start",ls=2)
text((X0+X1)/2,fyy,"v.5 &#8594; v.6",12,INK_DIM,MONO,400,"middle")
text(X1,fyy,"6366F1 &#183; 0A0A0C &#183; FBBF24",11,INK_FAINT,MONO,400,"end")

add('</svg>')
svg = "\n".join(s)

with open("CALIBRATION.svg","w",encoding="utf-8") as f:
    f.write(svg)
cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to="CALIBRATION.png", output_width=2480, output_height=int(2480*H/W))
cairosvg.svg2pdf(bytestring=svg.encode("utf-8"), write_to="CALIBRATION.pdf")
print("rendered CALIBRATION.svg / .png / .pdf")
