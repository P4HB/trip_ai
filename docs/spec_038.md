# SPEC-038: Culture exhibition calibration batch 02

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md), [SPEC-036](spec_036.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/07_culture_exhibition.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/companion_calibration_guide.json`

## Background

The supplied 50-place culture-exhibition calibration batch needs an independent Companion-label sidecar. It does not replace canonical labels or modify its input.

## Goals and non-goals

- Create five directly evidenced Companion AI-draft labels for every input row in input order.
- Use the calibration guide as a boundary-case reference only; do not force its distribution.
- Do not label Month axes, promote labels to canonical data, or infer social suitability absent from source text.

## Requirements

- `REQ-3801`: Emit all 50 input places with unchanged identifiers, order, and `calibration_family`.
- `REQ-3802`: Every Companion axis is numeric (`0`, `0.25`, `0.5`, `0.75`, or `1`) and has a complete AxisLabel with `status=ai_draft` and `null_reason=null`.
- `REQ-3803`: Each rationale summarizes an input source fact or explicit unknown; evidence IDs are preserved and rule IDs include `CALIBRATED-DIRECT-COMPANION-V1`.
- `REQ-3804`: Directly named companions or two independent supporting facts may score 1; scenery, observation, and shopping alone do not raise couple or friends.

## Input and output

- Input: `calibration_inputs/07_culture_exhibition.jsonl`.
- Reference: `calibration_outputs/companion_calibration_guide.json`.
- Output: `calibration_outputs/batches/calibrated_batch_02.jsonl`.

## Acceptance criteria and test plan

- `AC-3801`: Output parses as JSONL and contains exactly the 50 input records in order.
- `AC-3802`: All 250 axes pass required-field, allowed-value, provenance, and rationale checks.
- `AC-3803`: Input and existing canonical files are unchanged.

Validation parses both JSONL files and checks selected order, axis coverage, states, values, evidence IDs, rule IDs, null reasons, and rationales.

## Implementation results

Created `calibration_outputs/batches/calibrated_batch_02.jsonl` with all 50 input places and 250 independent Companion AxisLabels. The input, calibration guide, and canonical labels were not modified.

Validation passed JSONL parsing, input-order and identifier equality, five-axis coverage, allowed values, complete provenance fields, required rule ID, evidence-ID preservation, nonempty rationales, numeric confidence bounds, `ai_draft`, and null reasons.

Distribution: solo `{0.5: 15, 0.75: 35}`; couple `{0.5: 48, 1: 2}`; friends `{0.5: 44, 0.75: 3, 1: 3}`; kids `{0.25: 6, 0.5: 22, 0.75: 13, 1: 9}`; parents `{0.25: 9, 0.5: 38, 0.75: 3}`. Eight places have the same value on all five axes.

## Known limitation

This is an AI draft. Accessibility, age conditions, and changing operating details not stated in the input are not asserted.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created for independent culture-exhibition batch 02 calibration. |
| 2026-08-12 | Generated 50 records and verified 250 axes. |
