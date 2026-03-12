FROM python:3.12-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry

# Copy poetry configuration files
COPY pyproject.toml poetry.lock* /app/

# Configure poetry to not create a virtual environment
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --only main --no-interaction --no-ansi

# Copy the rest of the application
COPY . /app/

# Expose the port the app runs on
EXPOSE 8000

# Create a non-root user and switch to it for security
RUN addgroup --system app && \
    adduser --system --group app && \
    chown -R app:app /app
USER app

# Command to run the application
CMD ["poetry", "run", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
