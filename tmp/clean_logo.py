import sys
from collections import deque

def parse_ppm(path):
    with open(path, 'rb') as f:
        header = f.readline().decode().strip()
        assert header in ('P6', 'P3'), f"Unexpected header {header}"
        line = f.readline().decode().strip()
        while line.startswith('#'):
            line = f.readline().decode().strip()
        width, height = map(int, line.split())
        maxval = int(f.readline().decode().strip())
        data = f.read()
    return width, height, maxval, data

def main():
    w, h, maxval, raw_data = parse_ppm('/tmp/logo.ppm')
    print(f"Image dimensions: {w}x{h}, maxval: {maxval}, raw data length: {len(raw_data)}")

    # Convert to 2D array of (r, g, b)
    pixels = []
    idx = 0
    for y in range(h):
        row = []
        for x in range(w):
            r = raw_data[idx]
            g = raw_data[idx+1]
            b = raw_data[idx+2]
            row.append((r, g, b))
            idx += 3
        pixels.append(row)

    # Let's check brightness at various positions
    print(f"Corner (0,0): {pixels[0][0]}")
    print(f"Corner (1023,0): {pixels[0][1023]}")
    print(f"Center (512,512): {pixels[512][512]}")

    # Outside the logo, pixels are the checkerboard: white (~255,255,255) or gray (~220,220,220).
    # The logo boundary is very dark (black ring / black sign border, r,g,b < 60).
    # Let's find all background pixels connected to the borders (x=0, x=w-1, y=0, y=h-1).
    
    # A pixel is considered a "barrier" (part of the logo outline) if it is dark or green/colored.
    # Specifically, checkerboard pixels are near-grayscale (r ~ g ~ b) and high brightness (luminance > 160).
    # Let's inspect the distribution.
    
    visited = [[False]*w for _ in range(h)]
    is_bg = [[False]*w for _ in range(h)]
    queue = deque()

    def is_checkerboard_candidate(r, g, b):
        # Checkerboard colors are gray (215-225) and white (250-255), with almost 0 saturation
        # max diff between channels is small
        diff = max(abs(r - g), abs(r - b), abs(g - b))
        lum = (r + g + b) / 3.0
        # If it's bright and neutral/gray, or very bright
        # Also note the logo has a black border enclosing it completely.
        # As long as luminance > 90 and diff < 30, it is definitely checkerboard background.
        # But even better: anything reachable from the outside that is NOT the dark logo border!
        if r < 75 and g < 75 and b < 75:
            # This is the dark black border of the circle or sign plate! Stop BFS here.
            return False
        return True

    # Seed all border edges
    for x in range(w):
        for y in [0, h - 1]:
            if not visited[y][x]:
                visited[y][x] = True
                r, g, b = pixels[y][x]
                if is_checkerboard_candidate(r, g, b):
                    is_bg[y][x] = True
                    queue.append((x, y))

    for y in range(h):
        for x in [0, w - 1]:
            if not visited[y][x]:
                visited[y][x] = True
                r, g, b = pixels[y][x]
                if is_checkerboard_candidate(r, g, b):
                    is_bg[y][x] = True
                    queue.append((x, y))

    while queue:
        cx, cy = queue.popleft()
        for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, ny+1), (cx, ny-1)):
            if 0 <= nx < w and 0 <= ny < h:
                if not visited[ny][nx]:
                    visited[ny][nx] = True
                    r, g, b = pixels[ny][nx]
                    if is_checkerboard_candidate(r, g, b):
                        is_bg[ny][nx] = True
                        queue.append((nx, ny))

    bg_count = sum(row.count(True) for row in is_bg)
    print(f"Total background pixels identified: {bg_count} / {w*h} ({bg_count/(w*h)*100:.1f}%)")

    # Write out a grayscale mask (PGM format P5): 0 for background, 255 for logo
    # Let's also do a 1-pixel erosion/feather on the mask so there are no faint checkerboard fringes
    mask = [[0 if is_bg[y][x] else 255 for x in range(w)] for y in range(h)]

    with open('/tmp/mask.pgm', 'wb') as f:
        f.write(f"P5\n{w} {h}\n255\n".encode())
        mask_bytes = bytearray()
        for y in range(h):
            for x in range(w):
                mask_bytes.append(mask[y][x])
        f.write(mask_bytes)

    print("Mask written to /tmp/mask.pgm")

if __name__ == '__main__':
    main()
