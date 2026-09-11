"""Contract and semantic regression checks for SPEC-075."""
import json
from pathlib import Path
import sqlite3
import tempfile

import classify_place_types as module


def main():
    watched = [module.RAW, module.BUNDLE, module.ROOT / 'map-ui/ccu-mmr.js',
               module.ROOT / 'data/labeling/jeju/2026-08-09/full/place-profile-v1-all-1434/place_profiles.sqlite3']
    before = {str(p): module.digest(p) for p in watched}
    config = json.loads(module.CONFIG.read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory(prefix='place-types-test-') as temp:
        target = Path(temp)
        first = module.build(target)
        second = module.build(target)
        assert first == second, 'Regeneration differs (including SQLite bytes)'
        rows = [json.loads(line) for line in (target / 'place_types.jsonl').read_text(encoding='utf-8').splitlines()]
        places = module.read_bundle()
        assert len(rows) == len({r['place_id'] for r in rows}) == 2153
        assert {r['place_id'] for r in rows} == {p['id'] for p in places}
        assert sum(r['recommendation_ready'] for r in rows) == 1663
        assert '2704351' not in {r['place_id'] for r in rows}, 'Excluded map coordinate restored'
        by_id = {r['place_id']: r for r in rows}
        expected = {
            '125445': 'garden', '126434': 'mountain_oreum',
            '126446': 'island', '127336': 'island',
            '126472': 'forest', '598696': 'mountain_oreum',
            '591798': 'coast_beach', '2472824': 'museum_exhibition',
            '2811110': 'museum_exhibition', '3112168': 'cafe',
            '2738653': 'craft_experience', '2759624': 'farm_experience',
            '2621914': 'transport_info', '2714222': 'garden',
        }
        for pid, kind in expected.items():
            assert by_id[pid]['primary_type'] == kind, (pid, kind)
        assert by_id['2714222']['classification_status'] == 'user_confirmed'
        for row in rows:
            assert row['primary_type'] in config['types']
            assert row['rule_id'] and row['evidence']
            assert row['human_reviewed'] == (row['classification_status'] == 'user_confirmed')
            if row['primary_type'] == 'unknown':
                assert row['classification_status'] == 'needs_review'
        queue = [json.loads(line) for line in (target / 'review_queue.jsonl').read_text(encoding='utf-8').splitlines()]
        assert {r['place_id'] for r in queue} == {r['place_id'] for r in rows if r['review_reasons']}
        confirmed = {
            '126455': 'park', '126466': 'marine_activity', '127492': 'tourism_area',
            '130856': 'park', '131103': 'island', '131106': 'coast_beach',
            '594065': 'garden', '601489': 'tourism_area', '665594': 'theme_park',
            '1162240': 'tourism_area', '1812994': 'animal_aquarium',
            '1939121': 'culture_learning', '1957971': 'tourism_area',
            '2638440': 'museum_exhibition', '2660122': 'land_activity',
            '2661514': 'forest', '2858445': 'scenic_walk',
            '2863882': 'scenic_walk', '4039339': 'scenic_walk',
            '2674014': 'theme_park', '2704456': 'garden', '2714222': 'garden',
            '2714659': 'garden', '2932006': 'cave_geology', '3063420': 'shopping',
            '3303346': 'culture_learning', '3584915': 'culture_learning',
        }
        assert {r['place_id'] for r in rows if r['human_reviewed']} == set(confirmed)
        assert len(queue) == 0
        for pid, kind in confirmed.items():
            row = by_id[pid]
            assert row['primary_type'] == kind
            assert row['classification_status'] == 'user_confirmed'
            assert row['user_confirmation']['date'] == '2026-09-11'
            assert row['user_confirmation']['instruction'] and not row['review_reasons']
        baseline = json.loads((module.OUTPUT / 'pre_user_confirmation_baseline.json').read_text(encoding='utf-8'))
        for pid, old in baseline.items():
            if pid not in confirmed:
                assert all(by_id[pid][key] == value for key, value in old.items()), pid
        conn = sqlite3.connect(f"file:{(target / 'place_types.sqlite3').as_posix()}?mode=ro", uri=True)
        try:
            assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            stored = {pid: json.loads(record) for pid, record in conn.execute('SELECT place_id, record_json FROM place_types')}
            assert stored == by_id
            for pid, kind, status, ready in conn.execute('SELECT place_id, primary_type, classification_status, recommendation_ready FROM place_types'):
                assert (kind, status, bool(ready)) == (by_id[pid]['primary_type'], by_id[pid]['classification_status'], by_id[pid]['recommendation_ready'])
        finally:
            conn.close()
        # Adversarial names must not hijack authoritative establishment categories.
        synthetic = {'id': 'test', 'title': '산방산 오름 정원 바다 박물관', 'v5': None, 'fit': None}
        for code, expected_kind in [('FD050100', 'cafe'), ('FD010100', 'restaurant'), ('AC010100', 'accommodation')]:
            assert module.classify({'lclsSystm3': code}, synthetic, config)['primary_type'] == expected_kind
        unknown = module.classify({'lclsSystm3': 'NEW_CODE'}, synthetic, config)
        assert (unknown['primary_type'], unknown['classification_status']) == ('unknown', 'needs_review')
        # Published files must be the current deterministic generation.
        for name, value in first['outputs'].items():
            assert module.digest(module.OUTPUT / name) == value, f'Stale output: {name}'
    assert before == {str(p): module.digest(p) for p in watched}, 'Source changed'
    print('PASS: 2153 IDs, 1663 ready, semantic fixtures, review queue, SQLite parity/integrity, deterministic outputs, source immutability')


if __name__ == '__main__':
    main()
