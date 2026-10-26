# SPEC-048: Culture exhibition Companion calibration batch 09 boundary review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md), [SPEC-043](spec_043.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/08_culture_exhibition.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`
- Predecessor: [SPEC-043](spec_043.md)

## Background

Culture-exhibition input batch 08 has 50 places whose Companion labels require a source-grounded first assessment followed by a boundary review. Some records are general observation venues or retail records, for which social suitability must not be inferred.

## Goals

- Review every input row directly from `source_excerpt`, `unknowns`, and `evidence_ids`.
- Emit a new reviewed sidecar that retains only source-grounded Companion assessments.

## Non-goals

- Do not change the input, prior sidecars, canonical labels, or policy/anchor files.
- Do not force target ranges as score quotas or infer unprovided social, safety, or accessibility facts.

## Requirements

- `REQ-4801`: Preserve all 50 input rows, their order, `contentid`, `title`, `source_order`, and `calibration_family`.
- `REQ-4802`: Emit five complete numeric AxisLabel objects per row, with `status=ai_draft`, `null_reason=null`, input `evidence_ids`, and `CALIBRATED-BOUNDARY-REVIEW-V2` in every `rule_ids`.
- `REQ-4803`: Include a source fact or stated unknown in every rationale and apply the culture-exhibition policy/guide as a warning and anchor, not a quota.
- `REQ-4804`: Keep simple scenery, observation, or shopping at no more than 0.5 for solo/couple/friends unless the introduction directly supports that companion; assess kids/parents only from stated age, safety, activity, walking, or family evidence.

## Input and output

- Input: `calibration_inputs/08_culture_exhibition.jsonl` (JSONL, required).
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_09.jsonl` (JSONL, 50 rows, required).
- Companion axes: `solo`, `couple`, `friends`, `kids`, `parents`; permitted values are `0`, `0.25`, `0.5`, `0.75`, and `1`.

## Design

The review takes a documented first-pass score map, then applies boundary checks for unsupported social highs and direct child/family activity evidence. The output is rebuilt from the protected input so identifiers, unknowns, and evidence IDs remain traceable. Target-range deviations are reviewed warnings, not normalized.

## Exceptions and fallback

If `cafe_unknown_intro` appears, all axes remain `0.5`, confidence is at most `0.3`, and `inference_level` is `unknown`. No such row is expected in this culture-exhibition input.

## Impact scope

- Changed files: this SPEC, `docs/README.md`, and the new reviewed sidecar.
- Data migration: none.
- Compatibility and privacy: no external interface or personal-data change.

## Acceptance criteria

- `AC-4801`: Output has 50 rows in exactly the input identity/order/family sequence.
- `AC-4802`: All 250 axes are complete numeric objects with source/unknown-grounded rationales, preserved evidence IDs, and the review rule ID.
- `AC-4803`: Input and policy/anchor files remain byte-for-byte unchanged.

## Test plan

| Approval criterion | Validation | Command or location |
|---|---|---|
| AC-4801~AC-4803 | JSONL, schema, order, provenance, and protected-file hash checks | Inline Python validation from repository root |

## Implementation results

- Created `calibration_outputs/reviewed/reviewed_calibrated_batch_09.jsonl` with all 50 input rows and 250 complete numeric Companion AxisLabels.
- Added `scripts/archive/review_culture_batch_09.py` to reproduce the reviewed sidecar and retain the recorded first-pass map for audit statistics.
- Validation passed: identity/order/family preservation; allowed numeric values; complete AxisLabel schema; source fact and unknown in each rationale; evidence ID preservation; review rule IDs; and protected input/policy/anchor SHA-256 checks.
- Final axis distributions: solo `{0.5: 50}`, couple `{0.5: 50}`, friends `{0.5: 49, 1: 1}`, kids `{0.5: 43, 0.75: 4, 1: 3}`, parents `{0.5: 50}`. The review changed 8 axes from the recorded first pass; the target-range deviations were retained because the policy defines them as warnings rather than quotas.

## Design differences

None.

## Known limitations

This is an AI draft and does not assert facts beyond the supplied excerpts.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created for culture-exhibition batch 09 boundary review. |
| 2026-08-12 | Generated and validated the reviewed sidecar. |
