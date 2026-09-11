import { SPATIAL_MODEL_PIN, SPATIAL_POPULATIONS } from './spatial.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Engineering motion readout of signed neural maps, not an HS/VS cell model.
 * V2: symmetric fourth-order hex derivatives and explicit aperture observability.
 * A translated response pattern obeys dA/dt + velocity dot gradient(A) = 0.
 * Removing each population's spatially common temporal change prevents a
 * uniform brightness transient alone from satisfying that motion equation.
 */
export function createNeuralMapFlow(metadata, { radiusDegrees = 20, maxGapSeconds = .061 } = {}) {
  if (metadata?.model?.manifestCanonicalSha256 !== SPATIAL_MODEL_PIN.manifestCanonicalSha256 ||
      metadata?.coordinateSystem?.frame !== 'eye-relative' || !finite(radiusDegrees) || radiusDegrees <= 0 || radiusDegrees > 25 ||
      !finite(maxGapSeconds) || maxGapSeconds <= 0) throw Error('Invalid neural-map flow geometry or model');
  const layout = SPATIAL_POPULATIONS.map(type => {
    const cells = metadata.populations[type]?.coordinates;
    if (!Array.isArray(cells) || cells.length !== 721) throw Error(`Invalid ${type} spatial layout`);
    const byCoordinate = new Map(cells.map((cell, i) => [`${cell.u},${cell.v}`, i]));
    const points = [];
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      if (![cell.u, cell.v, cell.azimuth, cell.elevation].every(finite)) throw Error('Non-finite neural coordinate');
      if (Math.hypot(cell.azimuth, cell.elevation) > radiusDegrees) continue;
      const axes = [[1, 0], [0, 1], [1, -1]].map(([u, v]) => {
        const neighbors = [-2, -1, 1, 2].map(scale => byCoordinate.get(`${cell.u + scale * u},${cell.v + scale * v}`));
        if (neighbors.some(i => i === undefined)) return null;
        const a = cells[neighbors[2]], b = cells[neighbors[1]];
        return { neighbors, x: (a.azimuth - b.azimuth) / 2, y: (a.elevation - b.elevation) / 2 };
      });
      if (axes.some(axis => axis === null)) continue;
      const xx = axes.reduce((sum, axis) => sum + axis.x ** 2, 0);
      const xy = axes.reduce((sum, axis) => sum + axis.x * axis.y, 0);
      const yy = axes.reduce((sum, axis) => sum + axis.y ** 2, 0);
      const determinant = xx * yy - xy * xy;
      if (Math.abs(determinant) < 1e-8) throw Error('Degenerate neural spatial coordinates');
      points.push({ index, axes, xx, xy, yy, determinant });
    }
    if (points.length < 20) throw Error('Insufficient spatial neighborhood');
    return { type, points };
  });

  function validate(frame) {
    if (!frame || frame.modelId !== metadata.model.id || frame.checkpointSha256 !== metadata.model.checkpointSha256 ||
        !finite(frame.neuralEndTime) || !finite(frame.captureTime) || !Number.isSafeInteger(frame.frameId)) {
      throw Error('Invalid neural response identity or clock');
    }
    for (const { type } of layout) {
      const values = frame.populations?.[type]?.raw;
      if ((!Array.isArray(values) && !(values instanceof Float32Array)) || values.length !== 721 || !values.every(finite)) {
        throw Error(`Invalid signed ${type} map`);
      }
    }
  }

  function estimate(previous, current, { minimumGradient = 0, minimumExplained = .2, maximumSpeed = 360 } = {}) {
    validate(previous); validate(current);
    if (![minimumGradient, minimumExplained, maximumSpeed].every(finite) || minimumGradient < 0 ||
        minimumExplained < 0 || minimumExplained > 1 || maximumSpeed <= 0) throw Error('Invalid neural flow threshold');
    const dt = current.neuralEndTime - previous.neuralEndTime;
    const unavailable = reason => ({ available: false, reason, velocity: null, speed: null, direction: null, dt });
    if (['duckId', 'eyeId', 'sourceId', 'baselineId', 'clock'].some(key => !current[key] || current[key] !== previous[key])) return unavailable('history-identity-changed');
    if (current.frameId <= previous.frameId || current.captureTime <= previous.captureTime) return unavailable('no-fresh-image');
    if (dt <= 0 || dt > maxGapSeconds) return unavailable('neural-history-gap');
    let xx = 0, xy = 0, yy = 0, xt = 0, yt = 0, tt = 0, commonEnergy = 0, count = 0;
    const samples = [];
    for (const { type, points } of layout) {
      const before = previous.populations[type].raw, after = current.populations[type].raw;
      const meanChange = points.reduce((sum, point) => sum + (after[point.index] - before[point.index]) / dt, 0) / points.length;
      commonEnergy += meanChange * meanChange;
      for (const point of points) {
        let alongX = 0, alongY = 0;
        for (const axis of point.axes) {
          const [a, b, c, d] = axis.neighbors;
          const derivative = (after[a] + before[a] - 8 * (after[b] + before[b]) + 8 * (after[c] + before[c]) - after[d] - before[d]) / 24;
          alongX += axis.x * derivative; alongY += axis.y * derivative;
        }
        const gx = (alongX * point.yy - point.xy * alongY) / point.determinant;
        const gy = (point.xx * alongY - alongX * point.xy) / point.determinant;
        const temporal = (after[point.index] - before[point.index]) / dt - meanChange;
        xx += gx * gx; xy += gx * gy; yy += gy * gy;
        xt += gx * temporal; yt += gy * temporal; tt += temporal * temporal;
        samples.push([gx, gy, temporal]); count++;
      }
    }
    const trace = xx + yy, gradientRms = Math.sqrt(trace / count);
    const commonModeTemporalRms = Math.sqrt(commonEnergy / layout.length), temporalRms = Math.sqrt(tt / count);
    const diagnostics = { gradientRms, temporalRms, commonModeTemporalRms, samples: count, dt };
    if (trace < 1e-16 || gradientRms < minimumGradient) return { ...unavailable('insufficient-spatial-signal'), ...diagnostics };
    // A near-rank-one pattern does not observe tangential motion. Discard that
    // unobservable eigenmode instead of amplifying tiny modeling differences.
    const separation = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy);
    const major = (trace + separation) / 2, minor = Math.max(0, (trace - separation) / 2);
    const minorToMajorEigenRatio = minor / major;
    const axisAngle = Math.atan2(2 * xy, xx - yy) / 2, ux = Math.cos(axisAngle), uy = Math.sin(axisAngle);
    const normal = -(ux * xt + uy * yt) / major;
    const tangentObserved = minorToMajorEigenRatio >= .05;
    const tangent = tangentObserved ? -(-uy * xt + ux * yt) / minor : 0;
    const x = normal * ux - tangent * uy, y = normal * uy + tangent * ux;
    const speed = Math.hypot(x, y);
    const residual = samples.reduce((sum, [gx, gy, temporal]) => sum + (temporal + gx * x + gy * y) ** 2, 0);
    const explained = tt > 1e-16 ? Math.max(0, Math.min(1, 1 - residual / tt)) : 0;
    const rawVelocity = { x, y }, direction = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const aperture = separation / trace;
    const available = explained >= minimumExplained && speed <= maximumSpeed;
    return {
      available, reason: available ? 'spatial-temporal-fit' : speed > maximumSpeed ? 'unbounded-motion-fit' : 'temporal-change-not-explained-by-motion',
      velocity: available ? rawVelocity : null, speed: available ? speed : null, direction: available ? direction : null,
      rawVelocity, rawSpeed: speed, rawDirection: direction, explained, aperture,
      observedRank: tangentObserved ? 2 : 1, tangentObserved, minorToMajorEigenRatio,
      normalAxis: { x: ux, y: uy }, normalVelocity: normal,
      ...diagnostics, units: 'image degrees per neural second',
      interpretation: 'Observed normal flow; tangential flow is only included when the minor eigenmode is resolved. Minimum-norm rank-one velocity does not imply physical tangent speed is zero. No body or HS/VS mapping is implied.',
    };
  }

  return Object.freeze({ estimate, populationOrder: SPATIAL_POPULATIONS, radiusDegrees, maxGapSeconds });
}
