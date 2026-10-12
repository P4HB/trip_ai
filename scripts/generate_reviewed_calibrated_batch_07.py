"""Generate and validate the additive activity-family batch-07 review sidecar."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/labeling/jeju/2026-08-09/place-fit-relabel-v2"
INPUT = BASE / "calibration_inputs/02_activity_family.jsonl"
OUTPUT = BASE / "calibration_outputs/reviewed/reviewed_calibrated_batch_07.jsonl"
AXES = ("solo", "couple", "friends", "kids", "parents")
ALLOWED = {0, 0.25, 0.5, 0.75, 1}

FINAL = {
 "2931335":[.5,.5,.5,.5,.5],"2932050":[.5,.5,.5,.5,.5],"2946628":[.75,.5,.5,.5,.5],"2948165":[.5,.5,.5,.75,.75],"3027466":[.75,.5,.5,.5,.5],"3031571":[.5,.5,.5,1,.75],"3038479":[.75,.5,.5,.5,.5],"3056135":[.5,.5,.5,.5,.5],"3056151":[.5,.5,.5,.25,.25],"3056279":[.5,.5,.5,.5,.5],"3056448":[.5,.5,.5,1,.75],"3057363":[.75,1,1,.75,.5],"3067072":[.75,.5,.5,.5,.5],"3071744":[.75,.5,.5,.75,.5],"3071796":[.75,.5,.5,.5,.5],"3071841":[.75,.5,.5,.75,.5],"3071875":[.75,.5,.5,.5,.5],"3082301":[.5,.5,.5,.5,.5],"3097805":[.5,.5,.5,.25,.25],"3097814":[.75,.5,.5,.75,.5],"3110802":[.75,.5,.5,.5,.5],"3305786":[.5,.5,.5,.5,.5],"3306117":[.5,.5,.5,.5,.5],"3307036":[.5,.5,.5,.5,.5],"3331534":[.75,.5,1,.75,.75],"3396532":[.75,.5,.75,.25,.5],"3410530":[.5,.5,.5,1,.75],"3464225":[.75,.5,.75,1,.75],"3505052":[.75,.5,.5,.5,.5],"4009611":[.5,.5,.5,.5,.75],"4013000":[.5,.5,.5,.5,.5],"4026831":[.5,.5,.5,.5,.5],"4026857":[.5,.5,.5,.5,.5],"4058390":[.5,.5,.5,1,.75],
}
FIRST = {key:list(value) for key,value in FINAL.items()}
FIRST["3027466"][1] = .75
FIRST["3067072"][2] = .75
FIRST["3097814"][1] = .75
FACTS = {
 "2946628":"1시간마다 숲 해설이 있고 족욕·공예 체험 프로그램이 안내된다","2948165":"수영장과 키즈 플레이 룸을 포함한 부대시설이 안내된다","3027466":"감귤 체험과 직접 수확, 포토존, 카페 이용이 소개된다","3031571":"초등학생 단독 탑승과 유아의 보호자 동반 2인승 카트가 안내된다","3038479":"흙길·오르막·내리막을 걸으며 식물을 보는 숲길이다","3056151":"사유지라 목장 출입은 불가능하고 주차 공간이 없다고 소개된다","3056448":"약 1시간 테우 가두리 낚시가 아이부터 어른까지 가능하다고 명시된다","3057363":"감귤 따기 체험을 가족·친구·연인 누구와도 즐길 수 있다고 명시한다","3067072":"안전 장구와 간단한 교육 뒤 초원·숲길 승마를 체험한다","3071744":"얕은 물에서는 아이들이 물놀이를 할 수 있고 벤치·팔각정이 설치돼 있다","3071796":"여러 감귤을 직접 따보는 체험이 가능하다","3071841":"어린이가 말과 교감하는 체험 승마가 인기이며 초보자 교육도 소개된다","3071875":"감귤 따기와 시식이 가능한 체험을 하루 13회 운영한다고 소개된다","3097805":"간조 때 생기는 바닷길이며 물때 확인과 바다로 걸어 들어가는 체험이 안내된다","3097814":"수심이 얕고 파도가 높지 않아 아이들이 놀기 좋다고 소개된다","3110802":"자연 재료 염색 클래스로 여러 염색 기법을 배울 수 있다","3331534":"가족단위나 친구들끼리 과일청·감귤 체험을 즐기기 좋다고 명시한다","3396532":"최대 4인 소규모 또는 프라이빗 싱잉볼 세션이며 8세 이상 가능하다","3410530":"어린이에게 친숙한 캐릭터와 다양한 어트랙션·프로그램을 운영한다","3464225":"만 4세 이상 남녀노소가 안전 장비·전문 강사와 실내서핑을 즐길 수 있다고 소개된다","3505052":"9월부터 5월까지 제철 감귤을 직접 따고 맛보는 체험을 진행한다","4009611":"전 세대가 편안하게 즐길 수 있는 의류를 제안한다고 소개된다","4058390":"가족 단위 3~4인 여행객을 고려한 다인용 객실과 일부 2층 침대를 마련했다",
}
def fact(row): return FACTS.get(row["contentid"], row["source_excerpt"].split("\n")[0].split(".")[0])
def label(row,value):
    unknown = row["unknowns"][0] if row["unknowns"] else "동행별 추가 조건"
    direct = value in {.75,1} or (value == .25 and row["contentid"] in {"3056151","3097805","3396532"})
    conclusion = "소개에 없는 사회적 적합성은 추정하지 않아 상대적 보통값으로 둔다" if value == .5 else ("명시된 조건과 미확인 안전·접근성 때문에 상대적 낮은 값으로 둔다" if value == .25 else "명시된 활동·대상·안전 또는 가족 근거에 따른 상대적 값이다")
    return {"state":"numeric","value":value,"confidence":.9 if value==1 else (.78 if direct else (.68 if value==.75 else .6)),"status":"ai_draft","inference_level":"direct_evidence" if direct else "limited_direct_evidence","rationale":f"소개에는 {fact(row)}. {unknown}은 unknown이며, {conclusion}.","evidence_ids":row["evidence_ids"],"rule_ids":["CALIBRATED-DIRECT-COMPANION-V1","CALIBRATED-BOUNDARY-REVIEW-V2"],"null_reason":None}
def build(rows):
    return [{key:row[key] for key in ("contentid","title","source_order","calibration_family")} | {"companion_fit":{axis:label(row,value) for axis,value in zip(AXES,FINAL[row["contentid"]])}} for row in rows]
def validate(rows,out):
    assert len(rows)==len(out)==34
    for row,result in zip(rows,out):
        assert [result[k] for k in ("contentid","title","source_order","calibration_family")]==[row[k] for k in ("contentid","title","source_order","calibration_family")]
        assert tuple(result["companion_fit"])==AXES
        for value in result["companion_fit"].values():
            assert set(value)=={"state","value","confidence","status","inference_level","rationale","evidence_ids","rule_ids","null_reason"}
            assert value["state"]=="numeric" and value["value"] in ALLOWED and value["status"]=="ai_draft" and value["null_reason"] is None
            assert value["evidence_ids"]==row["evidence_ids"] and "CALIBRATED-BOUNDARY-REVIEW-V2" in value["rule_ids"] and "unknown" in value["rationale"]
def report(out):
    return {"axis_distribution":{axis:dict(sorted(Counter(row["companion_fit"][axis]["value"] for row in out).items())) for axis in AXES},"identical_five_axis_places":sum(len({label["value"] for label in row["companion_fit"].values()})==1 for row in out),"first_to_review_changed_axes":sum(FIRST[key][i]!=FINAL[key][i] for key in FINAL for i in range(5))}
def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--check",action="store_true"); args=parser.parse_args()
    rows=[json.loads(line) for line in INPUT.read_text(encoding="utf-8").splitlines() if line]; out=build(rows); validate(rows,out)
    if not args.check: OUTPUT.write_text("\n".join(json.dumps(row,ensure_ascii=False,separators=(",",":")) for row in out)+"\n",encoding="utf-8")
    print(json.dumps(report(out),ensure_ascii=False,sort_keys=True))
    if OUTPUT.exists(): print("sha256",hashlib.sha256(OUTPUT.read_bytes()).hexdigest())
if __name__=="__main__": main()
