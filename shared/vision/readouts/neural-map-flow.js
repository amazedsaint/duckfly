import { SPATIAL_MODEL_PIN, SPATIAL_POPULATIONS } from './spatial.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Engineering motion readout of signed neural maps, not an HS/VS cell model.
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
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([u, v]) => byCoordinate.get(`${cell.u + u},${cell.v + v}`));
      if (neighbors.some(i => i === undefined)) continue;
      const [a, b, c, d] = neighbors.map(i => cells[i]);
      const ex = (a.azimuth - b.azimuth) / 2, ey = (a.elevation - b.elevation) / 2;
      const fx = (c.azimuth - d.azimuth) / 2, fy = (c.elevation - d.elevation) / 2;
      const determinant = ex * fy - ey * fx;
      if (Math.abs(determinant) < 1e-8) throw Error('Degenerate neural spatial coordinates');
      points.push({ index, neighbors, ex, ey, fx, fy, determinant });
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
        const [a, b, c, d] = point.neighbors;
        const alongE = (after[a] + before[a] - after[b] - before[b]) / 4;
        const alongF = (after[c] + before[c] - after[d] - before[d]) / 4;
        const gx = (alongE * point.fy - point.ey * alongF) / point.determinant;
        const gy = (point.ex * alongF - alongE * point.fx) / point.determinant;
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
    // Ridge relative to the tensor scale keeps the aperture solution bounded.
    // For a single edge this is normal motion, not an observed tangent component.
    const ridge = trace * 1e-4, determinant = (xx + ridge) * (yy + ridge) - xy * xy;
    const x = (xy * yt - (yy + ridge) * xt) / determinant;
    const y = (xy * xt - (xx + ridge) * yt) / determinant;
    const speed = Math.hypot(x, y);
    const residual = samples.reduce((sum, [gx, gy, temporal]) => sum + (temporal + gx * x + gy * y) ** 2, 0);
    const explained = tt > 1e-16 ? Math.max(0, Math.min(1, 1 - residual / tt)) : 0;
    const rawVelocity = { x, y }, direction = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const aperture = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy) / trace;
    const available = explained >= minimumExplained && speed <= maximumSpeed;
    return {
      available, reason: available ? 'spatial-temporal-fit' : speed > maximumSpeed ? 'unbounded-motion-fit' : 'temporal-change-not-explained-by-motion',
      velocity: available ? rawVelocity : null, speed: available ? speed : null, direction: available ? direction : null,
      rawVelocity, rawSpeed: speed, rawDirection: direction, explained, aperture,
      ...diagnostics, units: 'image degrees per neural second',
      interpretation: 'Minimum-norm neural response-pattern motion. A single oriented pattern does not reveal tangent motion. No body or HS/VS mapping is implied.',
    };
  }

  return Object.freeze({ estimate, populationOrder: SPATIAL_POPULATIONS, radiusDegrees, maxGapSeconds });
}
