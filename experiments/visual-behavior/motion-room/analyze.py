#!/usr/bin/env python3
"""Independent trace analysis. A two-seed pilot never establishes promotion."""
import argparse
import gzip
import hashlib
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path


def mean(values):
    values = list(values)
    return statistics.mean(values) if values else None


def quantile(values, fraction):
    values = sorted(values)
    return values[math.floor((len(values) - 1) * fraction)] if values else None


def distribution(values):
    values = list(values)
    return {"n": len(values), "mean": mean(values), "min": min(values) if values else None,
            "max": max(values) if values else None, "p95": quantile(values, .95)}


def wrap(value):
    return math.atan2(math.sin(value), math.cos(value))


def analyze(path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt") as stream:
        if path.suffix == ".gz":
            archive = json.load(stream)
            # The immutable server archive combines the header and completed
            # trial list; JSONL retains the append-only event representation.
            records = ([{"event": "start", "data": archive}]
                       + [{"event": "trial", "data": t} for t in archive["trials"]]
                       + ([{"event": "complete", "data": {}}] if archive.get("complete") else []))
        else:
            records = [json.loads(line) for line in stream if line.strip()]
    if not isinstance(records, list):
        raise ValueError("Use the retained physical JSONL event file")
    header = next(r["data"] for r in records if r["event"] == "start")
    if header.get("study") != "physical":
        raise ValueError("This analyzer requires a physical study")
    trials = [r["data"] for r in records if r["event"] == "trial"]
    complete = any(r["event"] == "complete" for r in records)
    by_key = {(t["id"], t["condition"]): t for t in trials}
    errors, rows, pairs, torque_checks = [], [], [], []
    if len(by_key) != len(trials):
        errors.append("Repeated trial identity")
    for t in trials:
        if t.get("failed"):
            errors.append(f"{t['id']}/{t['condition']}: {t.get('error')}")
            continue
        trace = t["trace"]
        frames = [r["frame"] for r in trace if r.get("frame")]
        if len(trace) != 200 or len(frames) != 100:
            errors.append(f"Incomplete body/retina coverage: {t['id']}/{t['condition']}")
        for r in trace:
            if abs(r["bodyTime"] - (2.02 + r["time"])) > 1e-7:
                errors.append(f"Body clock discontinuity: {t['id']}/{t['condition']}")
                break
        for f in frames:
            if abs(f["availableAt"] - f["captureTime"] - .04) > 1e-7:
                errors.append(f"Neural delay mismatch: {t['id']}/{t['condition']}")
                break
        condition = t["condition"]
        if condition.startswith("none") and any(abs(r["decision"]["angle"]) > 1e-12 for r in trace):
            errors.append(f"No-vision intervention leaked correction: {t['id']}/{condition}")
        if condition.endswith("dna") or condition.endswith("silenced"):
            if any(abs(r["body"]["command"][1] - r["neural"]["yaw"]) > 1e-9 for r in trace):
                errors.append(f"DNa route bypassed its actual neural output: {t['id']}/{condition}")
        initial_heading = t["initial"]["heading"]
        recomputed = sum(abs(wrap(r["body"]["heading"] - initial_heading - r["desiredHeading"])) * .02 for r in trace)
        if abs(recomputed - t["metrics"]["worldHeadingErrorIntegral"]) > 1e-9:
            errors.append(f"Stored heading score differs from trace: {t['id']}/{condition}")
        phase = [r for r in trace if .8 <= r["time"] < 2.4]
        costs = [c for f in frames for c in f["costs"]]
        row = {"id": t["id"], "condition": condition, "family": t["family"], "seed": t["seed"],
               "metrics": t["metrics"], "retinalCoverage": len(frames),
               "maxNeuralLeftRate": max(r["neural"]["left"] for r in trace),
               "maxNeuralRightRate": max(r["neural"]["right"] for r in trace),
               "meanAbsRequestedYaw": mean(abs(r["decision"]["yaw"]) for r in trace),
               "meanAbsActualNeuralYaw": mean(abs(r["neural"]["yaw"]) for r in trace),
               "directionalEvokedCommand": t["parameters"]["direction"] * mean(r["body"]["command"][1] for r in phase),
               "directionalEvokedNeuralYaw": t["parameters"]["direction"] * mean(r["neural"]["yaw"] for r in phase),
               "predictionDisagreementMAE": mean(abs(f["predictions"]["flyvis"] - f["predictions"]["conventional"]) for f in frames),
               "neuralEyeAvailableFraction": mean(float(f["available"] and f["gradientRms"] >= header["calibration"]["minimumGradient"]) for r in frames for f in r["neuralFlows"]),
               "fullCoreMsPerEye40msInterval": distribution(c["coreMs"] for c in costs),
               "extractionMsPerEye40msInterval": distribution(c["extractionMs"] for c in costs),
               "conventionalMsPerEye40msInterval": distribution(c["conventionalMs"] for c in costs),
               "maxAbsDecodedFlyvisRate": max(abs(f["predictions"]["flyvis"]) for f in frames),
               "maxAbsDecodedConventionalRate": max(abs(f["predictions"]["conventional"]) for f in frames)}
        rows.append(row)
        if t["family"] == "perturbation" and condition.startswith("none"):
            reference = by_key.get((f"panorama-{t['seed']}", condition))
            if reference and not reference.get("failed"):
                # With visual correction disabled, the panorama case is a matched
                # no-torque body control. Do not count natural gait drift as an
                # effective physical disturbance.
                delta = [wrap(a["body"]["heading"] - b["body"]["heading"]) for a, b in zip(trace, reference["trace"]) if a["time"] >= .8]
                pulse = [r for r in trace if abs(r["torque"]) > 0]
                torque_checks.append({"id": t["id"], "condition": condition, "reference": reference["id"],
                                      "sameInitialBody": t["initial"] == reference["initial"],
                                      "pulseBodyTicks": len(pulse), "pulseDuration": len(pulse) * .02,
                                      "actualTorqueIntegral": sum(r["torque"] * .02 for r in pulse),
                                      "maxHeadingDifferenceFromNoTorque": max(map(abs, delta)),
                                      "finalHeadingDifferenceFromNoTorque": delta[-1],
                                      "disturbanceAboveNoiseMinimum": max(map(abs, delta)) >= .02})
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["family"], row["condition"])].append(row)
    aggregates = []
    for (family, condition), group in grouped.items():
        metric_names = ["worldHeadingErrorIntegral", "panoramaTrackingErrorIntegral", "directionalHeadingChange", "falls", "collisions", "maxTilt"]
        aggregates.append({"family": family, "condition": condition, "trials": len(group),
                           "metrics": {key: distribution(r["metrics"][key] for r in group) for key in metric_names},
                           "directionalEvokedCommand": distribution(r["directionalEvokedCommand"] for r in group),
                           "predictionDisagreementMAE": distribution(r["predictionDisagreementMAE"] for r in group)})
    for t in trials:
        if t.get("failed") or not t["condition"].startswith("flyvis"):
            continue
        route = "direct" if t["condition"].endswith("direct") else "dna"
        if t["condition"].endswith("silenced"):
            continue
        for reference in [f"conventional-{route}", f"none-{route}"]:
            other = by_key.get((t["id"], reference))
            if not other or other.get("failed"):
                continue
            baseline = by_key.get((t["id"], f"none-{route}"))
            valid_disturbance = None if t["family"] != "perturbation" else bool(baseline and baseline.get("metrics", {}).get("postDisturbancePeakError", 0) >= .02)
            pairs.append({"id": t["id"], "candidate": t["condition"], "reference": reference,
                          "family": t["family"], "sameInitialBody": t["initial"] == other["initial"],
                          "disturbanceMeasurableInNoVision": valid_disturbance,
                          "headingErrorIntegralDifference": t["metrics"]["worldHeadingErrorIntegral"] - other["metrics"]["worldHeadingErrorIntegral"],
                          "panoramaErrorIntegralDifference": t["metrics"]["panoramaTrackingErrorIntegral"] - other["metrics"]["panoramaTrackingErrorIntegral"],
                          "directionalHeadingChangeDifference": t["metrics"]["directionalHeadingChange"] - other["metrics"]["directionalHeadingChange"],
                          "fallsDifference": t["metrics"]["falls"] - other["metrics"]["falls"]})
    return {"format": "duckfly-motion-room-independent-analysis", "version": 1,
            "source": str(path), "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "analyzerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "expectedTrials": header["expectedTrials"], "retainedTrials": len(trials), "completeEvent": complete,
            "executionComplete": complete and len(trials) == header["expectedTrials"] and not errors,
            "integrityErrors": errors, "calibrationRun": header["calibration"]["run"],
            "seeds": header["seeds"], "promotion": False,
            "claimBoundary": "Paired physical pilot only. No confidence-backed advantage or ordinary scene integration is established. Sources are preserved in the immutable run archive.",
            "latencyBoundary": "All models run in shadow; elapsed trial time cannot compare product throughput. Component timing is reported on these actual frames.",
            "torqueIsolation": torque_checks, "aggregates": aggregates, "pairs": pairs, "trials": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("run", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = analyze(args.run)
    output = args.output or args.run.with_name(args.run.stem + "-analysis.json")
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: result[k] for k in ["retainedTrials", "expectedTrials", "completeEvent", "executionComplete", "integrityErrors", "promotion"]}))
