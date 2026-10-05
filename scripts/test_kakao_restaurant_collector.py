"""Offline integrity regressions for SPEC-085; no requests to Kakao."""
import json
from pathlib import Path
import tempfile
import unittest
import threading
from unittest.mock import patch
from contextlib import redirect_stderr
from io import StringIO

from kakao_restaurant_review_crawler import (Place, classify, collect_query, business_hours_record,
                                           review_count, collect_detail, collect_business_hours, visible_text)
from collect_kakao_jeju_restaurant_reviews import Store, parse_args, collect_concurrent


class RestaurantCollectionTests(unittest.TestCase):
    def test_two_detail_workers_share_limit_and_prioritize_unvisited(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder), {'max_reviews': 5})
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
            places = [Place(str(i), f'식당{i}', f'https://place.map.kakao.com/{i}',
                            address='제주 제주시 한림읍 1', category='한식') for i in range(1, 5)]
            store.save_page('제주시 한림읍 음식점', places, 1, 4, 4)
            store.save_detail('1', {'place_id': '1'}, [])
            with store.db:
                store.db.execute("UPDATE places SET detail_status='failed' WHERE place_id='2'")
            self.assertEqual([r['place_id'] for r in store.pending_details()], ['3', '4', '2', '1'])
            args = parse_args(['--output-dir', folder, '--concurrent', '--skip-inventory', '--detail-workers', '2',
                               '--max-places', '3', '--place-delay', '0'])
            barrier = threading.Barrier(2)
            visited = []
            def detail(driver, place, maximum, wait, delay, on_business_hours):
                visited.append(place.place_id)
                if place.place_id in ('3', '4'):
                    barrier.wait(timeout=3)
                on_business_hours(business_hours_record(place, {'container_found': True, 'text': '영업시간을 알려주세요'}))
                return {'place_id': place.place_id, 'place_name': place.name}, []
            with patch('collect_kakao_jeju_restaurant_reviews.build_driver', side_effect=lambda _: type('Driver', (), {'quit': lambda self: None})()), \
                 patch('collect_kakao_jeju_restaurant_reviews.collect_detail', side_effect=detail):
                collect_concurrent(store, args)
            self.assertEqual(len(visited), 3)
            self.assertEqual(set(visited), {'2', '3', '4'})
            self.assertEqual([r['place_id'] for r in store.pending_details()], ['1'])
            store.db.close()

    def test_owner_withheld_reviews_are_not_zero_or_timeout(self):
        class Element:
            text = '매장주 요청으로 후기가 제공되지 않는 장소입니다.'
            def is_displayed(self):
                return True
        class Driver:
            title = '식당 | 카카오맵'
            def get(self, url):
                pass
            def execute_script(self, *args):
                pass
            def find_elements(self, by, selector):
                return [Element()] if selector in ('.section_defaultinfo', '.desc_noti') else []
        place = Place('1', '식당', 'https://place.map.kakao.com/1', visitor_review_count='30',
                      address='제주 제주시 한림읍 1', category='한식')
        saved = []
        with patch('kakao_restaurant_review_crawler.check_access'), \
             patch('kakao_restaurant_review_crawler.review_count', return_value=None), \
             patch('kakao_restaurant_review_crawler.collect_business_hours', return_value={'status': 'available'}), \
             patch('kakao_restaurant_review_crawler.parse_reviews', side_effect=AssertionError('Withheld reviews must not be parsed')):
            summary, reviews = collect_detail(Driver(), place, 5, 1, 0, on_business_hours=saved.append)
        self.assertEqual(summary['review_status'], 'not_provided')
        self.assertEqual(summary['visitor_review_count'], '')
        self.assertEqual(reviews, [])
        self.assertEqual(saved, [{'status': 'available'}])
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder), {'max_reviews': 5})
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
            store.save_page('제주시 한림읍 음식점', [place], 1, 1, 1)
            store.save_detail('1', summary, reviews)
            payload = json.loads(store.db.execute("SELECT payload FROM places WHERE place_id='1'").fetchone()[0])
            self.assertEqual(payload['visitor_review_count'], '')
            store.db.close()

    def test_hours_prompt_outside_operation_container_is_not_provided(self):
        class Element:
            text = '영업시간을 알려주세요'
            def is_displayed(self):
                return True
        class Driver:
            def find_elements(self, by, selector):
                return [Element()] if selector == '.section_defaultinfo .txt_detail2' else []
        with patch('kakao_restaurant_review_crawler.check_access'):
            result = collect_business_hours(Driver(), Place('1', '식당', 'https://place.map.kakao.com/1'), 1)
        self.assertEqual(result['status'], 'not_provided')
        self.assertEqual(result['hours_text'], '영업시간을 알려주세요')

    def test_hidden_template_count_is_not_public_text(self):
        class Element:
            text = '(30)'
            def is_displayed(self):
                return False
        class Driver:
            def find_elements(self, *args):
                return [Element()]
        self.assertEqual(visible_text(Driver(), '.numberofscore'), '')

    def test_missing_detail_page_has_stage_specific_error(self):
        from selenium.common.exceptions import TimeoutException
        class Driver:
            def get(self, url):
                pass
            def find_elements(self, *args):
                return []
        with patch('kakao_restaurant_review_crawler.check_access'):
            with self.assertRaisesRegex(TimeoutException, 'place_detail_load_timeout'):
                collect_detail(Driver(), Place('1', '식당', 'https://place.map.kakao.com/1'), 5, 0, 0)

    def test_concurrent_overlap_single_writer_reuse_and_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder), {'max_reviews': 5})
            self.addCleanup(store.db.close)
            places = [Place(str(i), f'식당{i}', f'https://place.map.kakao.com/{i}',
                            address='제주 제주시 한림읍 1', category='한식') for i in range(1, 4)]
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
                store.add_query('제주시 한림읍', '한식')
            store.save_page('제주시 한림읍 음식점', places[:2], 1, 2, 2)
            args = parse_args(['--output-dir', folder, '--concurrent', '--max-queries', '2',
                               '--max-places', '2', '--region-delay', '0', '--place-delay', '0'])
            started = {kind: threading.Event() for kind in ['search', 'detail']}
            owner = threading.get_ident()
            writers, made = [], []
            def build(_):
                driver = type('Driver', (), {'quit': lambda self: None})()
                made.append(driver)
                return driver
            def search(driver, query, wait, delay, checkpoint, pages):
                started['search'].set()
                self.assertTrue(started['detail'].wait(3), 'Detail must start before all searches finish')
                checkpoint([places[2]], 1, 1, 1)
                return {'status': 'done', 'pages': 1, 'reported_count': 1, 'seen_count': 1}
            def detail(driver, place, maximum, wait, delay, on_business_hours):
                started['detail'].set()
                self.assertTrue(started['search'].wait(3))
                on_business_hours(business_hours_record(place, {'container_found': True, 'text': '영업시간을 알려주세요'}))
                return {'place_id': place.place_id, 'place_name': place.name}, [{'place_id': place.place_id, 'content': '후기'}]
            original_hours = store.save_hours
            original_page = store.save_page
            def save_hours(*values):
                writers.append(threading.get_ident())
                return original_hours(*values)
            def save_page(*values):
                writers.append(threading.get_ident())
                return original_page(*values)
            with patch('collect_kakao_jeju_restaurant_reviews.build_driver', side_effect=build), \
                 patch('collect_kakao_jeju_restaurant_reviews.collect_query', side_effect=search), \
                 patch('collect_kakao_jeju_restaurant_reviews.collect_detail', side_effect=detail), \
                 patch.object(store, 'save_hours', side_effect=save_hours), \
                 patch.object(store, 'save_page', side_effect=save_page):
                collect_concurrent(store, args)
            self.assertEqual(len(made), 2)
            self.assertEqual(set(writers), {owner})
            self.assertEqual(store.counts()['queries'], {'done': 2})
            self.assertEqual(store.counts()['completed_detail_count'], 2)
            self.assertEqual(store.counts()['hours_checked_count'], 2)
            self.assertEqual(store.counts()['review_count'], 2)
            self.assertEqual([r['place_id'] for r in store.pending_details()], ['3'])
            store.db.close()

    def test_concurrent_failure_keeps_hours_and_existing_reviews(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder), {'max_reviews': 5})
            self.addCleanup(store.db.close)
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
            place = Place('1', '식당', 'https://place.map.kakao.com/1', address='제주 제주시 한림읍 1', category='한식')
            store.save_page('제주시 한림읍 음식점', [place], 1, 1, 1)
            store.save_detail('1', {'place_id': '1'}, [{'place_id': '1', 'content': '기존 후기'}])
            args = parse_args(['--output-dir', folder, '--concurrent', '--skip-inventory'])
            def detail(driver, place, maximum, wait, delay, on_business_hours):
                on_business_hours(business_hours_record(place, {'container_found': True, 'text': '영업시간을 알려주세요'}))
                raise RuntimeError('access_restricted: stop')
            driver = type('Driver', (), {'quit': lambda self: None})()
            with patch('collect_kakao_jeju_restaurant_reviews.build_driver', return_value=driver), \
                 patch('collect_kakao_jeju_restaurant_reviews.collect_detail', side_effect=detail):
                with self.assertRaisesRegex(RuntimeError, 'access_restricted'):
                    collect_concurrent(store, args)
            self.assertEqual(store.counts()['hours_checked_count'], 1)
            self.assertEqual(store.counts()['review_count'], 1)
            self.assertEqual(store.counts()['failed_detail_count'], 1)
            store.db.close()

    def test_concurrent_stop_preserves_page_and_pending_query(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder), {'max_reviews': 5})
            self.addCleanup(store.db.close)
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
            place = Place('1', '식당', 'https://place.map.kakao.com/1', address='제주 제주시 한림읍 1', category='한식')
            args = parse_args(['--output-dir', folder, '--concurrent', '--inventory-only'])
            def search(driver, query, wait, delay, checkpoint, pages):
                checkpoint([place], 1, 30, 1)
                (Path(folder) / 'STOP').write_text('pause', encoding='utf-8')
                raise KeyboardInterrupt('paused after durable page')
            driver = type('Driver', (), {'quit': lambda self: None})()
            with patch('collect_kakao_jeju_restaurant_reviews.build_driver', return_value=driver), \
                 patch('collect_kakao_jeju_restaurant_reviews.collect_query', side_effect=search):
                with self.assertRaises(KeyboardInterrupt):
                    collect_concurrent(store, args)
            self.assertEqual(store.counts()['inventory_count'], 1)
            self.assertEqual(store.counts()['queries'], {'pending': 1})
            self.assertEqual(store.db.execute('SELECT pages FROM queries').fetchone()[0], 1)
            store.db.close()

    def test_filter_uses_address_and_category_not_name(self):
        address = '제주특별자치도 제주시 한림읍 협재로 3'
        self.assertEqual(classify(address, '칼국수'), 'restaurant')
        self.assertEqual(classify('제주 서귀포시 성산읍 고성리 1', '한식'), 'restaurant')
        for category in ['카페', '제과,베이커리', '떡카페', '도넛', '아이스크림', '편의점', '단란주점']:
            self.assertEqual(classify(address, category), 'excluded_category')
        self.assertEqual(classify(address, '관광명소'), 'category_unknown')
        self.assertEqual(classify('서울특별시 강남구 제주로 10', '한식'), 'outside_jeju')
        self.assertEqual(classify('', '한식'), 'address_unknown')

    def test_resume_dedup_and_transaction_rollback(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = {'max_reviews': 5}
            store = Store(Path(folder), settings)
            with store.db:
                store.add_query('제주시 한림읍', '음식점')
                store.add_query('제주시 한림읍', '한식')
            place = Place('1','카페이름인식당','https://place.map.kakao.com/1', address='제주 제주시 한림읍 1',category='한식')
            for query in ['제주시 한림읍 음식점', '제주시 한림읍 한식']:
                store.save_page(query, [place], 1, 1, 1)
            self.assertEqual(store.counts()['inventory_count'], 1)
            self.assertEqual(store.db.execute('SELECT COUNT(*) FROM discoveries').fetchone()[0], 2)
            summary = {'place_id': '1'}
            reviews = [{'place_id': '1', 'content': '맛있어요'}]
            store.save_detail('1', summary, reviews)
            store.save_detail('1', summary, reviews)
            self.assertEqual(store.counts()['review_count'], 1)
            with self.assertRaises(Exception):
                store.save_detail('missing', {}, [{'place_id':'missing'}])
            self.assertEqual(store.counts()['review_count'], 1)
            with store.db:
                store.db.execute("UPDATE queries SET status='running' WHERE term='음식점'")
            store.db.close()
            resumed = Store(Path(folder), settings)
            self.assertEqual(resumed.counts()['queries']['pending'], 2)
            self.assertEqual(resumed.counts()['completed_detail_count'], 1)
            resumed.export('partial')
            manifest = json.loads((Path(folder)/'manifest.json').read_text(encoding='utf-8'))
            self.assertEqual(manifest['review_count'], 1)
            self.assertFalse(manifest['all_jeju_restaurants_guaranteed'])
            self.assertNotIn('reviewer', (Path(folder)/'reviews.csv').read_text(encoding='utf-8-sig'))
            resumed.db.close()
            with self.assertRaises(ValueError):
                Store(Path(folder), {'max_reviews': 10})

    def test_invalid_arguments_fail_before_browser(self):
        for argv in [['--max-regions','44'], ['--max-reviews','-2'], ['--wait','0'], ['--page-delay','-1'], ['--inventory-only','--skip-inventory'], ['--detail-workers','2'], ['--concurrent','--detail-workers','2']]:
            with self.assertRaises(SystemExit), redirect_stderr(StringIO()):
                parse_args(argv)

    def test_expansion_keeps_first_card_and_collects_page_one(self):
        class Driver:
            page = 0
            def get(self, url):
                pass
            def execute_script(self, script, target):
                self.page += 1
        driver = Driver()
        pages = [['1'], ['1','2'], ['3']]
        saved = []
        def snapshot(d, query):
            return ([Place(i, '식당', f'https://place.map.kakao.com/{i}') for i in pages[d.page]], 'next' if d.page < 2 else None)
        with patch('kakao_restaurant_review_crawler.wait_search', return_value='results'), \
             patch('kakao_restaurant_review_crawler.check_access'), \
             patch('kakao_restaurant_review_crawler.first_text', return_value='3'), \
             patch('kakao_restaurant_review_crawler.signature', side_effect=lambda d: tuple(pages[d.page])), \
             patch('kakao_restaurant_review_crawler.search_snapshot', side_effect=snapshot):
            result = collect_query(driver,'제주시 음식점',1,0,lambda cards,*_:saved.append([p.place_id for p in cards]))
        self.assertEqual(saved, pages)
        self.assertEqual(result, {'status':'done','reported_count':3,'seen_count':3,'pages':3})

    def test_timeout_is_not_reported_as_completed_query(self):
        from selenium.common.exceptions import TimeoutException
        class Driver:
            def get(self, url):
                pass
        with patch('kakao_restaurant_review_crawler.wait_search', side_effect=TimeoutException):
            with self.assertRaises(TimeoutException):
                collect_query(Driver(),'query',1,0,lambda *args:None)

    def test_current_explicit_empty_search_is_completed_as_zero(self):
        class Driver:
            def get(self,url):
                pass
        saved = []
        with patch('kakao_restaurant_review_crawler.signature',return_value=()), \
             patch('kakao_restaurant_review_crawler.first_text',return_value='제주시 삼양동 해산물 검색 결과가 없어요.'), \
             patch('kakao_restaurant_review_crawler.check_access'):
            result = collect_query(Driver(),'제주시 삼양동 해산물',1,0,lambda *args:saved.append(args))
        self.assertEqual(result,{'status':'done','reported_count':0,'seen_count':0,'pages':0})
        self.assertEqual(saved,[])

    def test_more_link_can_expand_page_one_without_changing_cards(self):
        class Driver:
            page = 0
            def get(self,url):
                pass
            def execute_script(self,script,target):
                self.page += 1
        driver = Driver()
        pages = [['1'],['1'],['2'],['3']]
        saved = []
        def snapshot(d,query):
            next_ids = ['info.search.place.more','page2','page3',None]
            return ([Place(i,'식당',f'https://place.map.kakao.com/{i}') for i in pages[d.page]],next_ids[d.page])
        with patch('kakao_restaurant_review_crawler.wait_search',return_value='results'), \
             patch('kakao_restaurant_review_crawler.check_access'), \
             patch('kakao_restaurant_review_crawler.first_text',side_effect=lambda d,s:'1' if 'ACTIVE' in s else '3'), \
             patch('kakao_restaurant_review_crawler.visible',return_value=[]), \
             patch('kakao_restaurant_review_crawler.signature',side_effect=lambda d:tuple(pages[d.page])), \
             patch('kakao_restaurant_review_crawler.search_snapshot',side_effect=snapshot):
            result = collect_query(driver,'query',1,0,lambda cards,*_:saved.append([p.place_id for p in cards]))
        self.assertEqual(saved,[['1'],['2'],['3']])
        self.assertEqual(result,{'status':'done','reported_count':3,'seen_count':3,'pages':3})

    def test_hours_preserve_displayed_dates_breaks_and_closures(self):
        place = Place('1','식당','https://place.map.kakao.com/1')
        snapshot = {'container_found':True, 'text':'월(9/21) 09:00 ~ 20:00\n15:00 ~ 17:00 브레이크타임\n19:30 라스트오더\n화(9/22) 정기휴무',
                    'rows':[{'label':'월(9/21)','details':['09:00 ~ 20:00','15:00 ~ 17:00 브레이크타임','19:30 라스트오더']},
                            {'label':'화(9/22)','details':['정기휴무']}], 'notes':['명절 휴무']}
        result = business_hours_record(place,snapshot)
        self.assertEqual(result['status'],'available')
        self.assertEqual(result['opening_hours'],'월(9/21) 09:00 ~ 20:00')
        self.assertEqual(result['break_time'],'월(9/21) 15:00 ~ 17:00 브레이크타임')
        self.assertEqual(result['last_order'],'월(9/21) 19:30 라스트오더')
        self.assertIn('화(9/22) 정기휴무',result['closed_days'])
        self.assertIn('명절 휴무',result['closed_days'])
        self.assertEqual(json.loads(result['schedule_json']),snapshot['rows'])
        self.assertTrue(result['checked_at'].endswith('+09:00'))
        self.assertEqual(result['source_url'],place.url+'?openhour=1')

    def test_missing_hours_are_distinct_from_broken_page(self):
        place = Place('1','식당','https://place.map.kakao.com/1')
        missing = business_hours_record(place,{'container_found':True,'text':'영업시간을 알려주세요','rows':[]})
        broken = business_hours_record(place,{'container_found':False,'text':'','rows':[]})
        self.assertEqual(missing['status'],'not_provided')
        self.assertEqual(broken['status'],'unrecognized')
        for field in ['opening_hours','closed_days','break_time','last_order']:
            self.assertEqual(missing[field],'')
            self.assertEqual(broken[field],'')

    def test_review_invitation_alone_does_not_imply_zero_reviews(self):
        class Driver:
            def find_elements(self,*args):
                return []
        def text(d,selector):
            return '방문 후기를 남겨주세요!' if selector == '.section_grade' else ''
        with patch('kakao_restaurant_review_crawler.first_text',side_effect=text):
            self.assertIsNone(review_count(Driver()))
            self.assertEqual(review_count(Driver(),expected_empty=True),0)

    def test_old_completed_details_are_backfilled_without_losing_reviews(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder),{'max_reviews':5})
            with store.db:
                store.add_query('제주시 한림읍','음식점')
            place = Place('1','식당','https://place.map.kakao.com/1',address='제주 제주시 한림읍 1',category='한식')
            store.save_page('제주시 한림읍 음식점',[place],1,1,1)
            store.save_detail('1',{'place_id':'1'},[{'place_id':'1','content':'후기'}])
            self.assertEqual(len(store.pending_details()),1)
            hours = business_hours_record(place,{'container_found':True,'text':'영업시간을 알려주세요','rows':[]})
            store.save_hours(hours)
            self.assertEqual(len(store.pending_details()),0)
            self.assertEqual(store.counts()['review_count'],1)
            self.assertEqual(store.counts()['hours_checked_count'],1)
            store.export('finished_search_scope')
            self.assertIn('not_provided',(Path(folder)/'business_hours.csv').read_text(encoding='utf-8-sig'))
            store.db.close()


if __name__ == '__main__':
    unittest.main()
