import csv
import json
import math
import os
import sys

import matplotlib.pyplot as plt
import numpy as np


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
PWEM_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "pwem_square_hole"))
sys.path.insert(0, PWEM_DIR)

from run_pwem_square_hole import PARAMS, eta_coeff  # noqa: E402


def symmetric_basis(cutoff):
    return [(m, n) for m in range(-cutoff, cutoff + 1) for n in range(-cutoff, cutoff + 1)]


def asymmetric_basis():
    return [(m, n) for m in range(-2, 3) for n in range(-1, 2)]


def matrix_for(kx, ky, basis):
    size = len(basis)
    matrix = np.zeros((size, size), dtype=float)
    shifted = np.asarray([(kx + m, ky + n) for m, n in basis])
    for row in range(size):
        for column in range(row, size):
            dm = basis[row][0] - basis[column][0]
            dn = basis[row][1] - basis[column][1]
            value = eta_coeff(dm, dn, PARAMS) * float(np.dot(shifted[row], shifted[column]))
            matrix[row, column] = value
            matrix[column, row] = value
    return matrix


def bands_for(basis, k_values, band_count=6):
    result = []
    for kx in k_values:
        eigenvalues = np.linalg.eigvalsh(matrix_for(kx, 0.0, basis))
        result.append(np.sqrt(np.maximum(eigenvalues[:band_count], 0.0)))
    return np.asarray(result)


def main():
    k_values = np.linspace(0.0, 0.22, 45)
    cases = {
        "reference symmetric cutoff 4": symmetric_basis(4),
        "low symmetric cutoff 1": symmetric_basis(1),
        "low asymmetric 5x3 window": asymmetric_basis(),
    }
    band_data = {name: bands_for(basis, k_values) for name, basis in cases.items()}

    csv_path = os.path.join(OUTPUT_DIR, "pwem_cutoff_comparison.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["case", "basis_size", "kx", "band", "omega_a_over_2pi_c"])
        for name, basis in cases.items():
            for kx, row in zip(k_values, band_data[name]):
                for band, omega in enumerate(row, start=1):
                    writer.writerow([name, len(basis), kx, band, omega])

    fig, axes = plt.subplots(1, 3, figsize=(11.2, 3.35), sharey=True, constrained_layout=True)
    titles = ["(a) Symmetric cutoff 4", "(b) Symmetric cutoff 1", "(c) Asymmetric low basis"]
    for axis, title, (name, basis) in zip(axes, titles, cases.items()):
        values = band_data[name]
        for band in range(1, 5):
            axis.plot(k_values, values[:, band], lw=1.45, label=f"band {band + 1}")
        axis.scatter(np.zeros(4), values[0, 1:5], s=17, zorder=3)
        axis.set(xlabel=r"$k_x a/(2\pi)$", title=title)
        axis.grid(alpha=0.2)
        axis.text(0.98, 0.05, f"{len(basis)} plane waves", transform=axis.transAxes, ha="right", va="bottom", fontsize=8)
    axes[0].set_ylabel(r"Normalized frequency $a/\lambda$")
    axes[2].legend(frameon=False, fontsize=7, loc="upper left")
    figure_path = os.path.join(OUTPUT_DIR, "pwem_cutoff_failure.pdf")
    fig.savefig(figure_path)
    plt.close(fig)

    reference_gamma = band_data["reference symmetric cutoff 4"][0]
    symmetric_gamma = band_data["low symmetric cutoff 1"][0]
    asymmetric_gamma = band_data["low asymmetric 5x3 window"][0]
    summary = {
        "model": "2D scalar Hz PWEM basis-truncation diagnostic",
        "shared_parameters": PARAMS,
        "basis_sizes": {name: len(basis) for name, basis in cases.items()},
        "gamma_bands_2_to_5": {
            "reference_symmetric_cutoff_4": reference_gamma[1:5].tolist(),
            "low_symmetric_cutoff_1": symmetric_gamma[1:5].tolist(),
            "low_asymmetric_5x3_window": asymmetric_gamma[1:5].tolist(),
        },
        "asymmetric_false_split_band_3_4": float(abs(asymmetric_gamma[2] - asymmetric_gamma[3])),
        "outputs": [os.path.basename(csv_path), os.path.basename(figure_path)],
    }
    summary_path = os.path.join(OUTPUT_DIR, "pwem_cutoff_failure_summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
