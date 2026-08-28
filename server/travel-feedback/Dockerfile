FROM python:3.12-alpine

RUN addgroup -g 10001 -S app && adduser -u 10001 -S -G app app \
    && mkdir -p /app /data \
    && chown -R app:app /app /data

WORKDIR /app
COPY --chown=app:app feedback_api.py /app/feedback_api.py

USER app
EXPOSE 8200
CMD ["python", "/app/feedback_api.py"]
