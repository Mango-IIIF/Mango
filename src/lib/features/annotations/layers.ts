/**
 * Durable annotation layers.
 *
 * A layer has an identity that is not its name, not its colour, and not its CSS
 * class. That separation is the whole point: renaming a layer or recolouring it
 * must not move a single annotation, and it must not change what any annotation
 * means. The identity is what annotations reference; everything else is
 * presentation the user is free to change.
 *
 * Three different things get called "layer" nearby, so, precisely:
 *
 * - a **display filter** hides a layer's annotations from the stage, and is not
 *   stored on any annotation;
 * - **membership** is the layer an annotation belongs to, stored as the target's
 *   `styleClass`; and
 * - an **AnnotationPage** is a storage container, unrelated to either.
 */

export type AnnotationLayer = {
  /** Stable identity. Never derived from the name or the colour. */
  id: string;
  name: string;
  color: string;
  /** Drawn on the stage. A view state, never a property of an annotation. */
  visible: boolean;
  /** Archived layers keep their annotations but are out of the way. */
  archived?: boolean;
  /** Nothing new can be drawn into a read-only layer. */
  readOnly?: boolean;
  description?: string;
};

/** Colours offered to a new layer, in order. */
export const LAYER_PALETTE = [
  '#fb7185',
  '#2ac7ff',
  '#22c55e',
  '#06b6d4',
  '#818cf8',
  '#ec4899',
] as const;

export const DEFAULT_LAYER_COLOR = '#a78bfa';
export const DEFAULT_LAYER_ID = 'mine';

/**
 * A display name for a layer id that arrived without one.
 *
 * An annotation can name a layer Mango has never seen — it came from another
 * tool, or from a colleague's export. Rather than dropping it or inventing a
 * number, the id itself is made presentable and the layer joins the list.
 */
export const nameForLayerId = (layerId: string): string =>
  layerId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Layer';

/** The next unused `layer-N` id. */
export const nextLayerId = (layers: readonly AnnotationLayer[]): string => {
  let index = layers.length + 1;
  let id = `layer-${index}`;
  while (layers.some((layer) => layer.id === id)) {
    index += 1;
    id = `layer-${index}`;
  }
  return id;
};

export const createLayer = (layers: readonly AnnotationLayer[]): AnnotationLayer => {
  const id = nextLayerId(layers);
  const index = Number.parseInt(id.replace('layer-', ''), 10) || layers.length + 1;
  return {
    id,
    name: `Layer ${index}`,
    color: LAYER_PALETTE[(index - 1) % LAYER_PALETTE.length] ?? DEFAULT_LAYER_COLOR,
    visible: true,
  };
};

export const renameLayer = (
  layers: readonly AnnotationLayer[],
  id: string,
  name: string,
): AnnotationLayer[] =>
  // The id is untouched. A rename that changed identity would silently orphan
  // every annotation already in the layer.
  layers.map((layer) => (layer.id === id ? { ...layer, name: name.trim() || layer.name } : layer));

export const recolourLayer = (
  layers: readonly AnnotationLayer[],
  id: string,
  color: string,
): AnnotationLayer[] => layers.map((layer) => (layer.id === id ? { ...layer, color } : layer));

export const setLayerVisibility = (
  layers: readonly AnnotationLayer[],
  id: string,
  visible: boolean,
): AnnotationLayer[] => layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer));

/**
 * Moves a layer up or down the list.
 *
 * Order is presentation: it decides what the panel lists first and what draws on
 * top. It is not membership, so reordering never touches an annotation.
 */
export const moveLayer = (
  layers: readonly AnnotationLayer[],
  id: string,
  direction: -1 | 1,
): AnnotationLayer[] => {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) return [...layers];
  const target = index + direction;
  if (target < 0 || target >= layers.length) return [...layers];
  const next = [...layers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * Archives a layer rather than deleting it.
 *
 * Deleting would raise a question with no good answer: what happens to the
 * annotations in it? Archiving takes the layer out of the way and leaves every
 * annotation exactly where it is, still reachable through the list filter.
 */
export const archiveLayer = (
  layers: readonly AnnotationLayer[],
  id: string,
  archived = true,
): AnnotationLayer[] =>
  layers.map((layer) =>
    layer.id === id ? { ...layer, archived, visible: archived ? false : layer.visible } : layer,
  );

export const setLayerReadOnly = (
  layers: readonly AnnotationLayer[],
  id: string,
  readOnly: boolean,
): AnnotationLayer[] => layers.map((layer) => (layer.id === id ? { ...layer, readOnly } : layer));

/** Layers offered for drawing into: present, not archived, not read-only. */
export const writableLayers = (layers: readonly AnnotationLayer[]): AnnotationLayer[] =>
  layers.filter((layer) => !layer.archived && !layer.readOnly);

/**
 * The layer a new annotation should go into.
 *
 * Falls forward to the first writable layer rather than silently drawing into an
 * archived or read-only one, and only then to the default.
 */
export const resolveActiveLayer = (
  layers: readonly AnnotationLayer[],
  preferred: string,
): string => {
  const writable = writableLayers(layers);
  if (writable.some((layer) => layer.id === preferred)) return preferred;
  return writable[0]?.id ?? preferred;
};

/** Adds layers named by annotations but not yet known. */
export const mergeDiscoveredLayers = (
  layers: readonly AnnotationLayer[],
  discovered: ReadonlyArray<{ id: string; color?: string }>,
): AnnotationLayer[] => {
  const known = new Set(layers.map((layer) => layer.id));
  const additions: AnnotationLayer[] = [];
  for (const entry of discovered) {
    const id = entry.id.trim();
    if (!id || known.has(id)) continue;
    known.add(id);
    additions.push({
      id,
      name: nameForLayerId(id),
      color: entry.color ?? DEFAULT_LAYER_COLOR,
      visible: true,
    });
  }
  return additions.length ? [...layers, ...additions] : [...layers];
};

/* ------------------------------------------------------------------------- */
/* Persistence                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Layer metadata as stored.
 *
 * Versioned because layers are the kind of thing that grows fields, and a
 * reader that cannot tell which shape it is holding has to guess.
 */
export type StoredLayers = {
  version: 1;
  layers: AnnotationLayer[];
};

export const serializeLayers = (layers: readonly AnnotationLayer[]): StoredLayers => ({
  version: 1,
  layers: layers.map((layer) => ({ ...layer })),
});

/**
 * Reads stored layer metadata, ignoring anything malformed.
 *
 * Layer state is convenience, not content: a corrupt record should cost the
 * user their colour choices, not their annotations, so this never throws.
 */
export const parseLayers = (value: unknown): AnnotationLayer[] | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StoredLayers>;
  if (record.version !== 1 || !Array.isArray(record.layers)) return null;

  const layers: AnnotationLayer[] = [];
  for (const entry of record.layers) {
    if (!entry || typeof entry !== 'object') continue;
    const layer = entry as Partial<AnnotationLayer>;
    if (typeof layer.id !== 'string' || !layer.id.trim()) continue;
    layers.push({
      id: layer.id,
      name: typeof layer.name === 'string' && layer.name ? layer.name : nameForLayerId(layer.id),
      color: typeof layer.color === 'string' ? layer.color : DEFAULT_LAYER_COLOR,
      visible: layer.visible !== false,
      ...(layer.archived ? { archived: true } : {}),
      ...(layer.readOnly ? { readOnly: true } : {}),
      ...(typeof layer.description === 'string' ? { description: layer.description } : {}),
    });
  }
  return layers.length ? layers : null;
};
