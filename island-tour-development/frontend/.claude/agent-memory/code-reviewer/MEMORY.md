# Code Reviewer Memory Index

- [ImageThumb component duplicated across tabs](frontend_imagethumb_duplication.md) — Identical `ImageThumb` component copy-pasted verbatim in highlights and inclusions tabs; should be extracted to a shared file
- [Translation form uses single RHF instance for all locales](frontend_translation_form_single_rhf.md) — `HighlightItem`/`InclusionItem` share one RHF instance across all locales; locale switching silently applies one locale's value to another
- [use-trips.ts — 'use client' directive on a hooks file](frontend_hooks_use_client_directive.md) — hooks file has `'use client'` at the top which is not valid/needed for a hooks module; directive belongs in components
- [Resolver cast anti-pattern repeated across tabs](frontend_resolver_cast.md) — `as unknown as Resolver<T>` cast repeated in highlights, inclusions, schedules, pricing tabs; symptom of mismatched Zod/RHF types
