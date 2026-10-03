"""Record the tour as one Brielle take and regenerate TourPlayer's timing block
(line starts, word-tied beats, and YouTube-style caption cues)."""
import json, os, re, ssl, sys, base64, urllib.request

ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
key = [l.split("=", 1)[1].strip() for l in open(".env.local") if l.startswith("ELEVENLABS_API_KEY=")][0]

# Each line: (spoken text, [(spoken anchor, caption text), ...])
SCRIPT = [
 ("Hi! Welcome to HedgePredict. We check the top markets on Polymarket and point out where there could be true value.",
  [("Hi! Welcome", "Hi! Welcome to HedgePredict."), ("We check", "We check the top markets on Polymarket"), ("and point", "and point out where there could be true value.")]),
 ("New to prediction markets? Each share pays a dollar if you're right. Buy at forty-three cents and win, and that's fifty-seven cents profit. The price is also the crowd's odds: about forty-three percent.",
  [("New to", "New to prediction markets?"), ("Each share pays", "Each share pays $1 if you're right."),
   ("Buy at", "Buy at 43¢ and win, and that's 57¢ profit."), ("The price is", "The price is also the crowd's odds: about 43%.")]),
 ("More familiar with sportsbook odds? Flip the switch at the top, and every price turns into the odds you're familiar with.",
  [("More familiar", "More familiar with sportsbook odds?"), ("Flip the switch", "Flip the switch at the top,"),
   ("and every price", "and every price turns into the odds you're familiar with.")]),
 ("Here's the board: every market, its price, and HedgePredict's call.",
  [("Here's the board", "Here's the board:"), ("every market", "every market, its price, and HedgePredict's call.")]),
 ("Every market gets one of three calls: Wager, Lean or Skip. Each one shows you how confident HedgePredict is.",
  [("Every market gets", "Every market gets one of three calls:"), ("Wager, Lean", "Wager, Lean or Skip."),
   ("Each one shows", "Each one shows you how confident HedgePredict is.")]),
 ("Then there's Hedge Lab, your own betting sandbox. Drop in the bets you're holding, and see every way your slip can land. Lock in what you can, size a bet to your bankroll, or play it all out a thousand times before you risk a dollar.",
  [("Then there's", "Then there's Hedge Lab,"), ("your own", "your own betting sandbox."),
   ("Drop in", "Drop in the bets you're holding,"), ("and see every", "and see every way your slip can land."),
   ("Lock in what", "Lock in what you can,"), ("size a bet", "size a bet to your bankroll,"),
   ("or play it all", "or play it all out a thousand times"), ("before you risk", "before you risk a dollar.")]),
 ("Want the best pick without checking the board? Sign up for The Daily, our free newsletter. It sends the day's top pick to your inbox, weekday mornings.",
  [("Want the best", "Want the best pick without checking the board?"), ("Sign up", "Sign up for The Daily, our free newsletter."),
   ("It sends", "It sends the day's top pick to your inbox,"), ("weekday mornings", "weekday mornings.")]),
 ("Don't see your pick on the board? Search all of Polymarket from the search bar, or ask HedgePredict anything about any market.",
  [("Don't see", "Don't see your pick on the board?"), ("Search all", "Search all of Polymarket from the search bar,"),
   ("or ask", "or ask HedgePredict anything about any market.")]),
 ("You can also connect HedgePredict to Claude, ChatGPT, or any AI tool through our M C P. Paste one link, then just ask.",
  [("You can also", "You can also connect HedgePredict to Claude, ChatGPT,"), ("or any AI tool", "or any AI tool through our MCP."),
   ("Paste one link", "Paste one link,"), ("then just ask", "then just ask.")]),
 ("So that's HedgePredict: you bring the plan, and we'll help you spot the value the market might be missing. Play smart, and go get 'em!",
  [("So that's", "So that's HedgePredict:"), ("you bring", "you bring the plan,"),
   ("and we'll help", "and we'll help you spot the value the market might be missing."), ("Play smart", "Play smart, and go get 'em!")]),
]
# Word-tied beats: (name, line index, spoken anchor, comment)
BEAT_DEFS = [("pay", 1, "Each share pays", "Each share pays a dollar"), ("profit", 1, "Buy at", "Buy at forty-three cents"),
             ("pct", 1, "The price is", "The price is also the crowd's odds"), ("us", 2, "every price", "every price turns into…"),
             ("sure", 4, "Each one shows", "Each one shows you how confident…"),
             ("lab", 5, "your own", "your own betting sandbox…"), ("drop", 5, "Drop in", "Drop in the bets…"),
             ("map", 5, "and see every", "and see every way…"), ("lock", 5, "Lock in what", "Lock in what you can…"),
             ("size", 5, "size a bet", "size a bet to your bankroll…"), ("sim", 5, "or play it all", "or play it all out…"),
             ("mail", 6, "Sign up", "Sign up for The Daily…"), ("srch", 7, "Search all", "Search all of Polymarket…"), ("askhp", 7, "or ask", "or ask HedgePredict…"),
             ("conn", 8, "connect HedgePredict", "connect HedgePredict…"), ("apps", 8, "or any AI tool", "or any AI tool…"),
             ("paste", 8, "Paste one link", "Paste one link…"), ("ask", 8, "then just ask", "then just ask…")]

