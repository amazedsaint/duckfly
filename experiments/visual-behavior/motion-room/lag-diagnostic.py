#!/usr/bin/env python3
"""Post-hoc camera-yaw timing diagnosis. No controller or held-out fitting."""
import gzip
import hashlib
import json
import math
from pathlib import Path

base = Path(__file__).resolve().parent / "reports"
paths = {"neuralReplay": base / "aperture-v2-replay-diagnostic-1.json.gz", "cameraReconstruction": base / "camera-pose-reconstruction-v1.json.gz"}
data = {k: json.loads(gzip.decompress(p.read_bytes())) for k, p in paths.items()}
replay = data["neuralReplay"]
poses = {t["id"]: t["frames"] for t in data["cameraReconstruction"]["trials"]}
decoder = replay["decoder"]
wrap = lambda x: math.atan2(math.sin(x), math.cos(x))
mean = lambda values: sum(values) / len(values)
results = []
for trial in replay["trials"]:
    if trial["source"] != "physical":
        continue
    frames = poses[trial["id"]]
    headings, pitches = [], []
    for frame in frames:
        h, p = [], []
        for eye in frame["eyes"]:
            x, y, z, w = eye["quaternion"]
            forward = (-2 * (x*z + w*y), -2 * (y*z - w*x), -(1 - 2 * (x*x + y*y)))
            h.append(math.atan2(-forward[2], forward[0]))
            p.append(math.asin(max(-1, min(1, forward[1]))))
        headings.append(h)
        pitches.append(p)
    truth = [None] + [(frames[i]["panoramaAngle"] - frames[i-1]["panoramaAngle"] - mean([wrap(headings[i][j]-headings[i-1][j]) for j in range(2)])) / .04 for i in range(1, len(frames))]
    series = {k: [r["originalPredictions"][k] for r in trial["rows"]] for k in ["flyvis", "conventional"]}
    series["candidate"] = [decoder["weights"][0] + decoder["weights"][1] * (r["flyvis"][0] - decoder["mean"][0]) / decoder["scale"][0] for r in trial["rows"]]
    curves = {}
    for key, values in series.items():
        curve = []
        for lag in range(-6, 7):
            pairs = [(values[i], truth[i-lag]) for i in range(5, len(values)) if 5 <= i-lag < len(values)]
            mx, my = mean([x for x, y in pairs]), mean([y for x, y in pairs])
            covariance = sum((x-mx)*(y-my) for x, y in pairs)
            denominator = math.sqrt(sum((x-mx)**2 for x, y in pairs) * sum((y-my)**2 for x, y in pairs))
            curve.append({"lagFrames": lag, "pairs": len(pairs), "mae": mean([abs(x-y) for x, y in pairs]), "correlation": covariance/denominator if denominator else None})
        curves[key] = curve
    relative_yaw = [wrap(headings[i][0] - f["trunk"]["heading"]) for i, f in enumerate(frames)]
    height = [f["eyes"][0]["position"][1] for f in frames]
    results.append({"id": trial["id"], "curves": curves,
                    "envelope": {"headRelativeYawRangeRadians": max(relative_yaw)-min(relative_yaw),
                                 "leftPitchRangeRadians": max(p[0] for p in pitches)-min(p[0] for p in pitches),
                                 "leftHeightRangeMeters": max(height)-min(height)},
                    "frames": [{"frameId": f["frameId"], "captureTime": f["captureTime"], "time": f["time"], "panoramaAngle": f["panoramaAngle"],
                                "cameraWorldYaw": headings[i], "cameraPitch": pitches[i], "cameraYawRelativeSceneRate": truth[i],
                                "decoded": {k: v[i] for k, v in series.items()}} for i, f in enumerate(frames)]})
result = {"format": "duckfly-camera-yaw-lag-diagnostic", "version": 1,
          "interpretation": "Post-hoc diagnosis only. Positive lag compares current neural output to earlier reconstructed camera motion. Scalar head yaw still omits pitch/roll and translation optical effects; periodic gait can alias lag. No controller was fitted or changed.",
          "sources": {k: {"path": str(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for k, p in paths.items()},
          "scriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "results": results}
(base / "camera-yaw-lag-diagnostic.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"trajectories": len(results), "frames": sum(len(t["frames"]) for t in results), "bestLags": {t["id"]: {k: min(v, key=lambda r: r["mae"])["lagFrames"] for k, v in t["curves"].items()} for t in results}}))
