"""Shared time constants for the travel-feedback server (SPEC-113 REQ-008)."""
from datetime import timedelta, timezone

# Itinerary dates, opening hours and route departures are all Korea Standard Time (no DST).
KST = timezone(timedelta(hours=9))
