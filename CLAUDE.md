# PCSELbook project memory

- `main.tex`, `chapters/`, `frontmatter/`, `figures/`, and `refs.bib` are the canonical book sources.
- `build/pcselbook.pdf` is generated with XeLaTeX; do not edit it directly.
- `knowledge-site/` is the public, static, read-only knowledge site generated from the book.
- The website is tracked as regular files in this parent repository. Its former standalone Git history is preserved locally at `knowledge-site/outputs/git-history-before-parent-tracking-20260917`; do not publish that directory or the local `.openai` hosting configuration.
- Never hand-edit generated `knowledge-site/public/data/chapters/*.json` content.
- `cd knowledge-site; npm run sync:book` compiles a stale PDF and regenerates figures, chapter data, font subset, and KaTeX HTML.
- `npm run dev` performs an initial sync and watches book sources for further local synchronization.
- `npm run check` performs a synchronized production build, payload cleanup, tests, lint, and type checking.
- Cloudflare publishing is never automatic. Only run `npm run deploy:pages` after the user explicitly asks to upload.
- Every deploy must use the cleaned `dist/client` output and pass `npm run audit:deploy`.
- Reading progress is device-local `localStorage`; there is no account sync, cookie, database, or write API.
- Generated and retired artifacts belong under ignored `knowledge-site/outputs/`, never in the deployment payload.
- September 2026 teaching figures: `code/teaching_visuals/run_visuals.py` generates the PDF assets in `figures/computed/`; run `test_visuals.py` after physics changes. Square-lattice X splitting is not a complete gap. I--IV triangular labels follow Ishizaki et al. 2019 Fig. 2; both III and IV fold to Gamma. Scalar envelope irrep labels must not be promoted to vector electromagnetic labels without transforming the field basis. Figure web caching includes referenced image/PDF bytes; test with `knowledge-site/tests/test_figure_dependencies.py`.
- Vertical optics tutorial: `code/vertical_tmm_mode/run_tutorial.py` and `vertical_modes.py` solve actual lossless planar TE/TM bound modes; run its unittest suite after changes (it also executes the printed chapter snippet). Inputs are teaching data, not a measured epitaxy. Distinguish field overlap, electric-energy overlap, and material-power-gain weighting. Regenerate its outputs before syncing the book if code/parameters change.
- Chapter 17 (`chapters/ch16_epitaxial_optical_structure.tex`) has a user-requested beginner route requiring no electrodynamics course. Introduce physical pictures, symbols/units, input tables and result-reading before formalism; label Maxwell/TM derivations as optional advanced reading. Preserve the rigorous equations and runnable example. This chapter-specific audience overrides the broader prerequisite assumption in `WRITING_GUIDE.md`.
- All-figure QA: `knowledge-site/scripts/audit_book_figures.py --audit-module <nature-figure>/scripts/audit_figure_collisions.py --suffix current` creates an 80-figure atlas and raw geometry findings under `outputs/figure-audit`. Inspect actual rendering: TeX combining accents, constructed brackets, text kerning, hidden strokes and plot clipping can produce false positives. Do not call the raw heuristic count a verified defect count or suppress true collisions by changing tolerances.
