# Computed teaching figures

Run `python run_visuals.py`, then `python -m unittest discover -s code/teaching_visuals` from the repository root (or run the test file directly).

Dependencies: NumPy, SciPy, Matplotlib, threadpoolctl. On the author's Windows machine use the Python executable in the `AI_group` environment. No external solver, experimental data or network is required.

- `square_bands`: lossless nondispersive 2D Hz inverse-permittivity PWEM, circular air holes, r/a=0.30, background n=3.4. Analytical disk Fourier coefficients use SciPy J1. Cutoff 9 gives 361 plane waves. The 97-point path and 441-sample irreducible wedge are computed, not sketched. Cutoffs 5/7/9/11 are checked at Gamma/X/M. The maximum absolute change from 9 to 11 is about 0.00256: teaching accuracy, not a claim of fully converged device frequencies. Band identity may exchange at close crossings.
- The large local splitting at X is **not** a complete band gap: bands 2 and 3 overlap at different wave vectors, also at cutoff 11. No sampled positive gap is promoted to proof of a full gap.
- `abcd_envelopes`: explicitly defined scalar four-wave basis (two singlets and a doublet), not a vector Maxwell field or reproduced experimental image. Scalar envelope symmetry is not automatically the full electromagnetic irrep. An overall phase rotates imaginary sine combinations into the displayed real envelopes.
- `triangular_bz` / `triangular_feedback`: geometric constructions using reciprocal vectors. I--IV follow Ishizaki, De Zoysa and Noda, Photonics 6, 96 (2019), Fig. 2, DOI 10.3390/photonics6030096, checked against the original PDF. III and IV are different shells at the same Gamma coordinate. This is not a calculated triangular band structure.
- `aperture_farfield`: actual 512x512 FFT of specified scalar Gaussian, x-Gaussian and xy-Gaussian radiation apertures; 12w window; equal integrated input power, independently peak-normalized displays. Parseval error and on-axis cancellation are in `summary.json`; tests compare the full arrays to analytic Fourier results.
- `ellipticity_split`: eigenvalues of a specified 2x2 linear perturbation model, f0=319 THz and sensitivity=100 THz per unit ellipticity. These are illustrative parameters, not a claimed full-wave calculation for elliptical holes.
- `gamma_phase`: phase at corresponding positions in adjacent cells, not propagation vectors or an assumed radiation pattern.

Editable scripts, computed PDFs, CSV/NPZ source data and numerical summaries are kept together. The website renders the same PDF figure sources as the book. Optional installed nature-figure layout auditing is used only for visual QA and is not required for numerical reproduction.
