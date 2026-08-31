#!/usr/bin/env python3
"""Verify built-in shot presets against the app's default trajectory geometry.

This is intentionally dependency-free so it can run in CI.  It mirrors the current
free-flight equations in app.js and checks that every built-in feed still lands near
its documented target with a robust net margin after rounded UI-friendly settings.
"""
from __future__ import annotations

import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")

TABLE_L = 2.74
TABLE_W = 1.525
NET_H = 0.1525
BALL_D = 0.04
BALL_R = BALL_D / 2
BASE_BACK_X = 0.0
BASE_BACK_TO_YAW = 0.242
YAW_TO_PITCH = 0.075
PITCH_TO_WHEELS = 0.075
YAW_PIVOT_H = 0.240
G = 9.80665
DT = 0.004
MAX_T = 4.0
MASS = 0.0027
TEMP_C = 20.0
PRESSURE_KPA = 101.325
AIR_R = 287.05
MU0 = 1.716e-5
T0 = 273.15
SUTH = 110.4
TEMP_K = TEMP_C + 273.15
RHO = PRESSURE_KPA * 1000 / (AIR_R * TEMP_K)
MU = MU0 * (TEMP_K / T0) ** 1.5 * (T0 + SUTH) / (TEMP_K + SUTH)
NU = MU / RHO

DRAG_ROWS = [
    (2.5, [0, .3, .7, .95, 1.5, 2.0], [.55, .55, .55, .55, .55, .55]),
    (7.5, [0, .4, .75, 1.1, 1.3, 2.0], [.49, .49, .55, .48, .53, .53]),
    (12.5, [0, .4, .62, .95, 1.3, 2.0], [.47, .47, .53, .41, .48, .48]),
    (17.5, [0, .4, .5, .84, 1.2, 2.0], [.47, .47, .51, .37, .45, .45]),
]
MAG_ROWS = [
    (2.0, 0, .08, 150, -1.852e-7, -1.296e-4, .0983),
    (3.5, -1.1e-3, .31, 200, -1.667e-7, -3.333e-5, .1),
    (7.5, -8.0e-4, .37, 350, -2.0e-7, 1.7e-4, .0587),
    (10.5, -6.58e-4, .375, 440, -2.604e-7, 3.646e-4, -.0225),
    (13.5, -5.6e-4, .383, 550, -3.571e-7, 5.357e-4, -.0893),
    (17.0, -4.48e-4, .371, 650, -1.0e-7, 2.3e-4, -.0375),
]


def interp(x: float, xs: list[float], ys: list[float]) -> float:
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(1, len(xs)):
        if x <= xs[i]:
            t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
            return ys[i - 1] + t * (ys[i] - ys[i - 1])
    return ys[-1]


def drag_cd(speed: float, omega: float) -> float:
    clipped = max(DRAG_ROWS[0][0], min(30.0, speed))
    spin_ratio = BALL_R * omega / clipped if clipped > 1e-9 else 0.0

    def row_value(row):
        return interp(spin_ratio, row[1], row[2])

    if clipped <= DRAG_ROWS[0][0]:
        return row_value(DRAG_ROWS[0])
    if clipped <= DRAG_ROWS[-1][0]:
        for i in range(1, len(DRAG_ROWS)):
            if clipped <= DRAG_ROWS[i][0]:
                left, right = DRAG_ROWS[i - 1], DRAG_ROWS[i]
                t = (clipped - left[0]) / (right[0] - left[0])
                return row_value(left) + t * (row_value(right) - row_value(left))
    left, right = DRAG_ROWS[-2], DRAG_ROWS[-1]
    t = (clipped - right[0]) / (right[0] - left[0])
    value = row_value(right) + t * (row_value(right) - row_value(left))
    return max(.15, min(.9, value))


def mag_row(row, omega: float) -> float:
    _, m, s, omega_break, a, b, c = row
    value = m * omega + s if omega <= omega_break else a * omega * omega + b * omega + c
    return max(0.0, value)


def magnus_cm(speed: float, omega: float) -> float:
    clipped = max(MAG_ROWS[0][0], min(MAG_ROWS[-1][0], speed))
    if clipped <= MAG_ROWS[0][0]:
        return mag_row(MAG_ROWS[0], omega)
    for i in range(1, len(MAG_ROWS)):
        if clipped <= MAG_ROWS[i][0]:
            left, right = MAG_ROWS[i - 1], MAG_ROWS[i]
            t = (clipped - left[0]) / (right[0] - left[0])
            return max(0.0, mag_row(left, omega) + t * (mag_row(right, omega) - mag_row(left, omega)))
    return mag_row(MAG_ROWS[-1], omega)


def acceleration(v, omega):
    speed = math.sqrt(sum(q * q for q in v))
    omega_mag = math.sqrt(sum(q * q for q in omega))
    area = math.pi * BALL_R * BALL_R
    volume = 4 / 3 * math.pi * BALL_R ** 3
    drag_factor = -.5 * drag_cd(speed, omega_mag) * RHO * area * speed / MASS
    drag = [drag_factor * q for q in v]
    oxv = [
        omega[1] * v[2] - omega[2] * v[1],
        omega[2] * v[0] - omega[0] * v[2],
        omega[0] * v[1] - omega[1] * v[0],
    ]
    magnus_factor = magnus_cm(speed, omega_mag) * RHO * volume / MASS
    return [
        drag[0] + magnus_factor * oxv[0],
        drag[1] + magnus_factor * oxv[1],
        drag[2] + magnus_factor * oxv[2] - G,
    ]


