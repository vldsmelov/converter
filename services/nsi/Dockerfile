FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# СБ: не запускать приложение от root внутри контейнера (снижение последствий RCE / escape).
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --system --no-create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
USER app
EXPOSE 8000