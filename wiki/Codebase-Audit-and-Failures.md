# Project status and known limitations

Mango is actively developed. This page highlights limitations that matter to
integrators and contributors; it is not a substitute for the current issue
tracker or release notes.

## Before adopting Mango

- Test representative institutional resources rather than only a single public
  Manifest.
- Pin an exact npm version in production.
- Confirm CORS and Content Security Policy behaviour on the production origin.
- Plan host-side storage for authored annotations and stories.
- Review [IIIF support](IIIF-Conformance), especially Content State and
  Authentication limitations.

## Standards roadmap

The most valuable interoperability improvements are:

1. Complete Content State ingestion and shared viewer positions.
2. Add Collection browsing and multi-volume navigation.
3. Support `viewingDirection` and a broader set of Presentation behaviours.
4. Provide explicit `Choice` and multi-body selection UI.
5. Add IIIF Authentication flows for restricted material.
6. Improve portable story and annotation round-tripping.

## Multi-instance and lifecycle work

The Content Search request controller is currently module-scoped. On a page with
more than one Mango viewer, a search in one viewer can cancel a search in
another. Search request state should become viewer-instance state.

An annotation-derived store also keeps a manually created subscription without
retaining its unsubscribe callback. Contributors should move this effect behind
an explicit lifecycle with cleanup.

Remote annotation stylesheets are fetched into the viewer's style host. They are
not yet fully scoped, validated, or removed during viewer teardown. Only consume
annotation stylesheets from trusted sources.

Plugin lifecycle failures are available through the viewer event bus but are not
yet bridged to custom-element DOM events. Story viewer errors are also not
consistently forwarded through every public entry point. Host applications
should keep fallback item content visible when story or extension UI fails.

## Security boundaries

Remote metadata and annotation HTML rendered through Svelte `{@html}` is passed
through Mango's HTML sanitiser. This reduces risk but does not remove the need to
treat all IIIF resources as untrusted input, maintain a restrictive Content
Security Policy, and test new rendering paths.

Authentication, authorisation, annotation storage, story storage, audit trails,
and retention are responsibilities of the host application.

## Engineering health

As of 19 July 2026, the repository lint check is green and CI and npm publishing
workflows are tracked. The repository still contains an invalid placeholder
Dependabot ecosystem value, so automated dependency updates are not correctly
configured.

Status counts become stale quickly. Contributors should use the current CI run,
test output, dependency audit, and issue tracker rather than copying numbers from
this page into planning documents.

## Reporting a problem

When opening an issue, include:

- the Mango package version or commit;
- the affected browser and operating system;
- a public or reduced IIIF resource that reproduces the problem;
- the viewer mode and configuration;
- console/network errors with sensitive values removed; and
- expected and actual behaviour.

For IIIF issues, identify the relevant property or specification section and
state whether the failure is parsing, rendering, interaction, authoring, or
round-tripping.
