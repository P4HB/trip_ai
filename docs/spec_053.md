# SPEC-053: outdoor_nature Companion calibration batch 17 final review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-022](spec_022.md), [SPEC-049](spec_049.md), [SPEC-050](spec_050.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/18_outdoor_nature.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## Background

The outdoor_nature batch 17 input requires a source-grounded first-pass Companion assessment and a boundary reread. The reviewed sidecar must be additive and preserve the supplied inputs.

## Goals and non-goals

- Assess all 50 places on the five Companion axes from `source_excerpt`, `unknowns`, and `evidence_ids`.
- Apply the policy and calibration guide as warnings and boundary anchors, never as quotas.
- Do not alter the input, policy, guide, canonical labels, or existing outputs.

## Requirements

- `REQ-5301`: Preserve all input rows, order, identifiers, titles, and calibration family in the reviewed JSONL.
- `REQ-5302`: Emit five complete numeric AxisLabels per place using only source-grounded companion, age, activity, safety, walking, or family evidence.
- `REQ-5303`: Do not raise solo, couple, or friends from scenery or observation alone; do not infer unstated social suitability.
- `REQ-5304`: Treat `0` as relative lowest suitability, not a visit prohibition; include unknowns where age, safety, or access conditions are not stated.
- `REQ-5305`: Every AxisLabel uses `status=ai_draft`, `null_reason=null`, input evidence IDs, and `CALIBRATED-BOUNDARY-REVIEW-V2` in `rule_ids`.
- `REQ-5306`: Perform an in-memory first pass followed by boundary review; write only the final reviewed sidecar as data output.

## Input and output

- Input: `calibration_inputs/18_outdoor_nature.jsonl` (50 records).
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_17.jsonl` (50 JSONL records, 250 axes).

## Impact scope

- Changed files: this SPEC, `docs/README.md`, `scripts/archive/review_calibrated_batch_17.py`, and the reviewed JSONL output.
- Compatibility: input and existing calibration outputs remain unchanged; no canonical label changes.
- Security and privacy: no new collection or personal data.

## Acceptance criteria and test plan

| Acceptance criterion | Validation |
|---|---|
| `AC-5301` | Parse JSONL and compare all ordered identity fields to input. |
| `AC-5302` | Validate 250 complete AxisLabels, allowed values, status, null reason, evidence IDs, and review rule. |
| `AC-5303` | Check every rationale has a source fact or explicit unknown and review direct evidence for every non-neutral value. |
| `AC-5304` | Compare input SHA-256 before and after generation; report first-pass-to-review changes and distributions. |

## Implementation results

- Added `calibration_outputs/reviewed/reviewed_calibrated_batch_17.jsonl` with 50 input-ordered records and 250 complete Companion AxisLabels.
- Added `scripts/archive/review_calibrated_batch_17.py`, which holds the first-pass decisions in memory, applies three documented boundary changes, writes only the final reviewed sidecar, and validates its schema.
- Validation passed: ordered identifiers/family match, allowed five-step values, complete AxisLabel fields, `ai_draft` status, null null-reasons, input evidence IDs, review rule IDs, source-fact/unknown rationales, and unchanged input SHA-256 (`439c1728414c0344cd3b33c4e946329c2deb27925ebc740bc19473508a1d8f3d`).
- Final distribution: solo `{0.5: 50}`; couple `{0.5: 48, 0.75: 2}`; friends `{0.5: 46, 0.75: 4}`; kids `{0.25: 3, 0.5: 31, 0.75: 13, 1: 3}`; parents `{0.25: 3, 0.5: 45, 0.75: 1, 1: 1}`. Twenty-eight places have the same value on all five axes.
- Boundary reread changed three axes: transparent-kayak couple `0.75→0.5` (view/two-person boarding is not couple support), camel-trekking kids `0.75→0.5` (guide safety without child eligibility), and ferry solo `0.75→0.5` (safe passenger service is not solo-specific support).

## Design differences

None.

## Known limitations

Unstated accessibility, age restrictions, operational safety, and weather conditions remain unknown and are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated, and validated batch 17 review. |
