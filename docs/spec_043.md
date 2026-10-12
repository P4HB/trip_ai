# SPEC-043: Culture exhibition Companion boundary review batch 02

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md), [SPEC-037](spec_037.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/07_culture_exhibition.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_02.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`
- Predecessor: [SPEC-037](spec_037.md)

## Background

The existing culture-exhibition batch 02 draft contains boundary scores that need a source-grounded review. General observation, nature, and shopping evidence must not by itself produce high solo, couple, or friends scores; evidence specific to children or parents must be reflected where present.

## Goals

- Review every `0.5`, `0.75`, and `1` Companion axis against its input `source_excerpt`, policy, and same-family anchors.
- Create a new reviewed sidecar without changing the input, canonical labels, or prior draft.

## Non-goals

- Do not force labels to a quota, add Month labels, or assert unprovided accessibility, age, or safety facts.

## Requirements

- `REQ-4301`: Emit all 50 input rows in unchanged order with unchanged `contentid`, `title`, `source_order`, and `calibration_family`.
- `REQ-4302`: Preserve five complete numeric AxisLabels per row; every rationale includes an actual `source_excerpt` fact and every axis includes `CALIBRATED-BOUNDARY-REVIEW-V2` in `rule_ids`.
- `REQ-4303`: Reconsider high axes first when a policy target upper bound is materially exceeded, without treating target ranges as quotas.
- `REQ-4304`: Reduce general nature, observation, and shopping-only solo/couple/friends scores of `0.75` or higher to `0.5` unless source text provides actual solo, pair, or group activity evidence; adjust children/parents values where direct target, safety, or activity evidence warrants it.

## Input and output

- Input: `calibration_inputs/07_culture_exhibition.jsonl`.
- Draft under review: `calibration_outputs/batches/calibrated_batch_02.jsonl`.
- Policy and anchors: `companion_calibration_policy.md`, `calibration_outputs/companion_calibration_guide.json`.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_02.jsonl`.

## Design

The review retains the AxisLabel schema and source evidence IDs. It rebuilds the axis rationale from each row's source introduction, records a boundary-specific reason, and appends the review rule ID. Existing `cafe_unknown_intro` exception behavior is preserved if encountered; this culture-exhibition input has no such row.

## Exceptions and fallback

Missing companion-specific evidence remains `0.5`; it is not treated as a prohibition. `0`, `0.25`, `0.5`, `0.75`, and `1` retain their policy meanings.

## Impact scope

- Changed files: this SPEC, `docs/README.md`, and the new reviewed JSONL sidecar.
- Data migration: none.
- Compatibility and privacy: no canonical schema, external interface, or personal data change.

## Acceptance criteria

- `AC-4301`: The reviewed JSONL has exactly 50 rows and matches the input identifiers, order, titles, and family.
- `AC-4302`: All 250 axes have valid complete AxisLabels, source-grounded rationales, and the review rule ID.
- `AC-4303`: Input and prior draft remain byte-for-byte unchanged.

## Test plan

| Approval criterion | Validation | Command or location |
|---|---|---|
| AC-4301~AC-4303 | JSONL/schema/provenance/order and protected-input checks | Inline Python validation from repository root |

## Implementation results

- Created `calibration_outputs/reviewed/reviewed_calibrated_batch_02.jsonl` with all 50 input rows and 250 complete Companion AxisLabels.
- Added `scripts/review_culture_batch_02.py` to reproduce the reviewed sidecar from the protected input and draft.
- Validation passed: identifier/order/family preservation; permitted numeric values; complete axis schema; evidence IDs; source-grounded rationales; review rule IDs; and protected input/draft SHA-256 checks.
- Final axis distributions: solo `{0.5: 50}`, couple `{0.5: 48, 0.75: 1, 1: 1}`, friends `{0.5: 48, 1: 2}`, kids `{0.25: 5, 0.5: 25, 0.75: 12, 1: 8}`, parents `{0.25: 7, 0.5: 38, 0.75: 5}`. The review changed 60 axes from the draft.

## Design differences

None.

## Known limitations

This remains an AI draft; facts not contained in the supplied source excerpts are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created for boundary review of culture-exhibition batch 02. |
| 2026-08-12 | Generated and validated the reviewed sidecar. |