LINES = [l for l, _ in SCRIPT]
# The take's word timings are saved next to this script. Re-running with the same
# lines reuses them (no new recording), so beats and captions can be retimed for free.
# Pass --record to force a new take.
CACHE = "scripts/tour_alignment.json"
# Brielle - Podcast girl, extremely natural (ElevenLabs). Changing it needs --record.
VOICE = "6u6JbqKdaQy89ENzLSju"
# Delivery settings shared by full takes and single-line re-records. Brielle: steadier and no style exaggeration
# (looser settings add laughs and breaths), a touch faster than her natural pace.
VOICE_SETTINGS = {"stability": 0.6, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True, "speed": 1.03}
# 0.85s between lines, a touch more after the two chat demos so their answers can be read.
LONG_AFTER = {7: "1.3s", 8: "1.0s"}
# The closing chapter opens on "HedgePredict!" rather than "And that's", so the AI answer stays up a beat longer.
HOLD = {9: 1000}
text = "".join(ln + (f' <break time="{LONG_AFTER.get(i, "0.85s")}" /> ' if i < len(LINES) - 1 else "") for i, ln in enumerate(LINES))
cached = json.load(open(CACHE)) if os.path.exists(CACHE) else None
if cached and cached["text"] == text and "--record" not in sys.argv:
    al = cached["alignment"]
else:
    # One long request drifts by the end (pitch creep, gibberish), so record in a few parts with
    # ElevenLabs request stitching: each part is generated conditioned on the audio before it,
    # so it stays one performance. Parts are joined at a pause, with real silence from the take.
    CHUNKS = [[0, 1, 2, 3], [4, 5], [6, 7, 8, 9]]
    SR = 44100
    MAX_GAP = 1.4  # no pause between words longer than this
    import array, subprocess, tempfile, wave

    def synth(chunk_text, prev_ids):
        body = {"text": chunk_text, "model_id": "eleven_multilingual_v2", "voice_settings": VOICE_SETTINGS}
        if prev_ids: body["previous_request_ids"] = prev_ids[-3:]
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
            data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
        res = urllib.request.urlopen(req, timeout=300, context=ctx)
        d = json.loads(res.read())
        return base64.b64decode(d["audio_base64"]), (d.get("normalized_alignment") or d["alignment"]), res.headers.get("request-id")

    tmp = tempfile.mkdtemp()
    def pcm(mp3: bytes):
        """Decode a whole part (MP3 frames depend on each other, so never cut MP3 itself)."""
        open(f"{tmp}/p.mp3", "wb").write(mp3)
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", f"{tmp}/p.mp3", f"{tmp}/p.wav"], check=True)
        w = wave.open(f"{tmp}/p.wav"); return array.array("h", w.readframes(w.getnframes()))

    def fade(x, n=int(0.012 * SR)):
        for i in range(min(n, len(x))):
            x[i] = int(x[i] * i / n); x[-1 - i] = int(x[-1 - i] * i / n)
        return x

    brk = lambda i: f' <break time="{LONG_AFTER.get(i, "0.85s")}" /> '
    secs = lambda i: float(LONG_AFTER.get(i, "0.85s").rstrip("s"))
    out = array.array("h"); chars, starts, ends, ids = [], [], [], []
    for ci, chunk in enumerate(CHUNKS):
        ctext = "".join(LINES[i] + (brk(i) if i != chunk[-1] else "") for i in chunk)
        mp3, a, rid = synth(ctext, ids)
        if rid: ids.append(rid)
        x = pcm(mp3)
        ast, aen = a["character_start_times_seconds"], a["character_end_times_seconds"]
        if ci: out.extend(array.array("h", bytes(2 * int(secs(CHUNKS[ci - 1][-1]) * SR))))  # clean silence between parts
        # Walk the part word-gap by word-gap, copying speech and capping long silences.
        cut0 = max(0.0, ast[0] - 0.03)
        seg_start, removed = cut0, 0.0
        base = len(out) / SR
        for i in range(len(ast)):
            if i and ast[i] - aen[i - 1] > MAX_GAP:
                mid = (aen[i - 1] + ast[i]) / 2; drop = ast[i] - aen[i - 1] - MAX_GAP
                out.extend(fade(x[int(seg_start * SR):int((mid - drop / 2) * SR)]))
                seg_start = mid + drop / 2; removed += drop
            starts.append(round(base + ast[i] - cut0 - removed, 3)); ends.append(round(base + aen[i] - cut0 - removed, 3))
        out.extend(fade(x[int(seg_start * SR):int(min(len(x) / SR, aen[-1] + 0.15) * SR)]))
        chars += a["characters"]
    w = wave.open(f"{tmp}/tour.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", f"{tmp}/tour.wav", "public/tour/tour.m4a"], check=True)
    al = {"characters": chars, "character_start_times_seconds": starts, "character_end_times_seconds": ends}
    json.dump({"text": text, "alignment": al}, open(CACHE, "w"))
