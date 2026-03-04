#!/usr/bin/env python
"""Django's command-line utility for administrative tasks.

⚠️ Dev-helper: when two containers call `migrate` against the same Postgres DB
(e.g. `documents` and `documents_worker`), they can race.
We serialize migrations using a Postgres advisory lock.
"""
import os
import sys


LOCK_ID = 927364512  # any stable 32-bit integer is fine


def _maybe_lock_for_migrate() -> object | None:
    """Acquire pg_advisory_lock for migrate-like commands.

    Returns a psycopg connection (autocommit) if lock is acquired, else None.
    """
    if len(sys.argv) < 2:
        return None

    cmd = sys.argv[1]
    if cmd not in {"migrate", "makemigrations", "showmigrations"}:
        return None

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url.startswith("postgres"):
        return None

    try:
        import psycopg
    except Exception:
        return None

    conn = psycopg.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_lock(%s);", (LOCK_ID,))
    return conn


def _unlock(conn: object | None) -> None:
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(%s);", (LOCK_ID,))
    finally:
        try:
            conn.close()
        except Exception:
            pass


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "documents_service.settings")

    lock_conn = _maybe_lock_for_migrate()

    try:
        try:
            from django.core.management import execute_from_command_line
        except ImportError as exc:
            raise ImportError(
                "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? Did you forget to activate a virtual environment?"
            ) from exc

        execute_from_command_line(sys.argv)
    finally:
        _unlock(lock_conn)


if __name__ == "__main__":
    main()
