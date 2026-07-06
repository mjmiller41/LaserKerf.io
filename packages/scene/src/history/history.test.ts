import { beforeEach, describe, expect, it } from 'vitest';
import { addShape, createDocument, findShape, type Document } from '../model/document';
import { createRect } from '../model/factory';
import { translatedShape } from '../model/transform';
import { shapeBounds } from '../model/shape';
import { resetIds } from '../model/ids';
import { composite, History } from './history';
import { addShapeCommand, removeShapeCommand, updateShapeCommand } from './commands';

let doc: Document;
let layer: string;

beforeEach(() => {
  resetIds();
  doc = createDocument();
  layer = doc.layers[0].id;
});

describe('History', () => {
  it('undoes and redoes shape add/remove', () => {
    const h = new History();
    const rect = createRect(10, 10, { layerId: layer });

    h.execute(addShapeCommand(doc, rect));
    expect(findShape(doc, rect.id)).toBeDefined();

    h.undo();
    expect(findShape(doc, rect.id)).toBeUndefined();
    expect(h.canRedo()).toBe(true);

    h.redo();
    expect(findShape(doc, rect.id)).toBeDefined();

    h.execute(removeShapeCommand(doc, rect.id));
    expect(findShape(doc, rect.id)).toBeUndefined();
    h.undo();
    expect(findShape(doc, rect.id)).toBeDefined();
  });

  it('undoes a transform to the exact prior geometry', () => {
    const h = new History();
    const rect = addShape(doc, createRect(10, 10, { layerId: layer }));
    const before = { ...rect };
    h.execute(updateShapeCommand(doc, before, translatedShape(rect, 25, 0)));
    expect(shapeBounds(findShape(doc, rect.id)!)!.x).toBe(25);
    h.undo();
    expect(shapeBounds(findShape(doc, rect.id)!)!.x).toBe(0);
  });

  it('treats a composite as one atomic step', () => {
    const h = new History();
    const a = createRect(5, 5, { layerId: layer });
    const b = createRect(5, 5, { layerId: layer });
    h.execute(composite('Add two', [addShapeCommand(doc, a), addShapeCommand(doc, b)]));
    expect(doc.shapes).toHaveLength(2);
    h.undo();
    expect(doc.shapes).toHaveLength(0);
    h.redo();
    expect(doc.shapes).toHaveLength(2);
  });

  it('clears the redo stack after a new edit', () => {
    const h = new History();
    h.execute(addShapeCommand(doc, createRect(1, 1, { layerId: layer })));
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.execute(addShapeCommand(doc, createRect(2, 2, { layerId: layer })));
    expect(h.canRedo()).toBe(false);
  });

  it('records an already-applied change without re-doing it', () => {
    const h = new History();
    const rect = addShape(doc, createRect(10, 10, { layerId: layer }));
    const before = { ...rect };
    // simulate a live drag that already mutated the document
    const moved = translatedShape(rect, 10, 10);
    doc.shapes[0] = moved;
    h.record(updateShapeCommand(doc, before, moved));
    expect(shapeBounds(doc.shapes[0])!.x).toBe(10);
    h.undo();
    expect(shapeBounds(doc.shapes[0])!.x).toBe(0);
  });
});
