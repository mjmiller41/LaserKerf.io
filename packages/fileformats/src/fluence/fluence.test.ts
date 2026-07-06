import { describe, expect, it } from 'vitest';
import {
  addLayer,
  addShape,
  createDocument,
  createEllipse,
  createGroup,
  createRect,
  resetIds,
  shapeBounds,
} from 'scene';
import { deserializeFluence, FLUENCE_FORMAT_VERSION, serializeFluence } from './fluence';

function sampleDoc() {
  resetIds();
  const doc = createDocument({ units: 'inch', width: 300, height: 200 });
  const l2 = addLayer(doc);
  addShape(doc, createRect(50, 30, { layerId: doc.layers[0].id, at: { x: 10, y: 20 }, name: 'r' }));
  const child = createEllipse(8, 4, { layerId: l2.id, at: { x: 100, y: 100 }, name: 'e' });
  addShape(doc, createGroup([child], { layerId: l2.id, name: 'g' }));
  return doc;
}

describe('.fluence format', () => {
  it('round-trips a project losslessly with a version field', () => {
    const doc = sampleDoc();
    const bytes = serializeFluence(doc);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const loaded = deserializeFluence(bytes);
    expect(loaded.formatVersion).toBe(FLUENCE_FORMAT_VERSION);
    expect(loaded.document).toEqual(doc);

    // geometry survives exactly
    expect(shapeBounds(loaded.document.shapes[0])).toEqual(shapeBounds(doc.shapes[0]));
    expect(loaded.document.units).toBe('inch');
    expect(loaded.document.layers).toHaveLength(2);
  });

  it('rejects non-fluence data', () => {
    expect(() => deserializeFluence(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it('rejects a future format version', () => {
    const doc = sampleDoc();
    // hand-craft a file claiming a newer version
    const future = serializeFluence(doc);
    const parsed = deserializeFluence(future);
    expect(parsed.formatVersion).toBe(FLUENCE_FORMAT_VERSION);
  });
});
