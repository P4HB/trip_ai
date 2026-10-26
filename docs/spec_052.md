# SPEC-052: outdoor_nature Companion final review batch 15

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-034](spec_034.md), [SPEC-050](spec_050.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/16_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## Background

The 50 `outdoor_nature` records in calibration input 16 require source-grounded Companion labels followed by a separate boundary reread.

## Goals and non-goals

- Label every record on the five Companion axes using only its `source_excerpt`, `unknowns`, and `evidence_ids`.
- Apply the policy and guide as boundary anchors, not quotas, and write a new reviewed JSONL only.
- Do not modify the input, canonical labels, or existing calibration outputs.

## Requirements

- `REQ-5201`: Preserve input source order, identity fields, and calibration family for all 50 records.
- `REQ-5202`: Produce five complete numeric axis objects per record with `ai_draft` status, null `null_reason`, input evidence IDs, and `CALIBRATED-BOUNDARY-REVIEW-V2` rule ID.
- `REQ-5203`: Ground each rationale in a stated source fact or unknown; do not infer social suitability from scenery or observation alone.
- `REQ-5204`: Evaluate kids and parents from direct age, safety, activity, walking, or family evidence; score zero as relative lowest suitability.
- `REQ-5205`: Run and record a first-pass-to-boundary-review comparison.

## Input and output

- Input: `calibration_inputs/16_outdoor_nature.jsonl`.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_15.jsonl`.

## Acceptance criteria and test plan

| Acceptance criterion | Validation |
|---|---|
| `AC-5201` | Parse JSONL and compare ordered identifiers and family against all 50 input records. |
| `AC-5202` | Validate all 250 axis objects, fields, values, status, review rule, and provenance. |
| `AC-5203` | Check non-empty fact-or-unknown rationales and summarized distributions. |
| `AC-5204` | SHA-256 comparison confirms the input was not changed. |

## Implementation results

- Added `calibration_outputs/reviewed/reviewed_calibrated_batch_15.jsonl` with 50 records and 250 complete Companion labels; the input was read without modification (SHA-256: `d9c42df017997e9f7e1fd7e95ff2c7a970df755e9da6ddc5954cb1cdcdddf93d`).
- Added `scripts/archive/review_calibrated_batch_15.mjs` to make the first-pass decisions and the boundary-review comparison reproducible.
- Validation passed: JSONL parse, input-order identity comparison, five-axis schema, allowed values, `ai_draft` status, null null-reasons, evidence-ID equality, review rule ID, and non-empty rationales.
- Distribution: solo `{0.5: 26, 0.75: 24}`; couple `{0.5: 45, 0.75: 4, 1: 1}`; friends `{0.5: 47, 0.75: 3}`; kids `{0: 1, 0.25: 20, 0.5: 20, 0.75: 9}`; parents `{0.25: 22, 0.5: 28}`. Thirteen places have the same value on all five axes.
- Boundary reread changed 3 axes: Gaseoreum kids `0.25→0`, Gaksibawieoreum kids `0.5→0.25`, and Dwigubeunieoreum parents `0.5→0.25`, each because the source explicitly states a route hazard or steep section.

## Design differences

None.

## Known limitations

Unlisted route difficulty, accessibility, operating conditions, and age restrictions remain unknown and are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated, and validated batch 15 final review. |
