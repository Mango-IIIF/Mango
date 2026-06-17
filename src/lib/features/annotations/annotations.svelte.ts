import type { W3CAnnotation } from './W3CParser';

export type AnnotationStore = ReturnType<typeof createAnnotationStore>;

export function createAnnotationStore() {
  let items = $state<W3CAnnotation[]>([]);
  let activeId = $state<string | null>(null);
  let hoverId = $state<string | null>(null);

  return {
    get items() {
      return items;
    },
    get activeId() {
      return activeId;
    },
    get hoverId() {
      return hoverId;
    },
    setItems(next: W3CAnnotation[]) {
      items = [...next];
    },
    add(item: W3CAnnotation) {
      items = [...items, item];
    },
    update(id: string, updated: Partial<W3CAnnotation>) {
      items = items.map((item) => (item.id === id ? ({ ...item, ...updated } as W3CAnnotation) : item));
    },
    remove(id: string) {
      items = items.filter((item) => item.id !== id);
      if (activeId === id) activeId = null;
      if (hoverId === id) hoverId = null;
    },
    setActive(id: string | null) {
      activeId = id;
    },
    setHover(id: string | null) {
      hoverId = id;
    },
  };
}
