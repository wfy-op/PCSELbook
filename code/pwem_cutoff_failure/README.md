# PWEM cutoff failure diagnostic

This script compares a converged-ish symmetric reciprocal-space window, a
small but symmetry-preserving window, and a small asymmetric window. The last
case demonstrates how an implementation can create a false splitting at
Gamma when the retained basis is not closed under the lattice symmetry.

```powershell
C:\ProgramData\anaconda3\envs\AI_group\python.exe code/pwem_cutoff_failure/run_pwem_cutoff_failure.py
```

Dependencies: `numpy` and `matplotlib`. The script reuses the Fourier
coefficient implementation from `code/pwem_square_hole/`.
