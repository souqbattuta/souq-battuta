"""Write hashed AVIF and WebP copies of the brand images the pages actually show."""
import hashlib
import os
from PIL import Image

ROOT = "public/brand"
OUT = os.path.join(ROOT, "h")
os.makedirs(OUT, exist_ok=True)

def save(im: Image.Image, stem: str, ext: str, **kwargs) -> str:
    path = f"/tmp/{stem}.{ext}"
    im.save(path, **kwargs)
    data = open(path, "rb").read()
    digest = hashlib.sha256(data).hexdigest()[:10]
    name = f"{stem}.{digest}.{ext}"
    dest = os.path.join(OUT, name)
    open(dest, "wb").write(data)
    return f"/brand/h/{name}", len(data)

def variants(src: str, widths: list[int]):
    im = Image.open(src).convert("RGB")
    w0, h0 = im.size
    made = []
    for width in widths:
        width = min(width, w0)
        height = max(1, round(h0 * width / w0))
        frame = im.resize((width, height), Image.Resampling.LANCZOS)
        stem = f"{os.path.splitext(os.path.basename(src))[0]}-{width}"
        avif, avif_n = save(frame, stem, "avif", quality=42, speed=6)
        webp, webp_n = save(frame, stem, "webp", quality=62, method=6)
        made.append((width, height, avif, webp, avif_n, webp_n))
    return w0, h0, made

jobs = []
for name in sorted(os.listdir(os.path.join(ROOT, "icons"))):
    if name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        jobs.append((os.path.join(ROOT, "icons", name), [176]))
for name in sorted(os.listdir(os.path.join(ROOT, "shops"))):
    if name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        jobs.append((os.path.join(ROOT, "shops", name), [480, 960]))
for name in sorted(os.listdir(os.path.join(ROOT, "avatars"))):
    if name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        jobs.append((os.path.join(ROOT, "avatars", name), [160, 320]))
for name, widths in [
    ("banner-desktop.png", [800, 1600]),
    ("banner-phone-header.png", [640, 960]),
    ("header-manuscript.png", [720, 1280]),
    ("phone-landing-paper.jpg", [860]),
    ("hero-collage.jpg", [800, 1600]),
    ("hero-collage-phone.jpg", [640, 960]),
    ("duck-mark.png", [64, 176]),
]:
    path = os.path.join(ROOT, name)
    if os.path.exists(path):
        jobs.append((path, widths))
for name, widths in [
    ("login-collage.jpg", [640, 1200]),
    ("join-collage.jpg", [640, 1200]),
    ("logo-duck.jpg", [160, 320]),
    ("logo-white-tight.jpg", [160, 320]),
]:
    path = os.path.join(ROOT, name)
    if os.path.exists(path):
        jobs.append((path, widths))
stamp = os.path.join(ROOT, "locked", "login-stamp-navy.png")
if os.path.exists(stamp):
    jobs.append((stamp, [420]))

lines = [
    "export type BrandAsset = { w: number; h: number; avif: string; webp: string; src: string; sizes: string };",
    "export const BRAND: Record<string, BrandAsset> = {",
]
for src, widths in jobs:
    key = "/" + src.replace("public/", "")
    _w, _h, made = variants(src, widths)
    avif = ", ".join(f"{item[2]} {item[0]}w" for item in made)
    webp = ", ".join(f"{item[3]} {item[0]}w" for item in made)
    last = made[-1]
    sizes = "176px" if "/icons/" in key else "(min-width: 900px) 320px, 50vw"
    if "banner" in key or "manuscript" in key or "hero-collage" in key:
        sizes = "100vw"
    if "phone-landing-paper" in key:
        sizes = "430px"
    if "login-stamp" in key:
        sizes = "150px"
    if "collage" in key:
        sizes = "(min-width: 900px) 560px, 100vw"
    if "logo-" in key:
        sizes = "80px"
    if key.endswith("duck-mark.png"):
        sizes = "88px"
    lines.append(
        f"  {key!r}: {{ w: {last[0]}, h: {last[1]}, avif: {avif!r}, webp: {webp!r}, src: {last[3]!r}, sizes: {sizes!r} }},"
    )
    print(f"{key} -> {last[5]}B webp / {last[4]}B avif @ {last[0]}px")
lines.append("};")
open("src/lib/brand-manifest.ts", "w").write("\n".join(lines) + "\n")
print("wrote", len(jobs), "assets")
