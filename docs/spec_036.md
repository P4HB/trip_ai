# SPEC-036: Culture Exhibition Companion calibration sample

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [data contracts](data_contracts.md), [SPEC-022](spec_022.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/`
- Predecessor: [SPEC-022](spec_022.md)

## Background

This independent calibration pass directly labels the Companion axes for every `culture_exhibition` record in the supplied calibration input. It does not alter canonical labels or the input.

## Goals and non-goals

- Produce five relative Companion scores from the source excerpt, unknowns, and evidence IDs for all selected records.
- Do not equalize the distribution, infer social suitability absent from the text, score Month axes, or promote this output to canonical data.

## Requirements

- `REQ-3601`: Select only all records whose `calibration_family` is `culture_exhibition`, in input order.
- `REQ-3602`: Emit the five numeric values `0`, `0.25`, `0.5`, `0.75`, or `1`, with the complete AxisLabel structure.
- `REQ-3603`: Every rationale cites an actual source fact or an unknown, carries the input evidence IDs, and includes `CALIBRATED-DIRECT-COMPANION-V1`.
- `REQ-3604`: Every axis uses `status=ai_draft` and `null_reason=null`; existing files remain unchanged.

## Input and output

- Input: `calibration_inputs/calibration_sample.jsonl` records with `calibration_family=culture_exhibition`.
- Output: `calibration_outputs/calibrate_culture.jsonl` with `contentid`, `title`, `source_order`, `calibration_family`, and five `companion_fit` AxisLabels.

## Decision rules

Scores express relative fit for the representative experience, not admission eligibility. A direct target/recommendation or two strong independent facts merits 1; an explicit suitable activity/facility/environment merits 0.75; insufficient or non-party-specific information merits 0.5. Scenery, observation, and shopping alone do not raise couple or friends. Unknown mobility or age conditions keep kids and parents conservative.

## Impact and fallback

Only this SPEC, the documentation index, and the new output file are changed. If source information is insufficient, the rationale says so and uses a conservative 0.5-centered judgment. No personal information is processed.

## Acceptance criteria and results

- `AC-3601`: 30 output records exactly match the selected input set, order, and identifiers. Passed.
- `AC-3602`: 150 axes have complete AxisLabels, allowed numeric values, `ai_draft`, null reason, evidence IDs, and the required rule ID. Passed.
- `AC-3603`: Every rationale contains a source fact or unknown, and inputs/canonical labels are unchanged. Passed.

Validation used JSONL parsing plus full selected-order, schema, value, provenance, and rationale checks. Distribution: solo `{0.5: 3, 0.75: 27}`, couple `{0.5: 27, 0.75: 3}`, friends `{0.5: 27, 0.75: 2, 1: 1}`, kids `{0: 2, 0.5: 16, 0.75: 5, 1: 7}`, parents `{0.25: 1, 0.5: 21, 0.75: 6, 1: 2}`.

## Known limitation

This is an AI draft; access and age conditions not present in the introduction are not asserted.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Created, generated 30 records and verified 150 axes. |
