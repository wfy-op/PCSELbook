import csv
import json
import os

import grcwa
import matplotlib.pyplot as plt
import numpy as np


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

PARAMS = {
    "r_over_a": 0.30,
    "slab_thickness_over_a": 0.50,
    "n_slab": 3.40,
    "n_top": 1.00,
    "n_substrate": 1.50,
    "fourier_orders_requested": 49,
    "grid_nx": 64,
    "grid_ny": 64,
    "omega_min": 0.25,
    "omega_max": 0.55,
    "passive_points": 151,
    "zoom_half_width": 0.018,
    "zoom_points": 101,
    "gain_epsilon_imag": [0.0, -0.005, -0.010],
}


def patterned_epsilon(epsilon_imag=0.0):
    nx = PARAMS["grid_nx"]
    ny = PARAMS["grid_ny"]
    x = (np.arange(nx) + 0.5) / nx - 0.5
    y = (np.arange(ny) + 0.5) / ny - 0.5
    xx, yy = np.meshgrid(x, y, indexing="ij")
    slab_eps = PARAMS["n_slab"] ** 2 + 1j * epsilon_imag
    eps = np.full((nx, ny), slab_eps, dtype=complex)
    eps[xx**2 + yy**2 <= PARAMS["r_over_a"] ** 2] = PARAMS["n_top"] ** 2
    return eps


def solve_one(omega, epsilon_imag=0.0):
    obj = grcwa.obj(
        PARAMS["fourier_orders_requested"],
        [1.0, 0.0],
        [0.0, 1.0],
        omega,
        0.0,
        0.0,
        verbose=0,
    )
    obj.Add_LayerUniform(0.0, PARAMS["n_top"] ** 2)
    obj.Add_LayerGrid(
        PARAMS["slab_thickness_over_a"],
        PARAMS["grid_nx"],
        PARAMS["grid_ny"],
    )
    obj.Add_LayerUniform(0.0, PARAMS["n_substrate"] ** 2)
    obj.Init_Setup()
    obj.GridLayer_geteps(patterned_epsilon(epsilon_imag).ravel())
    obj.MakeExcitationPlanewave(0.0, 0.0, 1.0, 0.0, order=0)
    reflectance, transmittance = obj.RT_Solve(normalize=1)
    return float(np.real(reflectance)), float(np.real(transmittance)), int(obj.nG)


def scan(omegas, epsilon_imag=0.0):
    rows = []
    actual_orders = None
    for omega in omegas:
        reflectance, transmittance, actual_orders = solve_one(float(omega), epsilon_imag)
        rows.append((float(omega), reflectance, transmittance))
    return np.asarray(rows), actual_orders


def main():
    passive_omegas = np.linspace(
        PARAMS["omega_min"], PARAMS["omega_max"], PARAMS["passive_points"]
    )
    passive, actual_orders = scan(passive_omegas)
    gradient = np.abs(np.gradient(passive[:, 1], passive[:, 0]))
    edge_guard = 4
    resonance_index = edge_guard + int(np.argmax(gradient[edge_guard:-edge_guard]))
    resonance_omega = float(passive[resonance_index, 0])

    zoom_omegas = np.linspace(
        resonance_omega - PARAMS["zoom_half_width"],
        resonance_omega + PARAMS["zoom_half_width"],
        PARAMS["zoom_points"],
    )
    zoom_curves = {}
    for epsilon_imag in PARAMS["gain_epsilon_imag"]:
        zoom_curves[epsilon_imag], _ = scan(zoom_omegas, epsilon_imag)

    passive_csv = os.path.join(OUTPUT_DIR, "rcwa_passive_spectrum.csv")
    with open(passive_csv, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["omega_a_over_2pi_c", "reflectance", "transmittance", "R_plus_T"])
        for omega, reflectance, transmittance in passive:
            writer.writerow([omega, reflectance, transmittance, reflectance + transmittance])

    gain_csv = os.path.join(OUTPUT_DIR, "rcwa_gain_proxy_scan.csv")
    with open(gain_csv, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["epsilon_imag", "omega_a_over_2pi_c", "reflectance", "transmittance"])
        for epsilon_imag, curve in zoom_curves.items():
            for omega, reflectance, transmittance in curve:
                writer.writerow([epsilon_imag, omega, reflectance, transmittance])

    fig, axes = plt.subplots(1, 3, figsize=(11.2, 3.35), constrained_layout=True)
    axes[0].plot(passive[:, 0], passive[:, 1], label="R", color="#1769aa", lw=1.8)
    axes[0].plot(passive[:, 0], passive[:, 2], label="T", color="#d1495b", lw=1.6)
    axes[0].plot(passive[:, 0], passive[:, 1] + passive[:, 2], "--", label="R+T", color="#397367", lw=1.2)
    axes[0].set(xlabel=r"Normalized frequency $a/\lambda$", ylabel="Power ratio", title="(a) Passive spectrum")
    axes[0].legend(frameon=False, fontsize=8)

    passive_zoom = zoom_curves[0.0]
    axes[1].plot(passive_zoom[:, 0], passive_zoom[:, 1], color="#1769aa", lw=1.8)
    axes[1].set(xlabel=r"Normalized frequency $a/\lambda$", ylabel="Reflectance", title="(b) Resonance zoom")

    colors = ["#1769aa", "#d1495b", "#397367"]
    for color, (epsilon_imag, curve) in zip(colors, zoom_curves.items()):
        axes[2].plot(curve[:, 0], curve[:, 1], color=color, lw=1.6, label=rf"$\epsilon''={epsilon_imag:.3f}$")
    axes[2].set(xlabel=r"Normalized frequency $a/\lambda$", ylabel="Reflectance", title="(c) Linear gain proxy")
    axes[2].legend(frameon=False, fontsize=8)
    for axis in axes:
        axis.grid(alpha=0.2)
        axis.set_ylim(bottom=0.0)

    figure_path = os.path.join(OUTPUT_DIR, "rcwa_square_hole_triptych.pdf")
    fig.savefig(figure_path)
    plt.close(fig)

    summary = {
        "model": "grcwa normal-incidence square-lattice circular-hole slab",
        "parameters": PARAMS,
        "actual_fourier_orders": actual_orders,
        "identified_feature_omega": resonance_omega,
        "passive_energy_balance_max_error": float(
            np.max(np.abs(passive[:, 1] + passive[:, 2] - 1.0))
        ),
        "outputs": [
            os.path.basename(passive_csv),
            os.path.basename(gain_csv),
            os.path.basename(figure_path),
        ],
    }
    summary_path = os.path.join(OUTPUT_DIR, "rcwa_square_hole_summary.json")
    with open(summary_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
