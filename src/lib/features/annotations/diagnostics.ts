/**
 * Parser diagnostics, translated into things a Mango user can act on.
 *
 * The mapping keys on the parser's stable codes rather than its message text,
 * which is the whole reason the codes exist: a reworded parser message must not
 * silently stop matching, and a Mango message must not have to be a paraphrase
 * of a specification sentence. Codes with no Mango-facing meaning fall back to
 * the parser's own message in the advanced panel rather than inventing one.
 */

import type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from '@mango-iiif/w3c-parser';

/** Where a diagnostic surfaces. Determines which panel shows it. */
export type DiagnosticCategory = 'loading' | 'validation' | 'editing' | 'export';

export type MangoDiagnostic = {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  path: string;
  /** i18n key, or undefined when only the parser's own message is available. */
  messageKey?: string;
  /** The parser's message. Always kept, for the advanced panel and bug reports. */
  detail: string;
};

const KEY_ROOT = 'viewer.panels.annotations.diagnostics';

/**
 * Codes worth naming in Mango's own words.
 *
 * The test for inclusion is whether a user could do something differently
 * knowing this. "Your point was stored as a 1×1 region" changes what they
 * expect on re-export; "unexpected type at $.body[2].source" does not, and is
 * better shown verbatim than paraphrased badly.
 */
const MESSAGE_KEYS: Partial<Record<DiagnosticCode, string>> = {
  'motivation.looks-like-layer': `${KEY_ROOT}.layerAsMotivation`,
  'motivation.legacy-prefix': `${KEY_ROOT}.legacyMotivation`,
  'motivation.unknown-term': `${KEY_ROOT}.unknownMotivation`,
  'purpose.unknown-term': `${KEY_ROOT}.unknownPurpose`,
  'style.class-without-stylesheet': `${KEY_ROOT}.styleClassWithoutStylesheet`,
  'style.inline-non-portable': `${KEY_ROOT}.inlineStyleNotPortable`,
  'style.stylesheet-unreadable': `${KEY_ROOT}.stylesheetUnreadable`,
  'selector.legacy-point-fragment': `${KEY_ROOT}.legacyPoint`,
  'selector.unsupported-type': `${KEY_ROOT}.unsupportedSelector`,
  'selector.invalid-fragment': `${KEY_ROOT}.invalidFragment`,
  'svg.unparseable': `${KEY_ROOT}.geometryUnreadable`,
  'svg.no-supported-element': `${KEY_ROOT}.geometryUnreadable`,
  'svg.path-curve-flattened': `${KEY_ROOT}.curvesFlattened`,
  'svg.path-unsupported-command': `${KEY_ROOT}.pathPartiallyRead`,
  'svg.multiple-elements': `${KEY_ROOT}.multipleShapes`,
  'annotation.missing-id': `${KEY_ROOT}.missingId`,
  'annotation.missing-target': `${KEY_ROOT}.missingTarget`,
  'serialize.draft-identifier': `${KEY_ROOT}.draftIdentifier`,
  'serialize.dropped-extension': `${KEY_ROOT}.droppedExtension`,
  'serialize.lossy-normalization': `${KEY_ROOT}.lossyNormalization`,
  'patch.unknown-target': `${KEY_ROOT}.editTargetGone`,
  'patch.invalid-operation': `${KEY_ROOT}.editRefused`,
  'migrate.ambiguous': `${KEY_ROOT}.migrationAmbiguous`,
};

/** Every `limit.*` code means the same thing to a user: the document is too big. */
const LIMIT_KEY = `${KEY_ROOT}.limitExceeded`;

const messageKeyForCode = (code: DiagnosticCode): string | undefined =>
  code.startsWith('limit.') ? LIMIT_KEY : MESSAGE_KEYS[code];

const toMangoDiagnostic = (
  diagnostic: Diagnostic,
  category: DiagnosticCategory,
): MangoDiagnostic => ({
  code: diagnostic.code,
  severity: diagnostic.severity,
  category,
  path: diagnostic.path,
  messageKey: messageKeyForCode(diagnostic.code),
  detail: diagnostic.message,
});

export const toMangoDiagnostics = (
  diagnostics: readonly Diagnostic[],
  category: DiagnosticCategory,
): MangoDiagnostic[] =>
  diagnostics.map((diagnostic) => toMangoDiagnostic(diagnostic, category));

/**
 * Collapses a diagnostic list for display.
 *
 * A page of a thousand annotations parsed from one legacy export produces a
 * thousand identical `selector.legacy-point-fragment` entries, and a list of a
 * thousand identical lines is a list nobody reads. One entry per code with a
 * count is the same information at a size that gets looked at.
 */
export const summariseDiagnostics = (
  diagnostics: readonly MangoDiagnostic[],
): Array<MangoDiagnostic & { count: number }> => {
  const byCode = new Map<string, MangoDiagnostic & { count: number }>();
  for (const diagnostic of diagnostics) {
    const existing = byCode.get(diagnostic.code);
    if (existing) existing.count += 1;
    else byCode.set(diagnostic.code, { ...diagnostic, count: 1 });
  }
  const severityRank: Record<DiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
  return [...byCode.values()].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
};
