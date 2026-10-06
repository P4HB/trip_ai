-- SPEC-106: compact query projection plus exact-ID WGS84 coordinate observations.
PRAGMA foreign_keys = ON;
PRAGMA user_version = 3;
CREATE TABLE dataset_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL) STRICT;
CREATE TABLE places (
  canonical_id TEXT PRIMARY KEY NOT NULL,
  place_id TEXT NOT NULL UNIQUE CHECK(length(place_id) > 0 AND place_id NOT GLOB '*[^0-9]*'),
  source_order INTEGER NOT NULL UNIQUE CHECK(source_order >= 0),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  address TEXT NOT NULL,
  longitude REAL CHECK(longitude BETWEEN -180 AND 180),
  latitude REAL CHECK(latitude BETWEEN -90 AND 90),
  category TEXT NOT NULL,
  source_url TEXT NOT NULL,
  first_collected_at TEXT NOT NULL,
  detail_checked_at TEXT,
  detail_status TEXT NOT NULL CHECK(detail_status IN ('pending','failed','done')),
  review_status TEXT NOT NULL CHECK(review_status IN ('uncollected','not_requested','not_provided','empty','complete','limited')),
  average_rating_5 REAL CHECK(average_rating_5 BETWEEN 0 AND 5),
  visitor_review_count INTEGER CHECK(visitor_review_count >= 0),
  visitor_review_count_status TEXT NOT NULL CHECK(visitor_review_count_status IN ('observed','unknown','not_provided','unverified_legacy')),
  visitor_review_count_checked_at TEXT,
  blog_review_count INTEGER CHECK(blog_review_count >= 0),
  blog_review_count_checked_at TEXT,
  collected_review_count INTEGER NOT NULL CHECK(collected_review_count >= 0),
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64),
  coordinate_status TEXT NOT NULL CHECK(coordinate_status IN ('available','missing','unavailable','identity_mismatch','outside_jeju','invalid_coordinates','error')),
  coordinate_source_url TEXT NOT NULL,
  coordinate_checked_at TEXT NOT NULL,
  coordinate_record_sha256 TEXT NOT NULL UNIQUE CHECK(length(coordinate_record_sha256) = 64),
  CHECK(coordinate_source_url = 'https://place.map.kakao.com/places/panel3/' || place_id),
  CHECK((coordinate_status = 'available' AND longitude IS NOT NULL AND latitude IS NOT NULL
         AND longitude BETWEEN 125 AND 127.5 AND latitude BETWEEN 32.8 AND 34.2)
     OR (coordinate_status != 'available' AND longitude IS NULL AND latitude IS NULL)),
  CHECK(canonical_id = 'kakao:' || place_id),
  CHECK(source_url = 'https://place.map.kakao.com/' || place_id),
  CHECK((visitor_review_count_status = 'observed' AND visitor_review_count IS NOT NULL AND visitor_review_count_checked_at IS NOT NULL)
     OR (visitor_review_count_status != 'observed' AND visitor_review_count IS NULL)),
  CHECK(review_status != 'not_provided' OR (visitor_review_count_status = 'not_provided' AND average_rating_5 IS NULL AND collected_review_count = 0)),
  CHECK(review_status != 'empty' OR (visitor_review_count = 0 AND collected_review_count = 0)),
  CHECK(detail_status != 'done' OR detail_checked_at IS NOT NULL)
) STRICT;
CREATE INDEX places_coordinates ON places(longitude, latitude);
CREATE INDEX places_coordinate_status ON places(coordinate_status);
CREATE INDEX places_address ON places(address);
CREATE INDEX places_category ON places(category);
CREATE INDEX places_review_count ON places(visitor_review_count);
CREATE TABLE reviews (
  review_id TEXT PRIMARY KEY NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES places(canonical_id),
  source_order INTEGER NOT NULL UNIQUE CHECK(source_order >= 0),
  source_position INTEGER NOT NULL CHECK(source_position >= 0),
  rating REAL CHECK(rating BETWEEN 0 AND 5),
  review_date_raw TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL,
  likes INTEGER CHECK(likes >= 0),
  source_url TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64),
  UNIQUE(canonical_id, source_position)
) STRICT;
CREATE TABLE business_hours (
  canonical_id TEXT PRIMARY KEY NOT NULL REFERENCES places(canonical_id),
  source_order INTEGER NOT NULL UNIQUE CHECK(source_order >= 0),
  status TEXT NOT NULL CHECK(status IN ('available','not_provided','unrecognized','uncollected')),
  hours_text TEXT NOT NULL,
  opening_hours TEXT NOT NULL,
  closed_days TEXT NOT NULL,
  break_time TEXT NOT NULL,
  last_order TEXT NOT NULL,
  schedule_json TEXT NOT NULL CHECK(json_valid(schedule_json) AND json_type(schedule_json) = 'array'),
  source_url TEXT NOT NULL,
  checked_at TEXT,
  error TEXT NOT NULL,
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64),
  CHECK((status = 'uncollected' AND checked_at IS NULL) OR (status != 'uncollected' AND checked_at IS NOT NULL))
) STRICT;
CREATE INDEX hours_status ON business_hours(status);
CREATE TABLE collection_issues (
  issue_id TEXT PRIMARY KEY NOT NULL,
  canonical_id TEXT REFERENCES places(canonical_id),
  source_order INTEGER NOT NULL UNIQUE CHECK(source_order >= 0),
  kind TEXT NOT NULL CHECK(kind IN ('query_truncated','query_incomplete','detail_incomplete','hours_unrecognized','hours_uncollected','unverified_legacy_count')),
  message TEXT NOT NULL,
  source_url TEXT NOT NULL,
  checked_at TEXT,
  record_sha256 TEXT NOT NULL UNIQUE CHECK(length(record_sha256) = 64)
) STRICT;
CREATE INDEX issues_place ON collection_issues(canonical_id);