s = "".join(al["characters"]); st = al["character_start_times_seconds"]
end = round(al["character_end_times_seconds"][-1], 2)

pos = 0; line_idx = []
for ln in LINES:
    i = s.find(ln[:14], pos)
    assert i >= 0, ln[:20]
    line_idx.append(i); pos = i + 1
line_at = [round(st[i], 2) for i in line_idx]

def find(anchor, after):
    i = s.find(anchor, after)
    assert i >= 0, anchor
    return i

caps = []
for li, (_, chunks) in enumerate(SCRIPT):
    p = line_idx[li]
    for anchor, cap in chunks:
        i = find(anchor, p); caps.append((round(st[i], 2), cap)); p = i + 1
beats = []
for name, li, anchor, note in BEAT_DEFS:
    i = find(anchor, line_idx[li]); beats.append((name, round(st[i] - line_at[li], 2), note))

block = ("/** Where each line starts in tour.mp3 (s), from ElevenLabs word timestamps. Generated by record_tour.py. */\n"
 f"const LINE_AT = [{', '.join(map(str, line_at))}];\n"
 f"const AUDIO_END = {end};\n"
 "/** Chapters open a beat before their line, so the picture lands as she starts speaking. */\n"
 "const LEAD = 250;\n"
 "/** Chapters held a little past their line, so the previous scene can be read (ms). */\n"
 f"const HOLD: Record<number, number> = {json.dumps({str(k): v for k, v in HOLD.items()})};\n"
 "const START = LINE_AT.map((s, i) => (i === 0 ? 0 : Math.round(s * 1000) - LEAD + (HOLD[i] ?? 0)));\n"
 "/** The closing card holds until 1:30 if the voice finishes early. */\n"
 f"const TOTAL = {max(round(end * 1000) + 500, 90000)};\n"
 "const DUR = START.map((s, i) => (START[i + 1] ?? TOTAL) - s);\n"
 "/** In-chapter beats tied to words (s after the line starts). */\n"
 "const BEATS = {\n" + "".join(f"  {n}: {v}, // \"{c}\"\n" for n, v, c in beats) + "};\n"
 "const beat = (k: keyof typeof BEATS) => Math.round(BEATS[k] * 1000) + LEAD;\n"
 "/** Captions, YouTube-style: one short phrase at a time, each shown from when she starts saying it (s). */\n"
 "const CAPS: [number, string][] = [\n" + "".join(f"  [{t}, {json.dumps(c, ensure_ascii=False)}],\n" for t, c in caps) + "];\n")
p = "src/components/TourPlayer.tsx"; src = open(p).read()
a = src.index("/** Where each line starts in tour.mp3"); b = src.index("type SceneProps")
open(p, "w").write(src[:a] + block + "\n" + src[b:])
print("LINE_AT", line_at, "END", end); print("BEATS", beats); print(len(caps), "caption cues")
