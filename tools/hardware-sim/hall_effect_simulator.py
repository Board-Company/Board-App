"""
Hall Effect Sensor Simulator for an 8×8 board with one sensor at each corner of every square.

Simulates how magnet position and strength produce ADC-like readings at each corner,
and estimates position from those readings (inverse problem).

- Board: 8×8 squares → 9×9 grid of corners = 81 sensors at (0,0)..(8,8).
- Strength: configurable variable (higher = stronger field = larger ADC-like values).
- Model: inverse-square law with optional exponent (field ~ strength / distance^n).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple, Sequence

# Optional: use numpy if available for vectorized ops and future extensions
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


# ADC range used by ESP32 in main.cpp (12-bit)
ADC_MAX = 4095
ADC_MIN = 0

# 8×8 board: one sensor at each corner of each square → 9×9 grid of corners
BOARD_SIZE = 8  # 8 squares per side
# Corners (i, j) for i, j in 0..8; order row-major so index = j*9 + i (x varies first)
def _make_8x8_corners() -> Tuple[Tuple[float, float], ...]:
    return tuple((float(i), float(j)) for j in range(9) for i in range(9))

DEFAULT_CORNERS = _make_8x8_corners()
NUM_SENSORS = len(DEFAULT_CORNERS)  # 81


@dataclass
class SimulatorConfig:
    """Configuration for the hall effect simulation."""
    # Sensor positions (x, y) for each corner (81 for 8×8)
    corners: Tuple[Tuple[float, float], ...] = DEFAULT_CORNERS
    # Base strength multiplier (tune to get readings in 0–4095 range)
    strength: float = 1.0
    # Exponent for 1/distance^n (2 = inverse square)
    distance_exponent: float = 2.0
    # Min distance to avoid division by zero
    min_distance: float = 0.1
    # Scale raw field sum to ADC range (max expected raw value)
    adc_scale: float = 1.0


def distance(p: Tuple[float, float], q: Tuple[float, float]) -> float:
    """Euclidean distance between two points."""
    dx = p[0] - q[0]
    dy = p[1] - q[1]
    return math.sqrt(dx * dx + dy * dy)


def forward_readings(
    px: float,
    py: float,
    strength: float = 1.0,
    corners: Tuple[Tuple[float, float], ...] = DEFAULT_CORNERS,
    distance_exponent: float = 2.0,
    min_distance: float = 0.1,
    adc_scale: float | None = None,
) -> Tuple[float, ...]:
    """
    Compute simulated ADC-like readings at each corner for a magnet at (px, py).

    Field at sensor i = strength / (distance_i ** distance_exponent).
    Values are scaled to approximate 0–4095 ADC range if adc_scale is set.

    Returns:
        Tuple of N readings (one per corner), same order as corners.
    """
    magnet = (px, py)
    raw = []
    for c in corners:
        d = max(distance(magnet, c), min_distance)
        field = strength / (d ** distance_exponent)
        raw.append(field)

    n = len(corners)
    if adc_scale is not None and adc_scale > 0:
        # Scale so that (raw_i / max_raw) * strength * ADC_MAX gives 0–4095 range
        m = max(raw)
        if m <= 0:
            readings = tuple(0.0 for _ in range(n))
        else:
            scale = (strength * adc_scale * ADC_MAX) / m
            readings = tuple(min(ADC_MAX, max(ADC_MIN, r * scale)) for r in raw)
    else:
        # No scaling: return raw field values (can still be used for ratios)
        readings = tuple(raw)

    return readings


def estimate_position(
    readings: Tuple[float, ...] | Sequence[float],
    corners: Tuple[Tuple[float, float], ...] | Sequence[Tuple[float, float]] = DEFAULT_CORNERS,
    use_weights: bool = True,
) -> Tuple[float, float]:
    """
    Estimate magnet position from corner readings (inverse problem).

    Uses weighted centroid: weight_i = reading_i (stronger = closer to that corner).
    If use_weights is False, returns geometric center of corners (ignores readings).
    """
    n = len(readings)
    if n != len(corners):
        raise ValueError(f"Need same number of readings and corners (got {n} and {len(corners)}).")

    if use_weights:
        w = [max(float(r), 0.0) for r in readings]
        total = sum(w)
        if total <= 0:
            w = [1.0 / n] * n
        else:
            w = [x / total for x in w]
        x = sum(w[i] * corners[i][0] for i in range(n))
        y = sum(w[i] * corners[i][1] for i in range(n))
        return (x, y)
    else:
        cx = sum(c[0] for c in corners) / n
        cy = sum(c[1] for c in corners) / n
        return (cx, cy)


def run_simulator(
    strength: float = 1.0,
    px: float = 4.0,
    py: float = 4.0,
    corners: Tuple[Tuple[float, float], ...] = DEFAULT_CORNERS,
    distance_exponent: float = 2.0,
    scale_to_adc: bool = True,
) -> None:
    """
    Run a single simulation: print forward readings and estimated position.
    """
    adc_scale = 0.4 if scale_to_adc else None  # tune so typical readings sit in 0–4095
    readings = forward_readings(
        px, py,
        strength=strength,
        corners=corners,
        distance_exponent=distance_exponent,
        adc_scale=adc_scale,
    )
    est = estimate_position(readings, corners=corners)
    n = len(readings)

    print("Hall effect simulator (8×8 board, 81 corner sensors)")
    print("Sensors: 9×9 grid (one at each corner of every square)")
    print("Strength:", strength)
    print("Magnet position (true):", (round(px, 3), round(py, 3)))
    print("Readings: %d sensors, min=%.1f max=%.1f" % (n, min(readings), max(readings)))
    # Show 9×9 grid (first 9 = bottom row, etc.)
    print("Readings grid (9×9, row y=0..8):")
    for j in range(9):
        row = [readings[j * 9 + i] for i in range(9)]
        print("  " + " ".join("%5.0f" % r for r in row))
    print("Estimated position:   ", (round(est[0], 3), round(est[1], 3)))
    print("Error (x,y):          ", (round(est[0] - px, 3), round(est[1] - py, 3)))


def interactive_demo() -> None:
    """
    Print a small grid of positions and their readings for different strengths (8×8 board).
    """
    strengths = [0.5, 1.0, 2.0]
    # Sample positions on 8×8: corners, edges, center
    positions = [(1, 1), (4, 4), (7, 7), (0.5, 7.5), (8, 0), (4, 2)]

    print("=== Forward: position + strength -> readings (81 sensors) ===\n")
    for strength in strengths:
        print(f"--- Strength = {strength} ---")
        for px, py in positions:
            r = forward_readings(px, py, strength=strength, adc_scale=0.4)
            est = estimate_position(r)
            r_min, r_max = min(r), max(r)
            print(f"  pos ({px},{py}) -> min=%d max=%d -> est (%s)" % (r_min, r_max, ", ".join("%.2f" % e for e in est)))
        print()

    print("=== Inverse: vary strength at fixed position (4, 4) ===\n")
    for s in [0.25, 0.5, 1.0, 2.0, 4.0]:
        r = forward_readings(4.0, 4.0, strength=s, adc_scale=0.4)
        e = estimate_position(r)
        print(f"  strength {s} -> est ({e[0]:.2f}, {e[1]:.2f})")


def plot_board(
    px: float = 4.0,
    py: float = 4.0,
    strength: float = 1.0,
    corners: Tuple[Tuple[float, float], ...] = DEFAULT_CORNERS,
    adc_scale: float = 0.4,
) -> None:
    """
    Plot 8×8 board with 9×9 sensor grid: heatmap of readings, true vs estimated position.
    Requires matplotlib.
    """
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("Install matplotlib to use --plot")
        return

    readings = forward_readings(px, py, strength=strength, corners=corners, adc_scale=adc_scale)
    est_x, est_y = estimate_position(readings, corners=corners)

    # 9×9 grid: grid[j][i] = reading at (x=i, y=j); row 0 = y=0 (bottom)
    grid = [[readings[j * 9 + i] for i in range(9)] for j in range(9)]

    fig, ax = plt.subplots(1, 1, figsize=(8, 7))
    im = ax.imshow(grid, extent=[-0.5, 8.5, -0.5, 8.5], aspect="equal", origin="lower",
                   cmap="viridis", vmin=ADC_MIN, vmax=ADC_MAX)
    plt.colorbar(im, ax=ax, label="ADC-like reading")

    # 8×8 square grid
    for i in range(9):
        ax.axhline(i - 0.5, color="gray", linewidth=0.3)
        ax.axvline(i - 0.5, color="gray", linewidth=0.3)
    ax.set_xlim(-0.5, 8.5)
    ax.set_ylim(-0.5, 8.5)
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title("8×8 board — 81 corner sensors (heatmap) | red ★ = true, blue ● = estimated")
    ax.set_xticks(range(9))
    ax.set_yticks(range(9))

    ax.scatter([px], [py], s=280, c="red", marker="*", zorder=5, label="True position", edgecolors="white")
    ax.scatter([est_x], [est_y], s=120, c="blue", marker="o", zorder=5, label="Estimated", edgecolors="white")
    ax.legend(loc="upper right")
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    import sys

    # Default: center of 8×8 at (4, 4) with strength 1
    strength = 1.0
    px, py = 4.0, 4.0
    do_plot = "--plot" in sys.argv or "-p" in sys.argv
    args = [a for a in sys.argv[1:] if a not in ("--plot", "-p")]

    if len(args) >= 3:
        try:
            px = float(args[0])
            py = float(args[1])
            strength = float(args[2])
        except ValueError:
            pass
    elif len(args) == 1 and args[0].lower() == "demo":
        interactive_demo()
        sys.exit(0)
    elif len(args) == 1 and args[0].lower() == "gui":
        do_plot = True

    run_simulator(strength=strength, px=px, py=py)
    if do_plot:
        plot_board(px=px, py=py, strength=strength)

    print("\nUsage: python hall_effect_simulator.py [x y strength] [--plot]  (default: 4 4 1, 8×8)")
    print("       python hall_effect_simulator.py demo                      (demo grid)")
    print("       python hall_effect_simulator.py gui                       (run + open plot)")
