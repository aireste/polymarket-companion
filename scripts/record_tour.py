"""Record the tour as one Brielle take and regenerate TourPlayer's timing block
(line starts, word-tied beats, and YouTube-style caption cues)."""
import json, os, re, ssl, sys, base64, urllib.request, urllib.error

ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
key = [l.split("=", 1)[1].strip() for l in open(".env.local") if l.startswith("ELEVENLABS_API_KEY=")][0]

# Each line: (spoken text, [(spoken anchor, caption text), ...])
SCRIPT = [
 ("Hi! Welcome to HedgePredict. We check the top markets on Polymarket and point out where there could be true value.",
  [("Hi! Welcome", "Hi! Welcome to HedgePredict."), ("We check", "We check the top markets on Polymarket"), ("and point", "and point out where there could be true value.")]),
 ("New to prediction markets? Just read the price as the odds. Kentucky at forty-three cents means the crowd gives them about a forty-three percent chance. South Carolina at fifty-eight cents, about fifty-eight percent.",
  [("New to", "New to prediction markets?"), ("Just read", "Just read the price as the odds."),
   ("Kentucky at forty-three", "Kentucky at 43¢ means the crowd gives them about a 43% chance."),
   ("South Carolina at fifty-eight", "South Carolina at 58¢, about 58%.")]),
 ("Prefer sportsbook odds? Flip the switch at the top, and every price turns into the odds you're familiar with.",
  [("Prefer", "Prefer sportsbook odds?"), ("Flip the switch", "Flip the switch at the top,"),
   ("and every price", "and every price turns into the odds you're familiar with.")]),
 ("Every market lands on the board with its price and HedgePredict's call.",
  [("Every market lands", "Every market lands on the board with its price and HedgePredict's call.")]),
 ("Every call is one of three. Wager, when a side looks too cheap. Lean, when it's a mild tilt. Or Skip, when the price looks about right. And each one shows how confident HedgePredict is.",
  [("Every call is", "Every call is one of three."), ("Wager, when", "Wager, when a side looks too cheap."),
   ("Lean, when", "Lean, when it's a mild tilt."), ("Or Skip", "Or Skip, when the price looks about right."),
   ("And each one", "And each one shows how confident HedgePredict is.")]),
 ("Want to dig deeper? Meet Hedge Lab, your personal betting sandbox. Drop in your bets, see every way your slip can land, lock in what you can, size it to your bankroll, or play it out a thousand times before you risk a dollar.",
  [("Want to dig", "Want to dig deeper?"), ("Meet Hedge Lab", "Meet Hedge Lab,"), ("your personal", "your personal betting sandbox."),
   ("Drop in", "Drop in your bets,"), ("see every way", "see every way your slip can land,"),
   ("lock in what", "lock in what you can,"), ("size it to", "size it to your bankroll,"),
   ("or play it out", "or play it out a thousand times"), ("before you risk", "before you risk a dollar.")]),
 ("And to stay a step ahead, The Daily sends the day's top pick to your inbox every weekday morning. It's free.",
  [("And to stay", "And to stay a step ahead,"), ("The Daily sends", "The Daily sends the day's top pick to your inbox"),
   ("every weekday", "every weekday morning. It's free.")]),
 ("Looking for something that isn't on the board? Search all of Polymarket, or just ask HedgePredict about any market.",
  [("Looking for", "Looking for something that isn't on the board?"), ("Search all", "Search all of Polymarket,"),
   ("or just ask", "or just ask HedgePredict about any market.")]),
 ("And if you'd rather stay in your own AI, connect HedgePredict to Claude, ChatGPT or any AI tool with one link, then just ask.",
  [("And if you'd", "And if you'd rather stay in your own AI,"), ("connect HedgePredict", "connect HedgePredict to Claude, ChatGPT"),
   ("or any AI tool", "or any AI tool with one link,"), ("then just ask", "then just ask.")]),
 ("So that's HedgePredict: you bring the plan, and we'll help you spot the value the market might be missing. Play smart, and go get 'em!",
  [("So that's", "So that's HedgePredict:"), ("you bring", "you bring the plan,"),
   ("and we'll help", "and we'll help you spot the value the market might be missing."), ("Play smart", "Play smart, and go get 'em!")]),
]
# Word-tied beats: (name, line index, spoken anchor, comment)
BEAT_DEFS = [("pct", 1, "Kentucky at forty-three", "Kentucky at forty-three cents…"), ("pct2", 1, "South Carolina at fifty-eight", "South Carolina at fifty-eight…"),
             ("us", 2, "every price", "every price turns into…"),
             ("cw", 4, "Wager, when", "Wager, when…"), ("cl", 4, "Lean, when", "Lean, when…"), ("cs", 4, "Or Skip", "Or Skip, when…"),
             ("sure", 4, "And each one", "And each one shows how confident…"),
             ("lab", 5, "your personal", "your personal betting sandbox…"), ("drop", 5, "Drop in", "Drop in your bets…"),
             ("map", 5, "see every way", "see every way…"), ("lock", 5, "lock in what", "lock in what you can…"),
             ("size", 5, "size it to", "size it to your bankroll…"), ("sim", 5, "or play it out", "or play it out…"),
             ("mail", 6, "The Daily sends", "The Daily sends…"), ("srch", 7, "Search all", "Search all of Polymarket…"), ("askhp", 7, "or just ask", "or just ask HedgePredict…"),
             ("conn", 8, "connect HedgePredict", "connect HedgePredict…"), ("apps", 8, "or any AI tool", "or any AI tool…"),
             ("paste", 8, "with one link", "with one link…"), ("ask", 8, "then just ask", "then just ask…")]

