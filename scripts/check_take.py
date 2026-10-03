"""Flag sounds that aren't words in the tour take (laughs, breaths, trailing noises): any stretch
between or after words where the alignment says silence but the audio is loud. Also prints the length."""
import json, subprocess, tempfile, wave, array, os, sys
NAME = sys.argv[1] if len(sys.argv) > 1 else "brielle"
c = json.load(open(f"scripts/tour_alignment-{NAME}.json"))["alignment"]
ch, st, en = c["characters"], c["character_start_times_seconds"], c["character_end_times_seconds"]
tmp = os.path.join(tempfile.mkdtemp(), "t.wav")
subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", f"public/tour/tour-{NAME}.m4a", tmp], check=True)
w = wave.open(tmp); sr = w.getframerate(); a = array.array("h", w.readframes(w.getnframes()))
def rms(t0, t1):
    seg = a[int(t0 * sr):int(t1 * sr):3]
    return (sum(x * x for x in seg) / len(seg)) ** 0.5 if len(seg) else 0
speech = rms(0, len(a) / sr)
gaps = [(en[i - 1], st[i]) for i in range(1, len(ch)) if st[i] - en[i - 1] > 0.3] + [(en[-1], len(a) / sr)]
flags = []
for t0, t1 in gaps:
    for s in range(int((t0 + 0.08) * 10), int((t1 - 0.05) * 10)):
        r = rms(s / 10, s / 10 + 0.1)
        if r > speech * 0.35:
            flags.append(round(s / 10, 1)); break
print(f"length {len(a) / sr:.1f}s; non-word sounds at: {flags or 'none'}")
