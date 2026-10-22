# Domain docs

How engineering skills should consume this repo's domain documentation.

## Before exploring

Read the root `GLOSSARY.md` and the ADRs in `docs/adr/` that touch the area being changed. If either does not exist, proceed silently.

## Layout

This is a single-context repository:

```text
/
├── GLOSSARY.md
├── docs/adr/
└── src/
```

## Vocabulary and decisions

Use terms defined in `GLOSSARY.md` in issues, specifications, proposals, and tests. Do not replace glossary terms with avoided synonyms.

If planned work contradicts an ADR, surface the conflict explicitly instead of silently overriding the decision.
