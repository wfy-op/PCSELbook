/** One transverse plane of an unfolded, paraxial two-mirror path. Lengths: mm; angles: mrad. */
export function traceAlignment(offset: number, incidentMrad: number, mirror1Mrad: number, mirror2Mrad: number) {
  if (![offset, incidentMrad, mirror1Mrad, mirror2Mrad].every(Number.isFinite)) return null;
  const firstSlope = (incidentMrad + 2 * mirror1Mrad) / 1000;
  const mirror2 = offset + 250 * firstSlope;
  const finalSlope = firstSlope + 2 * mirror2Mrad / 1000;
  const near = mirror2 + 100 * finalSlope;
  const far = mirror2 + 600 * finalSlope;
  const mirror1Hit = Math.abs(offset) <= 8;
  const mirror2Hit = mirror1Hit && Math.abs(mirror2) <= 8;
  const nearPass = mirror2Hit && Math.abs(near) <= 0.5;
  const farPass = nearPass && Math.abs(far) <= 0.5;
  return {
    firstSlope, finalSlope, mirror2, near, far, mirror1Hit, mirror2Hit, nearPass, farPass,
    aligned: farPass && Math.abs(near) <= 0.1 && Math.abs(far) <= 0.1,
  };
}

/** Ideal thin lens in air: positive u is a real object; f > 0 is a converging lens. */
export function thinLens(u: number, f: number, screen: number) {
  if (![u, f, screen].every(Number.isFinite) || u <= 0 || f <= 0 || screen <= 0) return null;
  if (Math.abs(u - f) < 1e-9) return { kind: 'infinite' as const, v: null, magnification: null, screenError: null, focused: false };
  const v = f * u / (u - f);
  const magnification = -v / u;
  return { kind: v > 0 ? 'real' as const : 'virtual' as const, v, magnification, screenError: v > 0 ? screen - v : null, focused: v > 0 && Math.abs(screen - v) <= 2 };
}
