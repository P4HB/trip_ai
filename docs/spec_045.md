# SPEC-045: other_place Companion batch 03 boundary review

- Status: Implemented
- Created: 2026-08-12
- Updated: 2026-08-12
- Related documents: [README](README.md), [SPEC-039](spec_039.md), [SPEC-022](spec_022.md)
- Related data: `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_inputs/10_other_place.jsonl`, `data/labeling/jeju/2026-08-09/place-fit-relabel-v2/calibration_outputs/batches/calibrated_batch_03.jsonl`

## Background

The batch-03 0.5, 0.75, and 1 boundaries needed a source-grounded review. General lodging facilities, scenery, and viewing are not direct evidence for elevated solo/couple/friends values. Kids and parents values require direct audience, safety, or experience evidence.

## Goals and non-goals

- Review all 20 input places and emit a separate five-axis Companion sidecar.
- Preserve the input and existing draft; do not force policy distribution targets as quotas.
- Do not change canonical labels or Month axes.

## Requirements

- `REQ-4501`: Preserve every input record's identifiers, title, source order, calibration family, and five complete AxisLabels.
- `REQ-4502`: Recheck all draft 0.5/0.75/1 boundaries against source_excerpt; unsupported general social scores at 0.75 or above become 0.5.
- `REQ-4503`: Recheck kids and parents with direct audience, safety, or experience evidence; 0 remains a relative minimum, not a prohibition.
- `REQ-4504`: Every axis is numeric, `ai_draft`, has `null_reason=null`, input evidence IDs, source-grounded rationale, and `CALIBRATED-BOUNDARY-REVIEW-V2`.

## Input and output

- Input: `calibration_inputs/10_other_place.jsonl`, policy, guide, and current draft.
- Output: `calibration_outputs/reviewed/reviewed_calibrated_batch_03.jsonl`.

## Acceptance criteria and tests

- `AC-4501`: All 20 output identity fields and input order match. Passed.
- `AC-4502`: All 100 axes have five-axis completeness, allowed numeric values, full AxisLabel keys, required status and provenance. Passed.
- `AC-4503`: JSONL parsing and old-versus-new distribution/change counting pass. Passed.

## Implementation results

- Created only `calibration_outputs/reviewed/reviewed_calibrated_batch_03.jsonl`; input and current draft were preserved.
- 31 axes changed. Unsupported elevated solo/friends lodging scores became 0.5.
- Direct evidence retained: kids 1 for child/infant swimming lessons and safety-depth pool; kids 0.75 for family lodging/room evidence; friends 0.75 for maximum-six occupancy; parents 0.75 for a barrier-free, single-storey lodging claim.
- Final distribution: solo `0.5=20`; couple `0.5=20`; friends `0.5=19, 0.75=1`; kids `0.5=17, 0.75=2, 1=1`; parents `0.5=19, 0.75=1`.

## Known limitations

This remains an AI draft. Unlisted accessibility, age limits, operational safety, and weather conditions are not inferred.

## Change history

| Date | Change |
|---|---|
| 2026-08-12 | Completed source-grounded boundary review and validation. |
