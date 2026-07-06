import { create } from 'zustand';
import type { BooleanMode } from './boolean';
import {
  addLayerCommand,
  addShapeCommand,
  type Command,
  composite,
  createDocument,
  createLayer,
  type Document,
  findShape,
  History,
  type Layer,
  type LayerId,
  removeShapeCommand,
  replaceShape,
  type Shape,
  type ShapeId,
  updateLayerCommand,
  updateShapeCommand,
} from 'scene';

export type Tool = 'select' | 'rect' | 'ellipse' | 'polygon';

export interface EditorState {
  doc: Document;
  history: History;
  selection: ShapeId[];
  activeLayerId: LayerId;
  tool: Tool;
  /** Bumped whenever the (mutable) document changes so views re-render/redraw. */
  version: number;

  setTool(tool: Tool): void;
  select(ids: ShapeId[]): void;
  selectAll(): void;
  setActiveLayer(id: LayerId): void;

  addShapeAction(shape: Shape): void;
  /** Live mutation during a drag (no history entry). */
  previewUpdate(shape: Shape): void;
  /** Commit a completed drag as one undo step given the pre-drag shapes. */
  commitTransform(before: Shape[]): void;
  /** Apply + record a set of shape updates (align/distribute/node edits). */
  applyUpdates(before: Shape[], after: Shape[]): void;
  deleteSelection(): void;
  selectedShapes(): Shape[];
  booleanAction(mode: BooleanMode): Promise<void>;

  addLayerAction(): void;
  updateLayer(id: LayerId, patch: Partial<Omit<Layer, 'id'>>): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

const initialDoc = createDocument();

export const useEditor = create<EditorState>((set, get) => ({
  doc: initialDoc,
  history: new History(),
  selection: [],
  activeLayerId: initialDoc.layers[0].id,
  tool: 'select',
  version: 0,

  setTool: (tool) => set({ tool }),
  select: (ids) => set({ selection: ids }),
  selectAll: () => set((s) => ({ selection: s.doc.shapes.map((sh) => sh.id) })),
  setActiveLayer: (id) => set({ activeLayerId: id }),

  addShapeAction: (shape) => {
    const { doc, history } = get();
    history.execute(addShapeCommand(doc, shape));
    set((s) => ({ selection: [shape.id], version: s.version + 1 }));
  },

  previewUpdate: (shape) => {
    replaceShape(get().doc, shape);
    set((s) => ({ version: s.version + 1 }));
  },

  commitTransform: (before) => {
    const { doc, history } = get();
    const cmds = before
      .map((b): Command | null => {
        const after = findShape(doc, b.id);
        return after ? updateShapeCommand(doc, b, after) : null;
      })
      .filter((c): c is Command => c !== null);
    if (cmds.length > 0) history.record(composite('Transform', cmds));
  },

  applyUpdates: (before, after) => {
    const { doc, history } = get();
    history.execute(composite('Modify', before.map((b, i) => updateShapeCommand(doc, b, after[i]))));
    set((s) => ({ version: s.version + 1 }));
  },

  deleteSelection: () => {
    const { doc, history, selection } = get();
    if (selection.length === 0) return;
    history.execute(composite('Delete', selection.map((id) => removeShapeCommand(doc, id))));
    set((s) => ({ selection: [], version: s.version + 1 }));
  },

  selectedShapes: () => {
    const { doc, selection } = get();
    return selection.map((id) => findShape(doc, id)).filter((s): s is Shape => s !== undefined);
  },

  booleanAction: async (mode) => {
    const shapes = get().selectedShapes();
    if (shapes.length < 2) return;
    const { booleanShapes } = await import('./boolean');
    const result = await booleanShapes(mode, shapes, shapes[0].layerId);
    const { doc, history } = get();
    history.execute(
      composite('Boolean', [
        ...shapes.map((s) => removeShapeCommand(doc, s.id)),
        addShapeCommand(doc, result),
      ]),
    );
    set((s) => ({ selection: [result.id], version: s.version + 1 }));
  },

  addLayerAction: () => {
    const { doc, history } = get();
    const layer = createLayer(undefined, doc.layers.length);
    history.execute(addLayerCommand(doc, layer));
    set((s) => ({ activeLayerId: layer.id, version: s.version + 1 }));
  },

  updateLayer: (id, patch) => {
    const { doc, history } = get();
    history.execute(updateLayerCommand(doc, id, patch));
    set((s) => ({ version: s.version + 1 }));
  },

  undo: () => {
    if (get().history.undo()) set((s) => ({ selection: [], version: s.version + 1 }));
  },
  redo: () => {
    if (get().history.redo()) set((s) => ({ selection: [], version: s.version + 1 }));
  },
  canUndo: () => get().history.canUndo(),
  canRedo: () => get().history.canRedo(),
}));
