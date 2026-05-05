FROM python:3.12-slim

WORKDIR /app

# СБ: тестовый образ не должен по умолчанию быть root (единый стандарт Dockerfile в репо).
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --system --no-create-home app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=app:app tests /app/tests
USER app

CMD ["pytest", "-q"]
