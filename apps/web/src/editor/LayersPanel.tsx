import type { MouseEvent } from 'react';
import { useEditor } from './store';

export function LayersPanel() {
  const version = useEditor((s) => s.version);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  void version; // re-render when layers/document change
  const store = useEditor.getState();

  const toggle = (e: MouseEvent, id: string, patch: Record<string, boolean>): void => {
    e.stopPropagation();
    store.updateLayer(id, patch);
  };

  return (
    <aside className="layers" data-testid="layers-panel">
      <div className="layers__header">
        <span>Layers</span>
        <button type="button" onClick={() => store.addLayerAction()} data-testid="add-layer">
          +
        </button>
      </div>
      <ul>
        {store.doc.layers.map((layer) => (
          <li
            key={layer.id}
            className={layer.id === activeLayerId ? 'active' : ''}
            onClick={() => store.setActiveLayer(layer.id)}
            data-testid={`layer-${layer.id}`}
          >
            <span className="layers__swatch" style={{ background: layer.color }} />
            <span className="layers__name">{layer.name}</span>
            <button
              type="button"
              title={layer.visible ? 'Hide' : 'Show'}
              onClick={(e) => toggle(e, layer.id, { visible: !layer.visible })}
            >
              {layer.visible ? 'V' : 'H'}
            </button>
            <button
              type="button"
              title={layer.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => toggle(e, layer.id, { locked: !layer.locked })}
            >
              {layer.locked ? 'L' : 'U'}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
