/**
 * The Mango Annotation Profile.
 *
 * The parser decides whether a document is structurally valid. This file
 * decides which of the valid constructs Mango authors, and how a user chooses
 * between them. Keeping that in one place is what stops an application concept
 * reaching a standards field again: the vocabulary the inspector offers and the
 * vocabulary export validation enforces are read from the same list, so they
 * cannot drift the way a dropdown and a serializer did.
 */

import {
  ALL_MOTIVATIONS,
  PURPOSES,
  isKnownMotivation,
  isKnownPurpose,
  strictAuthoringProfile,
  baselineProfiles,
  type ValidationProfile,
} from '@mango-iiif/w3c-parser';

/**
 * A task-oriented authoring choice.
 *
 * Users pick what they are doing, not a term from a vocabulary. The mapping to
 * a motivation and a body purpose is the profile's job, which is why the raw
 * motivation dropdown is now an expert-mode control rather than the only way to
 * set one.
 */
export type MotivationPreset = {
  /** Stable id, used as the i18n key suffix and the select value. */
  id: string;
  motivation: string;
  /** Purpose applied to the body this preset authors, when it authors one. */
  bodyPurpose?: string;
  /** True when the preset may only be chosen in expert content-authoring mode. */
  expertOnly?: boolean;
};

/**
 * `commenting` leads because an ordinary authored annotation is commentary.
 * `painting` is last and expert-only: geometry is not a reason to claim an
 * annotation paints its Canvas, and defaulting to it is how Presentation 3
 * consumers end up treating a note as canvas content.
 */
export const MOTIVATION_PRESETS: readonly MotivationPreset[] = [
  { id: 'comment', motivation: 'commenting', bodyPurpose: 'commenting' },
  { id: 'describe', motivation: 'describing', bodyPurpose: 'describing' },
  { id: 'transcribe', motivation: 'supplementing', bodyPurpose: 'transcribing' },
  { id: 'tag', motivation: 'tagging', bodyPurpose: 'tagging' },
  { id: 'highlight', motivation: 'highlighting' },
  { id: 'classify', motivation: 'classifying', bodyPurpose: 'classifying' },
  { id: 'identify', motivation: 'identifying', bodyPurpose: 'identifying' },
  { id: 'paint', motivation: 'painting', expertOnly: true },
];

export const DEFAULT_MOTIVATION = 'commenting';
export const DEFAULT_BODY_PURPOSE = 'commenting';

/** Motivations Mango will author. Everything else is read-only if imported. */
export const AUTHORING_MOTIVATIONS: readonly string[] = [
  'commenting',
  'describing',
  'tagging',
  'highlighting',
  'classifying',
  'identifying',
  'assessing',
  'questioning',
  'supplementing',
];

/**
 * Motivations that require an explicit expert content-authoring mode.
 *
 * `painting` says the annotation *is* the Canvas content. A viewer that
 * believes it will render a research note as the image.
 */
export const EXPERT_MOTIVATIONS: readonly string[] = ['painting'];

export const isExpertMotivation = (value: string): boolean =>
  EXPERT_MOTIVATIONS.includes(value);

export const authoringMotivations = (expert = false): readonly string[] =>
  expert ? [...AUTHORING_MOTIVATIONS, ...EXPERT_MOTIVATIONS] : AUTHORING_MOTIVATIONS;

export const motivationPresets = (expert = false): readonly MotivationPreset[] =>
  expert ? MOTIVATION_PRESETS : MOTIVATION_PRESETS.filter((preset) => !preset.expertOnly);

export const presetForMotivation = (motivation: string): MotivationPreset | undefined =>
  MOTIVATION_PRESETS.find((preset) => preset.motivation === motivation);

/** Body purposes the inspector offers. A subset of the W3C purpose vocabulary. */
export const AUTHORING_PURPOSES: readonly string[] = [
  'commenting',
  'describing',
  'tagging',
  'classifying',
  'identifying',
  'transcribing',
  'editing',
];

