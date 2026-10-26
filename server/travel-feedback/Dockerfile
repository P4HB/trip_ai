FROM python:3.12-alpine

RUN addgroup -g 10001 -S app && adduser -u 10001 -S -G app app \
    && mkdir -p /app /data \
    && chown -R app:app /app /data

WORKDIR /app
COPY --chown=app:app feedback_api.py /app/feedback_api.py
COPY --chown=app:app settings.py timeutil.py http_client.py /app/
COPY --chown=app:app feedback_contract.py feedback_validation.py feedback_legacy.py /app/
COPY --chown=app:app itinerary_service.py itinerary_validation.py itinerary_policy.json llm_client.py route_provider.py place_time_data.py visit_insights.py /app/
COPY --chown=app:app restaurant_hours.py restaurant_catalog.py restaurant_candidates.py /app/
COPY --chown=app:app data/itinerary_catalog.json data/visit_insights.json /app/data/
COPY --chown=app:app data/restaurant_meal_catalog.sqlite3 data/restaurant_meal_catalog_manifest.json /app/data/
COPY --chown=app:app data/kakao_reviews.sqlite3 /app/data/kakao_reviews.sqlite3
COPY --chown=app:app data/kakao_reviews_manifest.json /app/data/kakao_reviews_manifest.json

USER app
EXPOSE 8200
CMD ["python", "/app/feedback_api.py"]
