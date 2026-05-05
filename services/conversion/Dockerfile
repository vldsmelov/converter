FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# СБ: uvicorn под непривилегированным UID (порт 8000 > 1024 — bind без root).
RUN groupadd --gid 65532 app && useradd --uid 65532 --gid app --system --no-create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
USER app
EXPOSE 8000
# 0.0.0.0 внутри контейнера — нормально: снаружи порт пробрасывается только на 127.0.0.1 хоста (vps compose).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]