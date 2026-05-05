FROM python:3.12-slim

WORKDIR /app

# СБ: одноразовый контейнер seed тоже без root.
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --system --no-create-home app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=app:app seed.py /app/seed.py
USER app

CMD ["python", "/app/seed.py"]
