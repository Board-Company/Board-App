FROM python:3.12-slim

WORKDIR /app

RUN pip install poetry

COPY pyproject.toml poetry.lock* /app/

RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-interaction --no-ansi

COPY . /app/

EXPOSE 8001

RUN addgroup --system app \
    && adduser --system --group app \
    && chown -R app:app /app
USER app

CMD ["poetry", "run", "uvicorn", "llm_service:app", "--host", "0.0.0.0", "--port", "8001"]
