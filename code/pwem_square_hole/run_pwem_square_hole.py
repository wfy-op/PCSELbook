import csv
import json
import math
import os
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

PARAMS = {
    "r_over_a": 0.30,
    "eps_background": 3.4 ** 2,
    "eps_hole": 1.0,
    "cutoff": 2,
    "bands": 6,
    "points_per_segment": 16,
}


def bessel_j1(x: float) -> float:
    if x == 0.0:
        return 0.0
    term = 0.5 * x
    total = term
    for m in range(200):
        term *= -(0.25 * x * x) / ((m + 1) * (m + 2))
        total += term
        if abs(term) < 1e-16:
            break
    return total


def build_reciprocal_list(cutoff: int):
    g_list = []
    for m in range(-cutoff, cutoff + 1):
        for n in range(-cutoff, cutoff + 1):
            g_list.append((m, n))
    return g_list


def eta_coeff(delta_m: int, delta_n: int, params) -> float:
    eps_b = params["eps_background"]
    eps_h = params["eps_hole"]
    r_over_a = params["r_over_a"]
    eta_b = 1.0 / eps_b
    eta_h = 1.0 / eps_h
    fill = math.pi * r_over_a * r_over_a
    if delta_m == 0 and delta_n == 0:
        return eta_b + (eta_h - eta_b) * fill
    g_norm = math.sqrt(delta_m * delta_m + delta_n * delta_n)
    x = 2.0 * math.pi * r_over_a * g_norm
    return (eta_h - eta_b) * fill * (2.0 * bessel_j1(x) / x)


def build_eta_cache(cutoff: int, params):
    cache = {}
    for dm in range(-2 * cutoff, 2 * cutoff + 1):
        for dn in range(-2 * cutoff, 2 * cutoff + 1):
            cache[(dm, dn)] = eta_coeff(dm, dn, params)
    return cache


def build_matrix(kx: float, ky: float, g_list, eta_cache):
    size = len(g_list)
    matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    kg = [(kx + g[0], ky + g[1]) for g in g_list]
    for i in range(size):
        vxi, vyi = kg[i]
        for j in range(i, size):
            vxj, vyj = kg[j]
            dm = g_list[i][0] - g_list[j][0]
            dn = g_list[i][1] - g_list[j][1]
            value = eta_cache[(dm, dn)] * (vxi * vxj + vyi * vyj)
            matrix[i][j] = value
            matrix[j][i] = value
    return matrix


def jacobi_eigenvalues(matrix, tol=1e-12, max_sweeps=80):
    n = len(matrix)
    a = [row[:] for row in matrix]
    for _ in range(max_sweeps):
        max_offdiag = 0.0
        for p in range(n - 1):
            for q in range(p + 1, n):
                apq = a[p][q]
                if abs(apq) > max_offdiag:
                    max_offdiag = abs(apq)
                if abs(apq) < tol:
                    continue
                app = a[p][p]
                aqq = a[q][q]
                tau = (aqq - app) / (2.0 * apq)
                t = math.copysign(1.0 / (abs(tau) + math.sqrt(1.0 + tau * tau)), tau)
                c = 1.0 / math.sqrt(1.0 + t * t)
                s = t * c
                for k in range(n):
                    if k == p or k == q:
                        continue
                    akp = a[k][p]
                    akq = a[k][q]
                    new_kp = c * akp - s * akq
                    new_kq = s * akp + c * akq
                    a[k][p] = new_kp
                    a[p][k] = new_kp
                    a[k][q] = new_kq
                    a[q][k] = new_kq
                a[p][p] = c * c * app - 2.0 * s * c * apq + s * s * aqq
                a[q][q] = s * s * app + 2.0 * s * c * apq + c * c * aqq
                a[p][q] = 0.0
                a[q][p] = 0.0
        if max_offdiag < tol:
            break
    eigenvalues = [a[i][i] for i in range(n)]
    eigenvalues.sort()
    return eigenvalues


def generate_path(points_per_segment: int):
    gamma = (0.0, 0.0)
    x = (0.5, 0.0)
    m = (0.5, 0.5)
    segments = [(gamma, x), (x, m), (m, gamma)]
    labels = ["G", "X", "M", "G"]
    label_positions = [0.0]
    path = []
    cumulative = 0.0
    for idx, (start, end) in enumerate(segments):
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        seg_len = math.sqrt(dx * dx + dy * dy)
        for step in range(points_per_segment + 1):
            if idx > 0 and step == 0:
                continue
            t = step / points_per_segment
            kx = start[0] + t * dx
            ky = start[1] + t * dy
            s = cumulative + t * seg_len
            path.append((s, kx, ky))
        cumulative += seg_len
        label_positions.append(cumulative)
    return path, labels, label_positions


def main():
    start_time = time.time()
    g_list = build_reciprocal_list(PARAMS["cutoff"])
    eta_cache = build_eta_cache(PARAMS["cutoff"], PARAMS)
    path, labels, label_positions = generate_path(PARAMS["points_per_segment"])

    csv_path = os.path.join(OUTPUT_DIR, "pwem_square_hole_hz_bands.csv")
    summary_path = os.path.join(OUTPUT_DIR, "pwem_square_hole_summary.json")

    rows = []
    for s, kx, ky in path:
        matrix = build_matrix(kx, ky, g_list, eta_cache)
        eigenvalues = jacobi_eigenvalues(matrix)
        omegas = [math.sqrt(max(ev, 0.0)) for ev in eigenvalues[: PARAMS["bands"]]]
        row = {"s": s, "kx": kx, "ky": ky}
        for idx, omega in enumerate(omegas, start=1):
            row[f"b{idx}"] = omega
        rows.append(row)

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["s", "kx", "ky"] + [f"b{i}" for i in range(1, PARAMS["bands"] + 1)]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: f"{v:.10f}" if isinstance(v, float) else v for k, v in row.items()})

    summary = {
        "model": "2D scalar Hz PWEM teaching model",
        "parameters": PARAMS,
        "labels": labels,
        "label_positions": [round(v, 10) for v in label_positions],
        "g_vectors": len(g_list),
        "runtime_seconds": round(time.time() - start_time, 3),
        "output_csv": os.path.basename(csv_path),
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("Wrote", csv_path)
    print("Wrote", summary_path)
    print("Runtime (s):", summary["runtime_seconds"])


if __name__ == "__main__":
    main()
