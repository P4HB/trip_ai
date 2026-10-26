# SPEC-042: outdoor_nature Companion batch 04 boundary review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-022](spec_022.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/11_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_04.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`
- Predecessor: [SPEC-022](spec_022.md)

## Background

The existing outdoor_nature batch 04 draft requires a source-grounded review of its 0.5, 0.75, and 1 boundaries. This review creates a separate output and leaves the supplied draft unchanged.

## Goals and non-goals

- Re-evaluate all 50 input places on five Companion axes from their `source_excerpt`.
- Do not force scores to the policy distribution targets or modify the input or current draft.
- Preserve the cafe unknown-intro exception if present; no such record is expected in this input.

## Requirements

- `REQ-4201`: Output all input records in source order with unchanged identifiers, title, and calibration family, and complete five-axis objects.
- `REQ-4202`: Reconsider every existing 0.5, 0.75, and 1 score using only source-grounded companion evidence; unsupported general nature/viewing social scores of 0.75 or higher become 0.5.
- `REQ-4203`: Adjust kids and parents scores when direct audience, safety, experience, or material friction evidence supports a higher or lower boundary.
- `REQ-4204`: Each output axis has a rationale citing a source fact, carries its input evidence IDs, and includes `CALIBRATED-BOUNDARY-REVIEW-V2`.
- `REQ-4205`: Write only `calibration_outputs/reviewed/reviewed_calibrated_batch_04.jsonl`; do not modify supplied input or draft files.

## Input and output

- Input: `calibration_inputs/11_outdoor_nature.jsonl` and the existing `calibration_outputs/batches/calibrated_batch_04.jsonl` (50 JSONL records each).
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_04.jsonl` (50 JSONL records).

## Decision rules

Policy target ranges are review warnings only. A score of `0` is relative lowest suitability, not a prohibition. Generic scenery or observation does not establish solo, couple, or friends suitability at `0.75` or above. Direct family/child audience, child-safe water activity, age availability, playground, or a material travel/safety friction changes only the applicable child/parent boundary. `cafe_unknown_intro` remains all `0.5` if encountered.

## Impact scope

- Added: this SPEC and the reviewed JSONL output.
- Compatibility: no canonical label, input, or current draft change.
- Security and privacy: no new data collection or personal data.

## Acceptance criteria

- `AC-4201`: Output has exactly 50 records, matching input order, IDs, titles, and calibration families.
- `AC-4202`: All 250 axes are complete numeric labels using allowed five-step values, `ai_draft`, null null-reason, source evidence IDs, and the review rule ID.
- `AC-4203`: Every rationale contains source-grounded text; cafe exception, if encountered, is unchanged at all-0.5.
- `AC-4204`: Existing input and draft files are byte-unchanged.

## Test plan

| Acceptance criterion | Validation |
|---|---|
| AC-4201 | JSONL parse and selected field/order comparison |
| AC-4202 | Schema, value, provenance, and axis completeness check |
| AC-4203 | Rationale and cafe-exception checks |
| AC-4204 | SHA-256 comparison captured before and after generation |

## Implementation results

- Added `calibration_outputs/reviewed/reviewed_calibrated_batch_04.jsonl` with 50 records and 250 complete Companion axes. The supplied input and draft were preserved.
- Added `scripts/archive/review_calibrated_batch_04.py` to make the source-grounded boundary decisions reproducible.
- Validation passed: ordered identifier/family comparison, complete five-axis schema, allowed values, source evidence IDs, review rule IDs, rationale presence, and cafe-exception check.
- Distribution: solo `{0.5: 50}`; couple `{0.5: 47, 1: 3}`; friends `{0.5: 49, 0.75: 1}`; kids `{0.25: 3, 0.5: 38, 0.75: 6, 1: 3}`; parents `{0.25: 2, 0.5: 44, 0.75: 4}`. Changed 63 of 250 axes from the supplied draft.

## Design differences

None.

## Known limitations

This remains an AI draft. Unlisted accessibility, age limits, operational safety, and weather conditions are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created boundary-review scope. |
| 2026-08-12 | Generated and validated 50 reviewed records. |
