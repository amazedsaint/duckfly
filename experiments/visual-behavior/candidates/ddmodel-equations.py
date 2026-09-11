"""Independent equation implementation for checking the published DD computation.

Reference: Tanaka & Clark 2020, doi:10.1016/j.cub.2020.04.068;
ClarkLabCode/DDModel commit c98d06aae1c16b3ad7ed92c609a6b43c617a296a.
No upstream source is vendored. Exact numerical equivalence requires the separate
original-code oracle; resemblance between our own implementations is not that test.
"""
from pathlib import Path
import json
import numpy as np
from scipy.signal import fftconvolve
from scipy.ndimage import convolve1d
from scipy.io import loadmat

SETTINGS = dict(frame_rate=180, duration_seconds=10, shift_seconds=-2,
                highpass_ms=200, center_sigma_degrees=5, surround_sigma_degrees=15,
                surround_weight=3.5, adaptation_ms=300, adaptation_gain=1000,
                pooling_sigma_degrees=10, pooling_ms=300, spacing_degrees=5)


def load_epochs(folder):
    """Match MATLAB csvread zero-filling of short interleave rows, then epoch cuts."""
    folder = Path(folder)
    rows = [np.fromstring(line.rstrip(',\r\n'), sep=',')
            for line in (folder / 'xtPlot.xtp').read_text().splitlines()]
    table = np.zeros((len(rows), max(map(len, rows)) + 1), dtype=np.float64)
    for i, row in enumerate(rows):
        table[i, :len(row)] = row
    ids = table[:, 2]
    starts = np.flatnonzero(np.diff(ids) > 0) + 1
    ends = np.flatnonzero(np.diff(ids) < 0) + 1
    initial = starts[0]
    lengths = ends - starts
    width, height = table[0, 3:5].astype(int)
    names = np.atleast_1d(loadmat(folder / 'epochNames.mat', squeeze_me=True)['epochNames']).tolist()
    result = []
    for i in range(int(ids.max()) - 1):
        start = int(lengths[:i].sum() + initial * (i + 1))
        samples = table[start:start + lengths[i], 5:-1]
        result.append((str(names[i]), samples.reshape((-1, height, width)).transpose(1, 2, 0)))
    return result


def temporal_convolution(array, kernel, length):
    return fftconvolve(array, kernel[None, None, :], mode='full', axes=2)[:, :, :length]


def dd_response(contrast, *, settings=SETTINGS, adaptation=True, surround=True, retain_stages=False):
    """Response to Y×X×T contrast with published 5-degree / 180-Hz semantics.

    Periodic output pooling and the reference's explicit spatial padding are
    intentional. Boundary changes require a new model identity and comparison.
    """
    s = settings
    height, width, length = contrast.shape
    if not np.isfinite(contrast).all() or length != round(s['duration_seconds'] * s['frame_rate']):
        raise ValueError('Expected finite, full-duration contrast movie')
    milliseconds = np.linspace(1, s['duration_seconds'] * 1000, length)
    rate = s['frame_rate']

    def norm(kernel):
        return kernel / np.sqrt(np.square(kernel).sum() / rate)

    tau = s['highpass_ms']
    hp = norm((tau - milliseconds) * np.exp(-milliseconds / tau) / tau ** 2)
    hp = hp[milliseconds <= 10 * tau]
    highpass = temporal_convolution(contrast, hp, length) / rate
    rectified = np.abs(highpass)

    spacing = s['spacing_degrees']
    radius = np.ceil(s['surround_sigma_degrees'] / spacing) * spacing * 3
    coordinates = np.arange(-radius, radius + spacing / 2, spacing)
    x, y = np.meshgrid(coordinates, coordinates)
    gaussian = lambda sigma: np.exp(-(x * x + y * y) / (2 * sigma * sigma)) / (2 * np.pi * sigma * sigma)
    kernel = gaussian(s['center_sigma_degrees']) - (s['surround_weight'] if surround else 0) * gaussian(s['surround_sigma_degrees'])
    kernel /= np.sqrt(np.square(kernel).sum() * spacing ** 2)

    # Reproduce the upstream padding exactly, including its unusual top/bottom
    # middle blocks. Replacing it with standard reflection is a different model.
    flip_x, flip_both = rectified[:, ::-1, :], rectified[::-1, ::-1, :]
    padded = np.concatenate((np.concatenate((flip_both, flip_x, flip_both), axis=1),
                             np.concatenate((flip_x, rectified, flip_x), axis=1),
                             np.concatenate((flip_both, flip_x, flip_both), axis=1)), axis=0)
    center_surround = np.empty_like(rectified)
    for start in range(0, length, 64):
        end = min(length, start + 64)
        filtered = fftconvolve(padded[:, :, start:end], kernel[:, :, None], mode='same', axes=(0, 1))
        center_surround[:, :, start:end] = np.maximum(0, filtered[height:height * 2, width:width * 2, :] * spacing ** 2)
    del padded

    tau = s['adaptation_ms']
    adaptation_kernel = norm(milliseconds * np.exp(-milliseconds / tau) / tau ** 2)
    q = temporal_convolution(center_surround, adaptation_kernel, length) / rate
    adapted = center_surround / (1 + (s['adaptation_gain'] if adaptation else 0) * q)

    sigma = s['pooling_sigma_degrees']
    extent = int(np.ceil(sigma / spacing) * spacing * 3)
    axis = np.arange(-extent, extent + spacing / 2, spacing)
    spatial = np.exp(-axis ** 2 / (2 * sigma ** 2)) / np.sqrt(2 * np.pi * sigma ** 2)
    pooled = convolve1d(adapted, spatial, axis=1, mode='wrap') * spacing
    pooled = convolve1d(pooled, spatial, axis=0, mode='wrap') * spacing / rate
    tau = s['pooling_ms']
    lowpass = norm(milliseconds * np.exp(-milliseconds / tau) / tau ** 2)
    lowpass = lowpass[milliseconds <= 10 * tau]
    output = temporal_convolution(pooled, lowpass, length)
    result = {'Rout': output}
    if retain_stages:
        result.update(S=contrast, RHP=highpass, Rrect=rectified, RCS=center_surround, Q=q, Radapt=adapted)
    return result


def published_epoch(samples, trim=(22, 22)):
    height, width, frames = samples.shape
    contrast = np.zeros((height, width, 1800), dtype=np.float64)
    contrast[:, :, 360:360 + frames] = (samples - 8) / 8
    # MATLAB round is half-away-from-zero. Trimming offsets are non-negative.
    oy = int(np.floor((height - trim[0]) / 2 + .5)); ox = int(np.floor((width - trim[1]) / 2 + .5))
    return contrast[oy:oy + trim[0], ox:ox + trim[1], :]


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('folder')
    parser.add_argument('output')
    args = parser.parse_args()
    traces = []
    for name, samples in load_epochs(args.folder):
        output = dd_response(published_epoch(samples))['Rout']
        # MATLAB's round(size/2) is one-based; for 22 this is Python index10.
        center = output[(output.shape[0] - 1) // 2, (output.shape[1] - 1) // 2, :]
        traces.append({'name': name, 'mean': float(center.mean()), 'peak': float(center.max()), 'trace': center.tolist()})
        print(name, traces[-1]['mean'], traces[-1]['peak'], flush=True)
    Path(args.output).write_text(json.dumps({'settings': SETTINGS, 'traces': traces}))
