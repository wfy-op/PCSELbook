# Square-lattice circular-hole slab RCWA example

This example uses `grcwa` to scan the normal-incidence reflection and
transmission of a square lattice of circular air holes in a high-index slab.
It also repeats a narrow scan with a small negative imaginary permittivity as
a linear gain proxy. The latter is not a nonlinear laser-threshold solution.

Run from the repository root:

```powershell
C:\ProgramData\anaconda3\envs\AI_group\python.exe code/rcwa_square_hole/run_rcwa_square_hole.py
```

Dependencies: `numpy`, `matplotlib`, and `grcwa`.

Outputs are written to `code/rcwa_square_hole/output/`.
