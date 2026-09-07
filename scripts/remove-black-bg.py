from PIL import Image
from collections import deque
from pathlib import Path

def is_near_black(r, g, b, a=255, threshold=32):
    if a < 8:
        return True
    return r <= threshold and g <= threshold and b <= threshold

def strip_edge_black(im: Image.Image, threshold=32) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * h for _ in range(w)]
    q = deque()

    def try_push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h or visited[x][y]:
            return
        r, g, b, a = px[x, y]
        if not is_near_black(r, g, b, a, threshold):
            return
        visited[x][y] = True
        q.append((x, y))

    for x in range(w):
        try_push(x, 0); try_push(x, h - 1)
    for y in range(h):
        try_push(0, y); try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            try_push(nx, ny)
    return im

def add_padding(im: Image.Image, pad_ratio=0.06) -> Image.Image:
    w, h = im.size
    pad = max(8, int(max(w, h) * pad_ratio))
    out = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    out.paste(im, (pad, pad), im)
    return out

base = Path("public/images/categories")
for src_name, dst_name in [
    ("pawmart-category.jpg", "pawmart-category.png"),
    ("hardware-category.jpg", "hardware-category.png"),
    ("household-category.jpg", "household-category.png"),
]:
    src = base / src_name
    dst = base / dst_name
    im = strip_edge_black(Image.open(src))
    im = add_padding(im, pad_ratio=0.07)
    im.save(dst, "PNG")
    print(f"{src_name} -> {dst_name} {im.size}")
