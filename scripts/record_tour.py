"""Record the tour as one Helen take and regenerate TourPlayer's timing block
(line starts, word-tied beats, and YouTube-style caption cues)."""
import json, os, re, ssl, sys, base64, urllib.request

ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
key = [l.split("=", 1)[1].strip() for l in open(".env.local") if l.startswith("ELEVENLABS_API_KEY=")][0]

# Each line: (spoken text, [(spoken anchor, caption text), ...])
SCRIPT = [
 ("Hi! Welcome to HedgePredict. We read every market on Polymarket and flag the prices that look too cheap.",
  [("Hi! Welcome", "Hi! Welcome to HedgePredict."), ("We read", "We read every market on Polymarket"), ("and flag", "and flag the prices that look too cheap.")]),
 ("New to prediction markets? Each share pays a dollar if you're right. Buy at forty-three cents and win, and that's fifty-seven cents profit. The price is also the crowd's odds: about forty-three percent.",
  [("New to", "New to prediction markets?"), ("Each share pays", "Each share pays $1 if you're right."),
   ("Buy at", "Buy at 43¢ and win, and that's 57¢ profit."), ("The price is", "The price is also the crowd's odds: about 43%.")]),
 ("Used to sportsbook odds? Flip the switch at the top, and forty-three cents becomes plus one hundred thirty-three.",
  [("Used to", "Used to sportsbook odds?"), ("Flip the switch", "Flip the switch at the top,"),
   ("and forty-three cents becomes", "and 43¢ becomes +133.")]),
 ("Here's the board: every market, its price, and HedgePredict's call.",
  [("Here's the board", "Here's the board:"), ("every market", "every market, its price, and HedgePredict's call.")]),
 ("Every market gets one of three calls. The color shows HedgePredict's recommendation.",
  [("Every market gets", "Every market gets one of three calls."), ("The color", "The color shows HedgePredict's recommendation.")]),
 ("Each call says how sure it is, so you know how hard to lean on it.",
  [("Each call", "Each call says how sure it is,"), ("so you know", "so you know how hard to lean on it.")]),
 ("Already holding a bet? Hedge Lab shows how to lock in a result, either way.",
  [("Already holding", "Already holding a bet?"), ("Hedge Lab shows", "Hedge Lab shows how to lock in a result, either way.")]),
 ("Want the best pick without checking the board? Sign up for The Daily, our free newsletter. It sends the day's top pick to your inbox, weekday mornings.",
  [("Want the best", "Want the best pick without checking the board?"), ("Sign up", "Sign up for The Daily, our free newsletter."),
   ("It sends", "It sends the day's top pick to your inbox,"), ("weekday mornings", "weekday mornings.")]),
 ("Don't see your pick on the board? Search all of Polymarket from the search bar, or ask HedgePredict anything about any market.",
  [("Don't see", "Don't see your pick on the board?"), ("Search all", "Search all of Polymarket from the search bar,"),
   ("or ask", "or ask HedgePredict anything about any market.")]),
 ("You can also connect HedgePredict to Claude, ChatGPT, or any AI tool through our M C P. Paste one link, then just ask.",
  [("You can also", "You can also connect HedgePredict to Claude, ChatGPT,"), ("or any AI tool", "or any AI tool through our MCP."),
   ("Paste one link", "Paste one link,"), ("then just ask", "then just ask.")]),
 ("And that's HedgePredict! You bring the plan. We'll help you spot the value the market might be missing. Play smart, and go get 'em!",
  [("And that's", "And that's HedgePredict!"), ("You bring", "You bring the plan."),
   ("We'll help", "We'll help you spot the value the market might be missing."), ("Play smart", "Play smart, and go get 'em!")]),
]
# Word-tied beats: (name, line index, spoken anchor, comment)
BEAT_DEFS = [("pay", 1, "Each share pays", "Each share pays a dollar"), ("profit", 1, "Buy at", "Buy at forty-three cents"),
             ("pct", 1, "The price is", "The price is also the crowd's odds"), ("us", 2, "plus one", "plus one hundred thirty-three"),
             ("mail", 7, "Sign up", "Sign up for The Daily…"), ("srch", 8, "Search all", "Search all of Polymarket…"), ("askhp", 8, "or ask", "or ask HedgePredict…"),
             ("conn", 9, "connect HedgePredict", "connect HedgePredict…"), ("apps", 9, "or any AI tool", "or any AI tool…"),
             ("paste", 9, "Paste one link", "Paste one link…"), ("ask", 9, "then just ask", "then just ask…")]

LINES = [l for l, _ in SCRIPT]
# The take's word timings are saved next to this script. Re-running with the same
# lines reuses them (no new recording), so beats and captions can be retimed for free.
# Pass --record to force a new take.
CACHE = "scripts/tour_alignment.json"
# Helen - Warm, Balanced and Articulate (ElevenLabs). Changing it needs --record.
VOICE = "ImnfuV8oxhB7ya99oJfc"
# 0.9s between lines; a longer rest after the AI line so the on-screen answer can be read.
LONG_AFTER = {8: "2.2s", 9: "2.5s"}
text = "".join(ln + (f' <break time="{LONG_AFTER.get(i, "0.9s")}" /> ' if i < len(LINES) - 1 else "") for i, ln in enumerate(LINES))
cached = json.load(open(CACHE)) if os.path.exists(CACHE) else None
if cached and cached["text"] == text and "--record" not in sys.argv:
    al = cached["alignment"]
else:
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
        data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=300, context=ctx).read())
    open("public/tour/tour.mp3", "wb").write(base64.b64decode(d["audio_base64"]))
    al = d.get("normalized_alignment") or d["alignment"]
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
 "const START = LINE_AT.map((s, i) => (i === 0 ? 0 : Math.round(s * 1000) - LEAD));\n"
 "const TOTAL = Math.round(AUDIO_END * 1000) + 1500;\n"
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
