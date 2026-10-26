# SPEC-046: Activity-family calibration batch 01 Companion boundary review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md), [SPEC-041](spec_041.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/01_activity_family.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_01.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/companion_calibration_policy.md`
- Predecessor: [SPEC-041](spec_041.md)

## Background

The activity-family batch 01 draft requires a source-excerpt review of every `0.5`, `0.75`, and `1` boundary. Policy ranges are review alerts, not quotas; unsupported high solo/couple/friends scores and directly supported kids/parents axes need special attention.

## Goals and non-goals

- Create an additive reviewed JSONL for all 50 records with complete Companion AxisLabels.
- Preserve the input, original draft, canonical labels, month labels, policy, and guide; do not force score quotas.

## Requirements

- `REQ-4601`: Emit every input record in unchanged order with unchanged `contentid`, `title`, `source_order`, `calibration_family`, and five complete numeric AxisLabels.
- `REQ-4602`: Reconsider all original `0.5`, `0.75`, and `1` values from `source_excerpt`; general nature, observation, and shopping-only solo/couple/friends highs become `0.5` unless actual individual, pair, or group activity is stated.
- `REQ-4603`: Re-evaluate kids/parents `0.5` where the excerpt directly states an age/family target, safety, convenience, or actual activity; `0` remains a relative lowest score, not a prohibition.
- `REQ-4604`: Each AxisLabel retains source evidence IDs and `status=ai_draft`, includes `CALIBRATED-BOUNDARY-REVIEW-V2` in `rule_ids`, and has a rationale grounded in a source-excerpt fact or stated unknown.
- `REQ-4605`: Retain every `cafe_unknown_intro` axis at `0.5` if encountered; this input has none.

## Input and output

- Input: `calibration_inputs/01_activity_family.jsonl`, original batch 01 draft, policy, and guide.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_01.jsonl` (UTF-8 JSONL, 50 records).

## Design and fallback

The original draft identifies candidates only; the source excerpt controls each axis. Named companions, direct age/family targets, safety, convenience, or actual activity can support a high score; explicit strenuous or risky evidence can support a lower score; otherwise use `0.5`. Do not infer unlisted accessibility, group size, age, or safety.

## Impact scope

- Changed files: this SPEC, `docs/README.md`, `scripts/archive/generate_reviewed_calibrated_batch_01.py`, and the reviewed JSONL sidecar.
- Data migration, compatibility, security, and privacy effects: none; this is an additive AI-draft sidecar.

## Acceptance criteria

- `AC-4601`: Output has 50 records matching input identifiers, titles, source order, and family values.
- `AC-4602`: Output has 250 complete valid AxisLabels with source-grounded rationales and the review rule ID.
- `AC-4603`: Input and original draft remain byte-identical.
- `AC-4604`: Report per-axis distributions, changed-axis total, and three `0.5`↔`0.75/1` boundary changes.

## Test plan

| Approval criterion | Validation | Command or location |
|---|---|---|
| AC-4601~AC-4603 | JSONL/order/schema/value/provenance/rationale checks and protected-file SHA-256 comparison | Inline Python from repository root |
| AC-4604 | Compare original and reviewed values and aggregate per axis | Inline Python from repository root |

## Implementation results

Created `calibration_outputs/reviewed/reviewed_calibrated_batch_01.jsonl` with all 50 input records and 250 complete Companion AxisLabels. The output SHA-256 is `7ec4a83a5d5ff9b356b88b638b75d30ceaa4c2920d25484286037aa9f0df2548`. Fourteen axes changed from the original draft. Final distributions are solo `{0.5: 41, 0.75: 9}`, couple `{0.5: 46, 0.75: 2, 1: 2}`, friends `{0.5: 48, 0.75: 1, 1: 1}`, kids `{0.25: 3, 0.5: 36, 0.75: 4, 1: 7}`, and parents `{0.25: 2, 0.5: 42, 0.75: 5, 1: 1}`.

Validation passed: Python syntax compilation; 50-row input/draft/output order and identity check; 250-axis state, allowed value, status, null reason, evidence ID, rationale, and review rule check; and original-versus-reviewed change aggregation. The input and original draft were read only by the generator and were not changed.

## Design differences

None.

## Known limitations

This remains an AI draft; source excerpts do not establish unstated companion, accessibility, or safety conditions.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created for activity-family batch 01 boundary review. |
| 2026-08-12 | Generated and validated 50-row reviewed sidecar. |
