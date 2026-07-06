import {
  addLayer,
  addShape,
  type Document,
  type Layer,
  removeShape,
  replaceShape,
} from '../model/document';
import type { Shape, ShapeId } from '../model/shape';
import type { Command } from './history';

export function addShapeCommand(doc: Document, shape: Shape): Command {
  return {
    label: 'Add shape',
    do: () => {
      addShape(doc, shape);
    },
    undo: () => {
      removeShape(doc, shape.id);
    },
  };
}

export function removeShapeCommand(doc: Document, id: ShapeId): Command {
  let ctx: ReturnType<typeof removeShape> = null;
  return {
    label: 'Delete shape',
    do: () => {
      ctx = removeShape(doc, id);
    },
    undo: () => {
      if (ctx) ctx.siblings.splice(ctx.index, 0, ctx.shape);
    },
  };
}

export function updateShapeCommand(doc: Document, before: Shape, after: Shape): Command {
  return {
    label: 'Modify shape',
    do: () => {
      replaceShape(doc, after);
    },
    undo: () => {
      replaceShape(doc, before);
    },
  };
}

export function addLayerCommand(doc: Document, layer: Layer): Command {
  return {
    label: 'Add layer',
    do: () => {
      addLayer(doc, layer);
    },
    undo: () => {
      doc.layers = doc.layers.filter((l) => l.id !== layer.id);
    },
  };
}

/** Change layer properties (visibility/lock/color/name), reversibly. */
export function updateLayerCommand(
  doc: Document,
  id: string,
  patch: Partial<Omit<Layer, 'id'>>,
): Command {
  let before: Partial<Layer> = {};
  const apply = (values: Partial<Layer>): void => {
    const layer = doc.layers.find((l) => l.id === id);
    if (layer) Object.assign(layer, values);
  };
  return {
    label: 'Layer settings',
    do: () => {
      const layer = doc.layers.find((l) => l.id === id);
      if (!layer) return;
      before = {};
      for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
        (before as Record<string, unknown>)[key] = layer[key];
      }
      apply(patch);
    },
    undo: () => apply(before),
  };
}
