import sys, zlib, struct

def read_png(path):
    with open(path, "rb") as f:
        data = f.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a png"
    pos = 8
    width = height = bit_depth = color_type = None
    idat = b""
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        ctype = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+length]
        pos += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(idat)
    channels = {2: 3, 6: 4}[color_type]
    bpp = channels  # 8-bit depth
    stride = width * channels
    out = bytearray()
    prev = bytearray(stride)
    p = 0
    for y in range(height):
        ftype = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if ftype == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i-bpp]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i-bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i-bpp] if i >= bpp else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out += line
        prev = line
    return width, height, channels, bytes(out)

def luminance(px, channels):
    r, g, b = px[0], px[1], px[2]
    return 0.299*r + 0.587*g + 0.114*b

def main(path, dark_threshold=70, min_area=200):
    w, h, ch, px = read_png(path)
    # scan for dark pixel runs, bucket into 64x64 blocks first
    from collections import defaultdict
    block = 32
    bw = (w + block - 1) // block
    bh = (h + block - 1) // block
    counts = defaultdict(int)
    total_dark = 0
    for by in range(bh):
        for bx in range(bw):
            cnt = 0
            for y in range(by*block, min((by+1)*block, h), 2):
                row = y * w * ch
                for x in range(bx*block, min((bx+1)*block, w), 2):
                    i = row + x * ch
                    if luminance(px[i:i+3], ch) < dark_threshold:
                        cnt += 1
            if cnt > 0:
                counts[(bx, by)] = cnt
                total_dark += cnt
    print(f"image {w}x{h}, total dark samples: {total_dark}")
    # group adjacent dark blocks into regions
    dark_blocks = set(counts.keys())
    regions = []
    while dark_blocks:
        start = dark_blocks.pop()
        stack = [start]
        region = []
        while stack:
            b = stack.pop()
            region.append(b)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nb = (b[0]+dx, b[1]+dy)
                    if nb in dark_blocks:
                        dark_blocks.discard(nb)
                        stack.append(nb)
        xs = [r[0] for r in region]; ys = [r[1] for r in region]
        regions.append((min(xs), min(ys), max(xs), max(ys), sum(counts[r] for r in region)))
    regions.sort(key=lambda r: -r[4])
    for (x0, y0, x1, y1, cnt) in regions[:20]:
        px0, py0 = x0*block, y0*block
        px1, py1 = (x1+1)*block, (y1+1)*block
        print(f"dark region: x={px0}-{px1} y={py0}-{py1} samples={cnt} area_px={((px1-px0)*(py1-py0))}")

if __name__ == "__main__":
    main(sys.argv[1], dark_threshold=int(sys.argv[2]) if len(sys.argv) > 2 else 70)