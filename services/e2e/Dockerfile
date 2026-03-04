FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY pytest.ini /app/pytest.ini
COPY tests /app/tests

CMD ["pytest"]
