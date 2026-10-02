"""Record the tour as one Liberty take and regenerate TourPlayer's timing block
(line starts, word-tied beats, and YouTube-style caption cues)."""
import json, re, ssl, base64, urllib.request

ctx = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
key = [l.split("=", 1)[1].strip() for l in open(".env.local") if l.startswith("ELEVENLABS_API_KEY=")][0]

# Each line: (spoken text, [(spoken anchor, caption text), ...])
SCRIPT = [
 ("Hi! Welcome to HedgePredict. Here's how it works.",
  [("Hi! Welcome", "Hi! Welcome to HedgePredict."), ("Here's how", "Here's how it works.")]),
 ("Quick refresher if you're new: every market is a simple yes-or-no question. Each share pays one dollar if you're right, and nothing if you're not. So if you buy at forty-three cents and win, you make fifty-seven cents per share. And that price means the crowd sees about a forty-three percent chance.",
  [("Quick refresher", "Quick refresher if you're new:"), ("every market", "every market is a simple yes-or-no question."),
   ("Each share pays", "Each share pays $1 if you're right, and nothing if you're not."),
   ("So if you buy", "So if you buy at 43¢ and win, you make 57¢ per share."),
   ("And that price", "And that price means the crowd sees about a 43% chance.")]),
 ("Used to sportsbook odds? Flip the switch at the top to see American odds instead, so forty-three cents becomes plus one thirty-three. Your sportsbook's line might be a little different, so treat it as a guide.",
  [("Used to", "Used to sportsbook odds?"), ("Flip the switch", "Flip the switch at the top to see American odds instead,"),
   ("so forty-three cents becomes", "so 43¢ becomes +133."), ("Your sportsbook", "Your sportsbook's line might be a little different,"),
   ("so treat it", "so treat it as a guide.")]),
 ("HedgePredict reads every market on the board, and checks whether the price looks too cheap.",
  [("HedgePredict reads", "HedgePredict reads every market on the board,"), ("and checks", "and checks whether the price looks too cheap.")]),
 ("Every market gets one of three calls. The color shows HedgePredict's recommendation.",
  [("Every market gets", "Every market gets one of three calls."), ("The color", "The color shows HedgePredict's recommendation.")]),
 ("Each call says how sure it is, so you know how hard to lean on it.",
  [("Each call", "Each call says how sure it is,"), ("so you know", "so you know how hard to lean on it.")]),
 ("Already holding a bet? Hedge Lab shows how to lock in a result, either way.",
  [("Already holding", "Already holding a bet?"), ("Hedge Lab shows", "Hedge Lab shows how to lock in a result, either way.")]),
 ("The Daily sends the day's best pick to your inbox, weekday mornings.",
  [("The Daily sends", "The Daily sends the day's best pick to your inbox,"), ("weekday mornings", "weekday mornings.")]),
 ("Use HedgePredict inside Claude, ChatGPT, or any AI of your choice through our M C P server. Just ask in plain English.",
  [("Use HedgePredict", "Use HedgePredict inside Claude, ChatGPT,"), ("or any AI", "or any AI of your choice through our MCP server."),
   ("Just ask", "Just ask in plain English.")]),
 ("And that's HedgePredict! You make the call, and we'll help you see what the prices are really saying. Play smart, and go get 'em.",
  [("And that's", "And that's HedgePredict!"), ("You make the call", "You make the call, and we'll help you see what the prices are really saying."),
   ("Play smart", "Play smart, and go get 'em.")]),
]
# Word-tied beats: (name, line index, spoken anchor, comment)
BEAT_DEFS = [("pay", 1, "Each share pays", "Each share pays one dollar"), ("profit", 1, "So if you buy", "So if you buy at forty-three cents"),
             ("pct", 1, "And that price", "And that price means…"), ("us", 2, "plus one", "plus one thirty-three"),
             ("note", 2, "Your sportsbook", "Your sportsbook's line…")]

LINES = [l for l, _ in SCRIPT]
text = ' <break time="0.9s" /> '.join(LINES)
body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
    "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.2, "use_speaker_boost": True}}).encode()
req = urllib.request.Request("https://api.elevenlabs.io/v1/text-to-speech/iBo5PWT1qLiEyqhM7TrG/with-timestamps?output_format=mp3_44100_128",
    data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
d = json.loads(urllib.request.urlopen(req, timeout=300, context=ctx).read())
open("public/tour/tour.mp3", "wb").write(base64.b64decode(d["audio_base64"]))
al = d.get("normalized_alignment") or d["alignment"]
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
