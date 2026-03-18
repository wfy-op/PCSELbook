# PWEM square-hole example

This folder contains a minimal pure-Python implementation of a 2D scalar PWEM calculation for a square lattice with a circular air hole in a high-index background.

Files:
- `run_pwem_square_hole.py`: computes the first few `H_z` bands along `Gamma-X-M-Gamma`
- `output/pwem_square_hole_hz_bands.csv`: generated band table for LaTeX/PGFPlots
- `output/pwem_square_hole_summary.json`: generated metadata

This script uses only the Python standard library so it can run even on machines without `numpy`, `scipy`, or `matplotlib`.