/** Re-exported so callers validate against the parser's list, not a copy. */
export { ALL_MOTIVATIONS, PURPOSES, isKnownMotivation, isKnownPurpose };

/* ------------------------------------------------------------------------- */
/* Identity                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Prefix for annotations that have no server-assigned identity yet.
 *
 * A URN rather than an invented HTTP URL: a draft id must be impossible to
 * mistake for a resolvable one, because the whole point of marking it is that
 * something has to replace it before the document is published.
 */
export const DRAFT_ID_PREFIX = 'urn:mango:draft:annotation/';
export const DRAFT_PAGE_ID_PREFIX = 'urn:mango:draft:page/';

export const isDraftId = (id: string | undefined): boolean =>
  Boolean(id && id.startsWith('urn:mango:draft:'));

export const isHttpId = (id: string | undefined): boolean =>
  Boolean(id && /^https?:\/\//i.test(id));

let draftCounter = 0;

/**
 * Mints a draft identifier.
 *
 * Deliberately not random-only: a monotonic component keeps ids stable in test
 * order and readable in a diff, and the random component keeps two viewers on
 * the same page from colliding.
 */
export const mintDraftId = (): string =>
  `${DRAFT_ID_PREFIX}${(draftCounter += 1)}-${Math.random().toString(16).slice(2, 8)}`;

/* ------------------------------------------------------------------------- */
/* Mango extension namespace                                                  */
/* ------------------------------------------------------------------------- */

export const MANGO_EXTENSION_PREFIX = 'mango:';

/**
 * Annotation-level extension keys Mango writes.
 *
 * `mango:note` is the private note. Modelling it as an application field rather
 * than a `describing` body is the whole of the privacy guarantee: a body is
 * publishable content by construction, so a private note stored as one is a
 * private note that will be published the first time someone exports.
 */
export const MANGO_NOTE_KEY = `${MANGO_EXTENSION_PREFIX}note`;
export const MANGO_PROVENANCE_KEY = `${MANGO_EXTENSION_PREFIX}provenance`;
export const MANGO_LAYER_KEY = `${MANGO_EXTENSION_PREFIX}layer`;

/** Extension keys removed from any export not explicitly marked private. */
export const PRIVATE_EXTENSION_KEYS: readonly string[] = [MANGO_NOTE_KEY];

/**
 * Extension keys that carry Mango application state rather than user content.
 *
 * Excluded from standards-shaped output because they mean nothing outside
 * Mango, but not *private* — they are omitted for tidiness, not confidentiality,
 * and saying so keeps the privacy report honest about what it protects.
 */
export const APPLICATION_EXTENSION_KEYS: readonly string[] = [
  MANGO_PROVENANCE_KEY,
  MANGO_LAYER_KEY,
];

/* ------------------------------------------------------------------------- */
/* Validation                                                                 */
/* ------------------------------------------------------------------------- */

export type MangoProfileOptions = {
  /** Permit the expert-only motivations. */
  expert?: boolean;
  /** Require resolvable HTTP(S) ids. Off while a document is still a draft. */
  requireHttpIds?: boolean;
};

/**
 * Mango's authoring rules, expressed as a parser validation profile.
 *
 * Composed at the call site with `baselineProfiles` rather than replacing them:
 * structural validity is the parser's judgement and this only narrows which
 * valid documents Mango is willing to have authored.
 */
export const mangoAuthoringProfile = (options: MangoProfileOptions = {}): ValidationProfile =>
  strictAuthoringProfile({
    name: 'mango-authoring',
    allowedMotivations: authoringMotivations(options.expert),
    requireHttpIds: options.requireHttpIds ?? false,
  });

/** The full profile set for a Mango export: structure, IIIF, then Mango. */
export const mangoProfiles = (options: MangoProfileOptions = {}): ValidationProfile[] => [
  ...baselineProfiles,
  mangoAuthoringProfile(options),
];
