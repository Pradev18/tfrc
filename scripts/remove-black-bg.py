from PIL import Image
from collections import deque
from pathlib import Path

def is_near_black(r, g, b, a=255, threshold=28):
    if a < 8:
        return True
    return r <= threshold and g <= threshold and b <= threshold

def remove_edge_black(src: Path, dst: Path, threshold=28):
    im = Image.open(src).convert("RGBA")
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
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            try_push(nx, ny)

    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG")
    print(f"OK {src.name} -> {dst.name} ({w}x{h})")

base = Path("public/images/categories")
pairs = [
    ("pawmart-category.jpg", "pawmart-category.png"),
    ("hardware-category.jpg", "hardware-category.png"),
    ("household-category.jpg", "household-category.png"),
    ("hardware-category.png", "hardware-category.png"),
    ("household-category.png", "household-category.png"),
]
# Prefer the jpg sources that match current site cards, then overwrite pngs
for src_name, dst_name in [
    ("pawmart-category.jpg", "pawmart-category.png"),
    ("hardware-category.jpg", "hardware-category.png"),
    ("household-category.jpg", "household-category.png"),
]:
    remove_edge_black(base / src_name, base / dst_name, threshold=32)

print("done")