LINES = [l for l, _ in SCRIPT]
# The take's word timings are saved next to this script. Re-running with the same
# lines reuses them (no new recording), so beats and captions can be retimed for free.
# Pass --record to force a new take.
# Voices the tour can be recorded in (ElevenLabs). The player picks one with ?voice=NAME; the first is the default.
VOICES = {
    # Brielle: steadier, no style exaggeration (looser settings add laughs and breaths), a touch faster.
    "brielle": ("6u6JbqKdaQy89ENzLSju", {"stability": 0.6, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True, "speed": 1.03}),
    "helen": ("ImnfuV8oxhB7ya99oJfc", {"stability": 0.5, "similarity_boost": 0.8, "style": 0.1, "use_speaker_boost": True}),
    "liberty": ("iBo5PWT1qLiEyqhM7TrG", {"stability": 0.5, "similarity_boost": 0.8, "style": 0.1, "use_speaker_boost": True}),
}
NAME = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else next(iter(VOICES))
VOICE, VOICE_SETTINGS = VOICES[NAME]
CACHE = f"scripts/tour_alignment-{NAME}.json"
AUDIO = f"public/tour/tour-{NAME}.m4a"
# 0.85s between lines, a touch more after the two chat demos so their answers can be read.
LONG_AFTER = {7: "1.3s", 8: "1.0s"}
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
        try:
            res = urllib.request.urlopen(req, timeout=300, context=ctx)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"ElevenLabs {e.code}: {e.read()[:400]!r}")
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
        # Keep each raw part and its timestamps, so the take can be rebuilt later without new credits.
        os.makedirs(f"scripts/takes/{NAME}", exist_ok=True)
        open(f"scripts/takes/{NAME}/part{ci}.mp3", "wb").write(mp3)
        json.dump(a, open(f"scripts/takes/{NAME}/part{ci}.json", "w"))
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
        # End the part where the audio really goes quiet: the last timestamp can run early and clip the word.
        stop, k, win = int(aen[-1] * SR), int(aen[-1] * SR), int(0.02 * SR)
        while k + win < len(x):
            seg = x[k:k + win]
            if (sum(v * v for v in seg[::4]) / len(seg[::4])) ** 0.5 > 300: stop = k + win
            elif k - stop > int(0.2 * SR): break
            k += win
        out.extend(fade(x[int(seg_start * SR):min(len(x), stop + int(0.08 * SR))]))
        chars += a["characters"]
    w = wave.open(f"{tmp}/tour.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", f"{tmp}/tour.wav", AUDIO], check=True)
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

# Timing for the player: line starts, word-tied beats and captions, all in seconds.
os.makedirs("src/lib/tour", exist_ok=True)
json.dump({"audio": "/" + AUDIO.split("public/", 1)[1], "lineAt": line_at, "end": end,
           "beats": {n: v for n, v, _ in beats}, "caps": caps}, open(f"src/lib/tour/{NAME}.json", "w"), ensure_ascii=False, indent=1)
print("LINE_AT", line_at, "END", end); print("BEATS", beats); print(len(caps), "caption cues")
