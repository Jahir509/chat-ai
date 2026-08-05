FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh \
    && adduser --system --group app \
    && mkdir -p /app/staticfiles \
    && chown -R app:app /app

USER app

EXPOSE 8000

CMD ["./entrypoint.sh"]