# SPEC-050: outdoor_nature Companion calibration batch 11 boundary review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-022](spec_022.md), [SPEC-042](spec_042.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/12_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## Background

The outdoor_nature batch 11 input needs a source-grounded first-pass Companion label and a boundary review. The reviewed result remains separate from its input.

## Goals and non-goals

- Re-evaluate all 50 input places on five Companion axes from `source_excerpt`, `unknowns`, and `evidence_ids`.
- Apply the policy and guide as boundary anchors, not score quotas.
- Do not alter the supplied input or any existing output.

## Requirements

- `REQ-5001`: Output every input record in source order, preserving identifier fields and `calibration_family`, with five complete Companion-axis objects.
- `REQ-5002`: Use source-grounded facts only; generic scenery, observation, or shopping cannot alone justify high solo, couple, or friends scores.
- `REQ-5003`: Evaluate kids and parents from direct age, safety, activity, walking, and family evidence; score `0` as relative lowest suitability rather than a visit prohibition.
- `REQ-5004`: Each axis uses `state=numeric`, `status=ai_draft`, null `null_reason`, input evidence IDs, and `CALIBRATED-BOUNDARY-REVIEW-V2` in `rule_ids`; rationale includes a source fact or unknown.
- `REQ-5005`: Preserve the `cafe_unknown_intro` exception if encountered: all axes `0.5`, confidence at most `0.3`, and `inference_level=unknown`.
- `REQ-5006`: Write only the new reviewed batch-11 JSONL as its data output.

## Input and output

- Input: `calibration_inputs/12_outdoor_nature.jsonl`.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_11.jsonl`.

## Impact scope

- Added: this SPEC, the reviewed JSONL output, and a reproducible generation script.
- Compatibility: input and existing outputs are preserved; no canonical labels change.
- Security and privacy: no new data collection or personal data.

## Acceptance criteria and test plan

| Acceptance criterion | Validation |
|---|---|
| `AC-5001` | JSONL parse and ordered identifier/family comparison for 50 records |
| `AC-5002` | Schema, five-step value, status, provenance, and axis completeness validation for 250 labels |
| `AC-5003` | Rationale and cafe-exception checks |
| `AC-5004` | SHA-256 comparison confirms input is unchanged |

## Implementation results

- Added `calibration_outputs/reviewed/reviewed_calibrated_batch_11.jsonl` with 50 records and 250 complete Companion labels; the input hash was unchanged.
- Added `scripts/archive/review_calibrated_batch_11.py` to make the source-grounded first-pass and boundary decisions reproducible.
- Validation passed: input-order comparison, complete schema, allowed values, `ai_draft` status, null null-reasons, input evidence IDs, review rule IDs, and non-empty source-grounded rationales.
- Distribution: solo `{0.5: 41, 0.75: 9}`; couple `{0.5: 49, 1: 1}`; friends `{0.5: 49, 1: 1}`; kids `{0: 1, 0.25: 7, 0.5: 32, 0.75: 9, 1: 1}`; parents `{0.25: 6, 0.5: 40, 0.75: 3, 1: 1}`. Thirty-one places have the same score on all five axes.
- Boundary reread changed 0 axes from the first-pass decisions; every non-neutral decision retained direct source support.

## Design differences

None.

## Known limitations

Unlisted accessibility, age limits, operational safety, and weather conditions remain unknown and are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated, and validated batch 11 review. |
