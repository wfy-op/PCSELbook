import csv
import json
import math
import os

import matplotlib.pyplot as plt
import numpy as np


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

C0 = 299_792_458.0
PARAMS = {
    "wavelength_nm": 940.0,
    "refractive_index": 3.40,
    "cavity_length_um": 5.0,
    "mirror_power_reflectivity_1": 0.985,
    "mirror_power_reflectivity_2": 0.985,
    "internal_loss_cm_inverse": 5.0,
    "round_trips": 90,
}


def main():
    wavelength = PARAMS["wavelength_nm"] * 1e-9
    length = PARAMS["cavity_length_um"] * 1e-6
    alpha = PARAMS["internal_loss_cm_inverse"] * 100.0
    round_trip_time = 2.0 * PARAMS["refractive_index"] * length / C0
    energy_factor = (
        PARAMS["mirror_power_reflectivity_1"]
        * PARAMS["mirror_power_reflectivity_2"]
        * math.exp(-2.0 * alpha * length)
    )

    indices = np.arange(PARAMS["round_trips"] + 1)
    time_s = indices * round_trip_time
    energy = energy_factor**indices
    slope, intercept = np.polyfit(time_s, np.log(energy), 1)
    tau_energy = -1.0 / slope
    omega0 = 2.0 * math.pi * C0 / wavelength
    q_fit = omega0 * tau_energy
    q_exact = -omega0 * round_trip_time / math.log(energy_factor)
    fit_energy = np.exp(intercept + slope * time_s)

    csv_path = os.path.join(OUTPUT_DIR, "fp_decay_trace.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["round_trip", "time_ps", "normalized_energy", "fit_energy"])
        for index, time_value, value, fit_value in zip(indices, time_s, energy, fit_energy):
            writer.writerow([index, time_value * 1e12, value, fit_value])

    fig, axis = plt.subplots(figsize=(5.8, 3.6), constrained_layout=True)
    axis.semilogy(time_s * 1e12, energy, "o", ms=3.0, color="#1769aa", label="1D FP round-trip data")
    axis.semilogy(time_s * 1e12, fit_energy, color="#d1495b", lw=1.8, label="log-linear fit")
    axis.set(xlabel="Time (ps)", ylabel="Normalized stored energy", title="1D Fabry-Perot decay and Q fit")
    axis.grid(alpha=0.25, which="both")
    axis.legend(frameon=False)
    axis.text(0.98, 0.95, rf"$\tau_U={tau_energy * 1e12:.2f}\,$ps" + "\n" + rf"$Q={q_fit:.0f}$", transform=axis.transAxes, ha="right", va="top")
    figure_path = os.path.join(OUTPUT_DIR, "fp_decay_q_fit.pdf")
    fig.savefig(figure_path)
    plt.close(fig)

    summary = {
        "model": "lossy 1D Fabry-Perot round-trip energy decay",
        "parameters": PARAMS,
        "round_trip_time_ps": round_trip_time * 1e12,
        "round_trip_energy_factor": energy_factor,
        "fitted_energy_lifetime_ps": tau_energy * 1e12,
        "q_from_fit": q_fit,
        "q_from_exact_round_trip_factor": q_exact,
        "relative_fit_error": abs(q_fit - q_exact) / q_exact,
        "outputs": [os.path.basename(csv_path), os.path.basename(figure_path)],
    }
    summary_path = os.path.join(OUTPUT_DIR, "fp_decay_q_summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
