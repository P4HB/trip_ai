# SPEC-041: Activity-family Companion calibration batch 01

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/01_activity_family.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`
- Predecessor: [SPEC-022](spec_022.md)

## Background

The supplied activity-family calibration batch required an independent, source-grounded Companion draft. Canonical labels and supplied calibration inputs were preserved.

## Goals and non-goals

- Label all 50 records in input order on five relative Companion axes.
- Use the guide for decision boundaries only, without forcing a distribution.
- Do not label Month axes, infer social suitability from scenery, observation, or shopping alone, or promote output to canonical data.

## Requirements

- `REQ-4101`: Read every record's `source_excerpt`, `unknowns`, `evidence_ids`, and `calibration_family`, and emit all rows in input order.
- `REQ-4102`: Emit only `0`, `0.25`, `0.5`, `0.75`, or `1` with complete numeric AxisLabels for five Companion axes.
- `REQ-4103`: Every axis has `status=ai_draft`, `null_reason=null`, input evidence IDs, and `CALIBRATED-DIRECT-COMPANION-V1`.
- `REQ-4104`: Every rationale names a source fact or unknown and explains the score; any absent-introduction cafe would remain all-0.5 at confidence no greater than 0.3 with `inference_level=unknown`.
- `REQ-4105`: Do not modify existing inputs, canonical labels, or existing calibration outputs.

## Input and output

- Input: `calibration_inputs/01_activity_family.jsonl` (50 records).
- Output: `calibration_outputs/batches/calibrated_batch_01.jsonl` with `contentid`, `title`, `source_order`, `calibration_family`, and `companion_fit`.

## Decision rules

`0` is reserved for explicit severe mismatch, risk, or exclusion. `0.25` requires source-grounded unfavorable activity, environment, or audience evidence. `0.5` represents ordinary fit or insufficient party-specific evidence. `0.75` requires an actual activity, environment, or convenience advantage. `1` requires a direct target mention or at least two independent favorable facts. Unlisted accessibility, age, safety, booking, and social conditions were not inferred.

## Acceptance criteria and results

- `AC-4101`: 50 output records exactly match input order, identifiers, titles, and calibration families. Passed.
- `AC-4102`: 250 axes have complete allowed numeric AxisLabels, `ai_draft`, null reason, input evidence IDs, and required rule ID. Passed.
- `AC-4103`: Every rationale contains a source fact or unknown; high scores are source-supported; existing input and calibration files are unchanged. Passed.

Validation used JSONL parsing plus complete selected-order, schema, value, provenance, and rationale checks. Distribution: solo `{0.5: 32, 0.75: 18}`; couple `{0.5: 46, 0.75: 1, 1: 3}`; friends `{0.5: 48, 0.75: 1, 1: 1}`; kids `{0.25: 3, 0.5: 34, 0.75: 6, 1: 7}`; parents `{0.25: 2, 0.5: 44, 0.75: 3, 1: 1}`. Twenty-six places have equal values across all five axes; 20 are general retail entries with no party-specific source evidence.

## Known limitation

This is an AI draft; source excerpts do not establish unlisted accessibility, age, safety, booking, or group conditions.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated 50 records, and verified 250 axes. |