def rk4(position, velocity, omega):
    a1 = acceleration(velocity, omega)
    v2 = [velocity[i] + a1[i] * DT / 2 for i in range(3)]
    a2 = acceleration(v2, omega)
    v3 = [velocity[i] + a2[i] * DT / 2 for i in range(3)]
    a3 = acceleration(v3, omega)
    v4 = [velocity[i] + a3[i] * DT for i in range(3)]
    a4 = acceleration(v4, omega)
    next_velocity = [
        velocity[i] + DT / 6 * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])
        for i in range(3)
    ]
    next_position = [
        position[i] + DT / 6 * (velocity[i] + 2 * v2[i] + 2 * v3[i] + v4[i])
        for i in range(3)
    ]
    return next_position, next_velocity


def simulate(speed: float, spin_rps: float, elevation_deg: float, aim_deg: float):
    yaw = math.radians(aim_deg)
    elevation = math.radians(elevation_deg)
    # Fixed measured mechanical chain. Base yaw is zero in the default library;
    # aim rotates the yaw->pitch and pitch->wheel links, while elevation rotates
    # the final pitch->wheel link vertically.
    head_yaw = yaw
    release_horizontal = PITCH_TO_WHEELS * math.cos(elevation)
    position = [
        BASE_BACK_X + BASE_BACK_TO_YAW + (YAW_TO_PITCH + release_horizontal) * math.cos(head_yaw),
        (YAW_TO_PITCH + release_horizontal) * math.sin(head_yaw),
        YAW_PIVOT_H + PITCH_TO_WHEELS * math.sin(elevation),
    ]
    velocity = [
        speed * math.cos(elevation) * math.cos(yaw),
        speed * math.cos(elevation) * math.sin(yaw),
        speed * math.sin(elevation),
    ]
    omega_mag = spin_rps * 2 * math.pi
    omega = [-math.sin(yaw) * omega_mag, math.cos(yaw) * omega_mag, 0.0]
    net = None
    landing = None
    t = 0.0
    while t < MAX_T:
        previous = position[:]
        position, velocity = rk4(position, velocity, omega)
        t += DT
        net_x = TABLE_L / 2
        if net is None and (previous[0] - net_x) * (position[0] - net_x) <= 0 and position[0] != previous[0]:
            ratio = (net_x - previous[0]) / (position[0] - previous[0])
            z = previous[2] + ratio * (position[2] - previous[2])
            y = previous[1] + ratio * (position[1] - previous[1])
            net = (z - BALL_R - NET_H, y)
        if previous[2] > BALL_R and position[2] <= BALL_R:
            ratio = (previous[2] - BALL_R) / (previous[2] - position[2] or 1)
            landing = (
                previous[0] + ratio * (position[0] - previous[0]),
                previous[1] + ratio * (position[1] - previous[1]),
            )
            break
    return landing, net


def parse_presets():
    start = APP.index("const DEFAULT_SHOT_PRESETS = Object.freeze({")
    end = APP.index("\n  });", start)
    block = APP[start:end]
    pattern = re.compile(
        r"(?P<key>\w+):\s*\{.*?"
        r"params:\s*\{\s*speedMps:\s*(?P<speed>-?[0-9.]+),\s*spinRps:\s*(?P<spin>-?[0-9.]+),\s*"
        r"elevationDeg:\s*(?P<elev>-?[0-9.]+),\s*aimDeg:\s*(?P<aim>-?[0-9.]+)\s*\},.*?"
        r"target:\s*\{\s*xM:\s*(?P<x>-?[0-9.]+),\s*yM:\s*(?P<y>-?[0-9.]+),\s*netClearanceCm:\s*(?P<clear>-?[0-9.]+)\s*\}",
        re.S,
    )
    rows = []
    for match in pattern.finditer(block):
        d = match.groupdict()
        rows.append({k: (v if k == "key" else float(v)) for k, v in d.items()})
    return rows


def main():
    # The blank/custom Shot node must itself start as a safe, useful ball.
    default_landing, default_net = simulate(5.84, 0.0, 10.3, 0.0)
    assert default_landing is not None and default_net is not None, "default new shot has no complete trajectory"
    assert TABLE_L / 2 < default_landing[0] < TABLE_L, f"default new shot misses opponent half: {default_landing}"
    assert default_net[0] >= 0.075, f"default new shot has insufficient net clearance: {default_net[0]*100:.2f} cm"

    presets = parse_presets()
    assert len(presets) >= 18, f"expected an expanded preset library, found {len(presets)}"
    for preset in presets:
        landing, net = simulate(preset["speed"], preset["spin"], preset["elev"], preset["aim"])
        assert landing is not None and net is not None, f"{preset['key']}: no complete table trajectory"
        target_error = math.hypot(landing[0] - preset["x"], landing[1] - preset["y"])
        clearance_cm = net[0] * 100
        assert target_error <= .015, f"{preset['key']}: target error {target_error*100:.2f} cm"
        assert abs(clearance_cm - preset["clear"]) <= .35, (
            f"{preset['key']}: clearance {clearance_cm:.2f} cm vs documented {preset['clear']:.2f} cm"
        )
        assert clearance_cm >= 7.5, f"{preset['key']}: insufficient net margin {clearance_cm:.2f} cm"
        assert TABLE_L / 2 + .35 <= landing[0] <= TABLE_L - .20, f"{preset['key']}: risky longitudinal target {landing[0]:.3f}"
        assert abs(landing[1]) <= TABLE_W / 2 - .20, f"{preset['key']}: risky sideline target {landing[1]:.3f}"
    print(f"default-library trajectory self-test PASS ({len(presets)} solved feeds)")


if __name__ == "__main__":
    main()
