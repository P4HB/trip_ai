"""SPEC-107 Kakao observed-week hours parser: conservative projection, exclusion on doubt."""
import json
import sys
import unittest
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from restaurant_hours import KST, hours_summary, meal_fits, parse_business_hours

CHECKED = "2026-09-21T18:48:02+09:00"
WEEK = ["화(9/22)", "수(9/23)", "목(9/24)", "금(9/25)", "토(9/26)", "일(9/27)", "월(9/28)"]  # 9/24~26 = 추석


def week(details_by_label=None, default=("10:00 ~ 20:00",)):
    details_by_label = details_by_label or {}
    return [{"label": label, "details": list(details_by_label.get(label, default))} for label in WEEK]


def parse(schedule, **notes):
    return parse_business_hours(status="available", schedule_json=json.dumps(schedule, ensure_ascii=False),
                                checked_at=CHECKED, **notes)


def at(day, clock):
    return datetime.fromisoformat(f"{day}T{clock}:00+09:00")


class ParserTests(unittest.TestCase):
    def test_regular_week_projects_to_weekdays(self):
        hours = parse(week())
        self.assertEqual(hours["status"], "parsed")
        self.assertEqual(hours["basis"], "observed_week_projection")
        self.assertEqual({entry["status"] for entry in hours["weekly"].values()}, {"open"})
        # 2026-10-22 is a Thursday; meal 12:00-13:00 inside 10:00-20:00.
        self.assertTrue(meal_fits(hours, at("2026-10-22", "12:00"), 60)[0])
        self.assertIn("10:00–20:00", hours_summary(hours, date(2026, 10, 22)))

    def test_exact_closing_boundary(self):
        hours = parse(week(default=("11:00 ~ 21:00",)))
        self.assertTrue(meal_fits(hours, at("2026-10-20", "20:00"), 60)[0])
        self.assertEqual(meal_fits(hours, at("2026-10-20", "20:01"), 60), (False, "closed_at_time"))
        self.assertFalse(meal_fits(hours, at("2026-10-20", "10:59"), 60)[0])
        self.assertTrue(meal_fits(hours, at("2026-10-20", "11:00"), 60)[0])

    def test_break_time_splits_service(self):
        hours = parse(week(default=("11:00 ~ 22:00", "15:00 ~ 17:00 브레이크타임")))
        self.assertTrue(meal_fits(hours, at("2026-10-20", "14:00"), 60)[0])   # ends exactly at break
        self.assertFalse(meal_fits(hours, at("2026-10-20", "14:30"), 60)[0])  # overlaps break
        self.assertFalse(meal_fits(hours, at("2026-10-20", "16:30"), 60)[0])  # starts in break
        self.assertTrue(meal_fits(hours, at("2026-10-20", "17:00"), 60)[0])

    def test_last_orders_per_service_segment(self):
        hours = parse(week(default=("11:00 ~ 22:00", "15:00 ~ 17:00 브레이크타임", "14:30 라스트오더", "21:00 라스트오더")))
        self.assertTrue(meal_fits(hours, at("2026-10-20", "13:30"), 60)[0])
        self.assertFalse(meal_fits(hours, at("2026-10-20", "14:31"), 15)[0])  # after lunch last order
        self.assertTrue(meal_fits(hours, at("2026-10-20", "21:00"), 60)[0])   # arrival == last order
        self.assertFalse(meal_fits(hours, at("2026-10-20", "21:01"), 30)[0])
        self.assertIn("라스트오더 14:30", hours_summary(hours, date(2026, 10, 20)))

    def test_weekly_closed_day(self):
        schedule = week({"화(9/22)": ("휴무일",)})
        hours = parse(schedule, hours_text="휴무일내일 10:00 오픈\n매주 화요일 휴무\n수정제안\n화(9/22) 휴무일\n휴무일\n매주 화요일 휴무")
        self.assertEqual(hours["weekly"]["2"], {"status": "closed"})
        self.assertEqual(meal_fits(hours, at("2026-10-20", "12:00"), 60), (False, "closed_at_time"))  # Tuesday
        self.assertEqual(hours_summary(hours, date(2026, 10, 20)), "화 휴무")

    def test_overnight_service_carries_into_next_day(self):
        hours = parse(week(default=("17:00 ~ 02:00",)))
        self.assertTrue(meal_fits(hours, at("2026-10-20", "23:00"), 60)[0])
        self.assertTrue(meal_fits(hours, at("2026-10-21", "01:00"), 60)[0])   # Tuesday's service after midnight
        self.assertFalse(meal_fits(hours, at("2026-10-21", "01:30"), 60)[0])
        self.assertIn("다음날 02:00", hours_summary(hours, date(2026, 10, 20)))

    def test_holiday_observation_with_different_hours_is_unknown(self):
        schedule = week({"목(9/24)": ("11:00 ~ 22:00",)}, default=("16:00 ~ 22:00",))
        hours = parse(schedule)
        self.assertEqual(hours["weekly"]["4"], {"status": "unknown", "reason": "holiday_observation"})
        self.assertEqual(meal_fits(hours, at("2026-10-22", "12:00"), 60), (False, "hours_unknown_for_weekday"))
        # Holiday Friday/Saturday matching the regular pattern are accepted.
        self.assertEqual(hours["weekly"]["5"]["status"], "open")

    def test_holiday_closure_needs_weekly_rule(self):
        closed = week({"금(9/25)": ("추석당일 휴무",), "목(9/24)": ("휴무일",)})
        hours = parse(closed)
        self.assertEqual(hours["weekly"]["5"]["reason"], "holiday_observation")
        self.assertEqual(hours["weekly"]["4"]["reason"], "holiday_observation")
        ruled = parse(closed, closed_days="매주 목요일 휴무")
        self.assertEqual(ruled["weekly"]["4"], {"status": "closed"})

    def test_dated_closure_is_date_specific(self):
        schedule = week({"월(9/28)": ("휴무일",)})
        hours = parse(schedule, hours_text="휴무일\n9/28(월) ~ 9/29(화) 휴무\n수정제안")
        self.assertEqual(hours["dateClosures"], [["2026-09-28", "2026-09-29"]])
        self.assertEqual(hours["weekly"]["1"]["reason"], "dated_closure")
        self.assertEqual(meal_fits(hours, at("2026-09-29", "12:00"), 60), (False, "closed_at_time"))

    def test_uninterpretable_text_excludes_restaurant(self):
        for note in ("재료소진시 조기마감", "격주 일요일 휴무", "매달 둘째∙넷째 화요일 휴무", "비정기 휴무", "라스트오더 20:30",
                     "홀마감 ~20:00까지 / 포장,배달은 ~01:00 까지", "하절기 월~토 8:30~19:30"):
            result = parse(week(), hours_text=f"영업 중\n{note}\n수정제안")
            self.assertEqual(result, {"status": "excluded", "reason": "note_unsupported"}, note)
        for detail in ("10:00 ~ 20:00 (주말 상이)", "점심만 영업"):
            self.assertEqual(parse(week({"화(9/22)": (detail,)}))["reason"], "detail_unrecognized")
        self.assertEqual(parse(week(default=("10:00 ~ 20:00", "21:00 ~ 22:00 브레이크타임")))["reason"], "break_outside_hours")
        self.assertEqual(parse(week(default=("10:00 ~ 20:00", "22:00 라스트오더")))["reason"], "last_order_outside_hours")
        mismatch = week()
        mismatch[0]["label"] = "수(9/22)"
        self.assertEqual(parse(mismatch)["reason"], "label_weekday_mismatch")
        outside = [{"label": "화(12/1)", "details": ["10:00 ~ 20:00"]}]
        self.assertEqual(parse(outside)["reason"], "observation_outside_holiday_table")
        self.assertEqual(parse(week(default=("휴무일",)))["reason"], "no_open_weekday")

    def test_harmless_notes_and_marker_rows_are_ignored(self):
        schedule = week() + [{"label": "", "details": []}]
        hours = parse(schedule, hours_text="영업 중20:00 까지\n요기요 제공\n연중무휴\n수정제안\n브레이크타임")
        self.assertEqual(hours["status"], "parsed")

    def test_non_available_statuses_are_excluded(self):
        for status in ("not_provided", "unrecognized", "uncollected"):
            self.assertEqual(parse_business_hours(status=status, schedule_json="[]", checked_at=CHECKED),
                             {"status": "excluded", "reason": f"hours_{status}"})
        self.assertEqual(parse_business_hours(status="available", schedule_json=json.dumps(week()), checked_at=None)["reason"],
                         "checked_at_missing")

    def test_unobserved_weekday_is_unknown_unless_weekly_rule(self):
        schedule = week()[:-1]  # Monday missing
        self.assertEqual(parse(schedule)["weekly"]["1"]["reason"], "not_observed")
        self.assertEqual(parse(schedule, closed_days="매주 월요일 휴무")["weekly"]["1"], {"status": "closed"})
        conflict = parse(week(), closed_days="매주 월요일 휴무")
        self.assertEqual(conflict["weekly"]["1"]["reason"], "closure_rule_conflict")


if __name__ == "__main__":
    unittest.main()
