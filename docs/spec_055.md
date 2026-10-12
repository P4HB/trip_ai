# SPEC-055: outdoor_nature Companion final review batch 18

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-034](spec_034.md), [SPEC-050](spec_050.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/19_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## Background

The batch-18 `outdoor_nature` input requires a source-grounded first-pass Companion label and boundary review. The reviewed data remains separate from its input and earlier outputs.

## Goals and non-goals

- Review all 50 places on five Companion axes using each record's `source_excerpt`, `unknowns`, and `evidence_ids`.
- Treat policy distributions and guide values as boundary warnings and anchors, not quotas.
- Do not change inputs, canonical labels, or existing reviewed outputs.

## Requirements

- `REQ-5501`: Emit all input places in source order, preserving identity fields and calibration family, with five complete Companion-axis objects.
- `REQ-5502`: Use only source-grounded facts; scenery or passive observation alone must not yield high solo, couple, or friends scores.
- `REQ-5503`: Evaluate kids and parents from direct age, safety, activity, walking, or family evidence; `0` denotes relative lowest suitability, not a visit prohibition.
- `REQ-5504`: Each axis must use numeric state, `ai_draft`, null `null_reason`, input evidence IDs, and `CALIBRATED-BOUNDARY-REVIEW-V2`; rationale must state a source fact or unknown.
- `REQ-5505`: Write only `calibration_outputs/reviewed/reviewed_calibrated_batch_18.jsonl` as batch data output.

## Input and output

- Input: `calibration_inputs/19_outdoor_nature.jsonl`.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_18.jsonl`.

## Acceptance criteria and test plan

| Acceptance criterion | Validation |
|---|---|
| `AC-5501` | Parse JSONL and compare all 50 ordered identity/family tuples. |
| `AC-5502` | Validate all 250 complete axis objects, allowed values, status, null reason, provenance, rule ID, and rationale. |
| `AC-5503` | SHA-256 comparison confirms the input is unchanged. |

## Implementation results

- Added `calibration_outputs/reviewed/reviewed_calibrated_batch_18.jsonl` with 50 records and 250 complete labels, plus reproducible generator `scripts/review_calibrated_batch_18.py`.
- Validation passed for source order/identities, complete schema, numeric values, `ai_draft` status, null reasons, evidence IDs, required boundary-review rule, source-grounded rationales, and unchanged input SHA-256.
- First pass to boundary reread changed 0 axes. The review retained every non-neutral score only where source text supplied direct activity, age, family, walking, or constraint evidence.
- Distribution: solo `{0.5: 28, 0.75: 22}`; couple `{0.5: 50}`; friends `{0.5: 48, 0.75: 2}`; kids `{0.25: 5, 0.5: 36, 0.75: 4, 1: 5}`; parents `{0.25: 4, 0.5: 38, 0.75: 7, 1: 1}`. Eighteen places have the same score on all five axes.

## Design differences

None.

## Known limitations

Unlisted accessibility, age thresholds, operational safety, and weather conditions remain unknown and are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated, and validated batch-18 Companion final review. |
