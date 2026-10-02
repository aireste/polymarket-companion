"""Cap the pauses between tour lines: any gap longer than MAX is cut down to MAX by
dropping silent MP3 frames from its middle. Words are never touched. Updates tour.mp3
and the saved word timings; then run record_tour.py to retime the player.

    python3 scripts/trim_pauses.py          # MAX = 1.5s
"""
import json, re, sys
MAX = float(sys.argv[1]) if len(sys.argv) > 1 else 1.5
BREAK = r' <break time="[^"]+" /> '

c = json.load(open("scripts/tour_alignment.json")); al = c["alignment"]
ch, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
s = "".join(ch); lines = re.split(BREAK, c["text"])

def frames(buf):
    k = 0
    if buf[:3] == b"ID3":
        k = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9])
    out = []; BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    while k + 4 <= len(buf):
        h = buf[k:k + 4]
        if h[0] != 0xFF or (h[1] & 0xE0) != 0xE0: k += 1; continue
        n = 144 * BR[(h[2] >> 4) & 0xF] * 1000 // [44100, 48000, 32000][(h[2] >> 2) & 3] + ((h[2] >> 1) & 1)
        out.append(buf[k:k + n]); k += n
    return out
f = frames(open("public/tour/tour.mp3", "rb").read()); fdur = 1152 / 44100

drop = []  # (first frame, count, seconds removed, after char index)
pos = 0
for a_line, b_line in zip(lines, lines[1:]):
    end_i = s.find(a_line[-10:], pos) + 10; start_i = s.find(b_line[:14], end_i); pos = start_i
    gap = st[start_i] - en[end_i - 1]
    if gap > MAX:
        cut = gap - MAX; mid = en[end_i - 1] + gap / 2
        k0 = int((mid - cut / 2) / fdur); n = int(cut / fdur)
        drop.append((k0, n, n * fdur, start_i))
        print(f"pause {gap:.2f}s before '{b_line[:24]}…' -> {gap - n * fdur:.2f}s")

keep = []; last = 0
for k0, n, _, _ in drop: keep += f[last:k0]; last = k0 + n
keep += f[last:]
open("public/tour/tour.mp3", "wb").write(b"".join(keep))
def shift(i):
    return sum(sec for _, _, sec, after in drop if i >= after)
al["character_start_times_seconds"] = [round(t - shift(i), 3) for i, t in enumerate(st)]
al["character_end_times_seconds"] = [round(t - shift(i), 3) for i, t in enumerate(en)]
json.dump(c, open("scripts/tour_alignment.json", "w"))
print(f"removed {sum(d[2] for d in drop):.2f}s of silence in {len(drop)} pauses")
