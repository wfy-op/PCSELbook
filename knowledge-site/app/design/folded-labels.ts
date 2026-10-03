import type { FoldedScene } from './folded-engine.ts';

/** Number detectors independently of other optics, in prescription order.
 * Derived labels preserve IDs and custom names in existing version-1 files.
 */
export function foldedLabels(scene: FoldedScene) {
  let detector = 0;
  return new Map(scene.elements.map((e, i) => {
    const tag = e.kind === 'detector' ? `D${++detector}` : String(i + 1);
    return [e.id, { tag, label: `${tag} · ${e.name}` }];
  }));
}
