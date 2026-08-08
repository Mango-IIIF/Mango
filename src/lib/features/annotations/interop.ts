/**
 * Presentation 2 and loose-Presentation-3 input, translated to the shape the
 * parser reads.
 *
 * Vocabulary only. `on` becomes `target`, `full` becomes `source`, `oa:` types
 * lose their prefix, and a bare string target carrying a media fragment becomes
 * an explicit SpecificResource and FragmentSelector — the parser reads a
 * selector and treats a string target as an opaque IRI, which is correct of it
 * and leaves splitting the fragment to the consumer that knows a Canvas is
 * being addressed.
 *
 * No selector *value* is interpreted here. That is the parser's codec, and
 * Mango holding a second opinion about `xywh=` is what this migration removed.
 *
 * This lives beside the canonical adapter rather than in the IIIF resolver
 * because every route into the model needs it: a manifest, an annotation page,
 * a host calling `addAnnotation` with a plain object, and a repository reading
 * back what it stored.
 */

const MEDIA_FRAGMENTS = 'http://www.w3.org/TR/media-frags/';

/** `xywh=` and `t=`, the two media fragment dimensions IIIF uses. */
const isMediaFragment = (value: string): boolean => /^(?:xywh|t)=/.test(value);

const stripPrefix = (value: string): string =>
  value.replace(/^(?:oa|sc|dctypes|cnt):/, '');

/**
 * Rewrites a target into the Presentation 3 shape.
 *
 * Two translations, both vocabulary rather than semantics. A bare string target
 * with a media fragment becomes an explicit SpecificResource and
 * FragmentSelector, because the parser reads a selector and treats a string
 * target as an opaque IRI — which is correct of it, and leaves splitting the
 * fragment to the consumer that knows a Canvas is being addressed. Presentation
 * 2 spells the same construct with `full` and `oa:`-prefixed types.
 *
 * The fragment's *value* is never read here. That is the parser's codec, and
 * Mango having a second opinion about `xywh=` is what this migration removed.
 */
const toPresentation3Target = (target: unknown): unknown => {
  if (typeof target === 'string') {
    const hash = target.indexOf('#');
    if (hash < 0) return target;
    const fragment = target.slice(hash + 1);
    if (!isMediaFragment(fragment)) return target;
    return {
      type: 'SpecificResource',
      source: target.slice(0, hash),
      selector: { type: 'FragmentSelector', conformsTo: MEDIA_FRAGMENTS, value: fragment },
    };
  }
  if (Array.isArray(target)) return target.map(toPresentation3Target);
  if (!target || typeof target !== 'object') return target;

  const record = { ...(target as Record<string, unknown>) };
  if (!record.type && typeof record['@type'] === 'string') {
    record.type = stripPrefix(record['@type']);
  }
  // `full` is Presentation 2's name for the resource a SpecificResource is part
  // of. `@id` is only the source when nothing else names one.
  if (!record.source && record.full) record.source = record.full;
  if (!record.source && record.selector && typeof record['@id'] === 'string') {
    record.source = record['@id'];
  }

  const convertSelector = (selector: unknown): unknown => {
    if (!selector || typeof selector !== 'object') return selector;
    if (Array.isArray(selector)) return selector.map(convertSelector);
    const entry = { ...(selector as Record<string, unknown>) };
    if (!entry.type && typeof entry['@type'] === 'string') {
      entry.type = stripPrefix(entry['@type']);
    }
    if (
      entry.type === 'FragmentSelector' &&
      !entry.conformsTo &&
      typeof entry.value === 'string' &&
      isMediaFragment(entry.value)
    ) {
      entry.conformsTo = MEDIA_FRAGMENTS;
    }
    return entry;
  };
  const selector = record.selector ?? record.selectors;
  if (selector !== undefined) record.selector = convertSelector(selector);

  return record;
};

/**
 * Rewrites a Presentation 2 annotation into the Presentation 3 shape.
 *
 * Only the envelope: `on` becomes `target`, `resource` becomes `body`, and
 * `cnt:chars` becomes `value`. Everything inside — selector values, SVG,
 * fragments, legacy `oa:`/`sc:` motivations, 1×1 point regions — is the
 * parser's to interpret, and Mango reading any of it a second time is how the
 * two interpretations diverged in the first place.
 */
export const toPresentation3 = (annotation: Record<string, unknown>): Record<string, unknown> => {
  const converted: Record<string, unknown> = { ...annotation };

  if (!converted.type && converted['@type']) {
    converted.type = stripPrefix(String(converted['@type']));
  }
  if (!converted.id && typeof converted['@id'] === 'string') converted.id = converted['@id'];
  if (!converted.body && (converted.resource || converted.item)) {
    converted.body = converted.resource ?? converted.item;
  }

  const convertBody = (body: unknown): unknown => {
    if (!body || typeof body !== 'object') return body;
    if (Array.isArray(body)) return body.map(convertBody);
    const record = { ...(body as Record<string, unknown>) };
    if (!record.id && typeof record['@id'] === 'string') record.id = record['@id'];
    const declared = typeof record['@type'] === 'string' ? stripPrefix(record['@type']) : undefined;
    if (record.value === undefined) {
      const chars = record['cnt:chars'] ?? record.chars;
      if (typeof chars === 'string') record.value = chars;
    }
    if (!record.type) {
      // `oa:Tag` is Presentation 2's tag body. Its Presentation 3 equivalent is
      // a TextualBody with a tagging purpose, which is what makes it show up as
      // a tag rather than as an unrecognised resource carrying a string.
      if (declared === 'Tag') {
        record.type = 'TextualBody';
        if (!record.purpose) record.purpose = 'tagging';
      } else if (declared === 'ContentAsText' || declared === 'Text') {
        record.type = 'TextualBody';
      } else if (declared) {
        record.type = declared;
      }
    }
    return record;
  };
  if (converted.body !== undefined) converted.body = convertBody(converted.body);

  const target = converted.target ?? converted.on;
  if (target !== undefined) converted.target = toPresentation3Target(target);

  return converted;
};

