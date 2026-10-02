"""Re-record a run of tour lines (i..j) on their own and splice them into the existing take.

    python3 scripts/splice_tour.py 2        # just line 2
    python3 scripts/splice_tour.py 9 10     # lines 9-10 as one continuous read

Edit the lines in record_tour.py first. The rest of the recording stays exactly as is:
the new clip starts where the old line i started (keeping the pause before it) and the
old audio resumes after the old line j (keeping the pause after it). Neighbouring lines
are sent as context so the delivery flows. Then run record_tour.py to retime the player.
"""
import json, re, ssl, sys, base64, urllib.request

i, j = int(sys.argv[1]), int(sys.argv[-1])
argv, sys.argv = sys.argv, ["x"]
src = open("scripts/record_tour.py").read()
g = {}; exec(src[: src.index("cached = json.load")], g)
LINES, text, key, VOICE = g["LINES"], g["text"], g["key"], g["VOICE"]
ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
BREAK = r' <break time="[^"]+" /> '

old = json.load(open("scripts/tour_alignment.json"))
old_lines = re.split(BREAK, old["text"])
assert len(old_lines) == len(LINES), "line count changed; re-record the whole take"
al = old["alignment"]; ch, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
s = "".join(ch)
a = s.find(old_lines[i][:14]); assert a >= 0
tail = old_lines[j][-12:]; b = s.find(tail, a) + len(tail); assert b > a

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
    return out, 44100

oldf, sr = frames(open("public/tour/tour.mp3", "rb").read()); fdur = 1152 / sr
k_a = int(max(0, st[a] - 0.05) / fdur)                     # cut just before old line i speaks
k_b = min(len(oldf), int((en[b - 1] + 0.08) / fdur) + 1)   # resume just after old line j
t_a, t_b = k_a * fdur, k_b * fdur

# The new segment exactly as it appears in the full script text (keeps the breaks between i..j).
seg = text[text.index(LINES[i]): text.index(LINES[j]) + len(LINES[j])]
body = {"text": seg, "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}}
if i > 0: body["previous_text"] = LINES[i - 1]
if j < len(LINES) - 1: body["next_text"] = LINES[j + 1]
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
    data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
d = json.loads(urllib.request.urlopen(req, timeout=300, context=ctx).read())
newf, _ = frames(base64.b64decode(d["audio_base64"]))
na = d.get("normalized_alignment") or d["alignment"]
nst, nen = na["character_start_times_seconds"], na["character_end_times_seconds"]
lead = nst[0]                                               # trim the clip's own lead-in and tail
k0 = int(max(0, lead - 0.03) / fdur); k1 = min(len(newf), int((nen[-1] + 0.08) / fdur) + 1)
newf = newf[k0:k1]; n0 = k0 * fdur; new_dur = len(newf) * fdur

open("public/tour/tour.mp3", "wb").write(b"".join(oldf[:k_a] + newf + oldf[k_b:]))
shift_new = t_a - n0
shift_after = t_a + new_dur - t_b
merged = {
    "characters": ch[:a] + na["characters"] + ch[b:],
    "character_start_times_seconds": st[:a] + [round(t + shift_new, 3) for t in nst] + [round(t + shift_after, 3) for t in st[b:]],
    "character_end_times_seconds": en[:a] + [round(t + shift_new, 3) for t in nen] + [round(t + shift_after, 3) for t in en[b:]],
}
json.dump({"text": text, "alignment": merged}, open("scripts/tour_alignment.json", "w"))
print(f"lines {i}-{j}: {t_b - t_a:.2f}s -> {new_dur:.2f}s; take now ends {merged['character_end_times_seconds'][-1]:.2f}s")
