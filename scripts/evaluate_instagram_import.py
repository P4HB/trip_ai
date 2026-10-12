"""Offline literal-name evaluation; metadata matches are deliberately separate."""
import argparse
import json
import re
from pathlib import Path


def name_key(value):
    return re.sub(r"[\W_]+", "", value).casefold()


def evaluate(result, truth):
    expected = {name_key(n): n for n in truth["names"]}
    observed = {name_key(m["observed_name"]): m["observed_name"] for m in result["mentions"]}
    correct = set(expected) & set(observed)
    coverage = result["coverage"]
    return {
        "expected_unique_names": len(expected), "observed_unique_names": len(observed),
        "correct_names": len(correct), "name_precision": round(len(correct) / len(observed), 4) if observed else None,
        "name_recall": round(len(correct) / len(expected), 4),
        "missed_names": [expected[k] for k in expected if k not in correct],
        "unmatched_observed_names": [observed[k] for k in observed if k not in correct],
        "downloaded_images": coverage["downloaded_image_count"],
        "processed_images": coverage.get("extraction_processed_image_count", coverage.get("ocr_processed_image_count")),
        "model": result["provenance"].get("model"), "counts": result["counts"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", type=Path, help="result.json or job.json")
    parser.add_argument("--baseline", type=Path)
    args = parser.parse_args()
    fixture = Path(__file__).parent / "fixtures/instagram_places.v1.json"
    truth = json.loads(fixture.read_text(encoding="utf-8"))["posts"]
    def read(path):
        value = json.loads(path.read_text(encoding="utf-8"))
        return value.get("result", value)
    result = read(args.result)
    code = result["source"]["shortcode"]
    output = {"shortcode": code, "evaluation": evaluate(result, truth[code])}
    if args.baseline:
        old = read(args.baseline)
        if old["source"]["shortcode"] != code: raise ValueError("baseline_shortcode_mismatch")
        output["baseline"] = evaluate(old, truth[code])
        old_hashes = [a.get("sha256") for a in old["assets"] if a["kind"] == "image"]
        new_hashes = [a.get("sha256") for a in result["assets"] if a["kind"] == "image"]
        output["identical_input_images"] = old_hashes == new_hashes
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__": main()
