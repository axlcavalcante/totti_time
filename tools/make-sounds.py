#!/usr/bin/env python3
"""Regenerates the DEFAULT notification sounds in ../sounds/ (dev tool only).

The game never synthesizes audio: it plays whatever files are in sounds/.
Run this only to restore the defaults:  python3 tools/make-sounds.py
Output: 16-bit mono 22050 Hz WAV (decodes on every old Android).
"""
import math
import os
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sounds')


def note_hz(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3,
             'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    octave = int(name[-1])
    return 440.0 * 2 ** ((names[name[:-1]] + (octave - 4) * 12) / 12.0)


def buf(seconds):
    return [0.0] * int(RATE * seconds)


def env(i, n, attack, release):
    a = int(attack * RATE)
    r = int(release * RATE)
    if i < a:
        return i / float(a)
    if i > n - r:
        return max(0.0, (n - i) / float(r))
    return 1.0


def add_bell(out, start, hz, length, amp):
    """Soft bell: sine + inharmonic partials, exponential decay."""
    s0 = int(start * RATE)
    n = int(length * RATE)
    partials = [(1.0, 1.0, 3.0), (2.76, 0.35, 5.0), (5.4, 0.15, 8.0), (2.0, 0.2, 4.0)]
    for i in range(n):
        if s0 + i >= len(out):
            break
        t = i / float(RATE)
        v = 0.0
        for mult, a, decay in partials:
            v += a * math.sin(2 * math.pi * hz * mult * t) * math.exp(-decay * t)
        out[s0 + i] += amp * v * env(i, n, 0.004, 0.05)


def add_pulse(out, start, hz, length, amp, duty=0.5, vibrato=0.0):
    """Chiptune square/pulse note with a tiny attack/release (no clicks)."""
    s0 = int(start * RATE)
    n = int(length * RATE)
    phase = 0.0
    for i in range(n):
        if s0 + i >= len(out):
            break
        t = i / float(RATE)
        f = hz * (1 + vibrato * math.sin(2 * math.pi * 6 * t))
        phase = (phase + f / RATE) % 1.0
        v = 1.0 if phase < duty else -1.0
        out[s0 + i] += amp * v * env(i, n, 0.005, 0.03)


def add_tri(out, start, hz, length, amp, vibrato=0.0):
    s0 = int(start * RATE)
    n = int(length * RATE)
    phase = 0.0
    for i in range(n):
        if s0 + i >= len(out):
            break
        t = i / float(RATE)
        f = hz * (1 + vibrato * math.sin(2 * math.pi * 6 * t))
        phase = (phase + f / RATE) % 1.0
        v = 4 * abs(phase - 0.5) - 1
        out[s0 + i] += amp * v * env(i, n, 0.005, 0.08)


def write(name, samples, peak=0.6):
    m = max(abs(x) for x in samples) or 1.0
    k = peak / m
    path = os.path.join(OUT, name)
    w = wave.open(path, 'wb')
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * k)) * 32767)) for x in samples))
    w.close()
    print('wrote', os.path.relpath(path))


def bells():
    out = buf(1.4)
    add_bell(out, 0.00, note_hz('E6'), 1.4, 0.5)   # ding
    add_bell(out, 0.35, note_hz('C6'), 1.05, 0.5)  # dong
    return out


def hurry():
    out = buf(0.95)
    notes = ['A5', 'C#6', 'E6']
    t = 0.0
    for rep in range(2):
        for nm in notes:
            add_pulse(out, t, note_hz(nm), 0.09, 0.35, duty=0.5)
            t += 0.11
        t += 0.12
    return out


def level_up():
    out = buf(1.25)
    arp = ['C5', 'E5', 'G5', 'C6']
    t = 0.0
    for nm in arp:
        add_pulse(out, t, note_hz(nm), 0.10, 0.28, duty=0.25)
        add_tri(out, t, note_hz(nm) / 2, 0.10, 0.25)
        t += 0.09
    t += 0.03
    for nm in ['C6', 'E6', 'G6']:                 # held "stage clear" chord
        add_pulse(out, t, note_hz(nm), 0.80, 0.16, duty=0.25, vibrato=0.006)
    add_tri(out, t, note_hz('C4'), 0.80, 0.3)
    return out


if __name__ == '__main__':
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    write('bells.wav', bells(), 0.6)
    write('hurry.wav', hurry(), 0.55)
    write('level-up.wav', level_up(), 0.6)
