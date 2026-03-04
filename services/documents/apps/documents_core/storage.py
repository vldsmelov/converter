import os
from dataclasses import dataclass

from minio import Minio


def get_bucket() -> str:
    return os.environ.get("MINIO_BUCKET", "documents")


def get_minio_client() -> Minio:
    # MinIO python client ждёт endpoint БЕЗ схемы: "minio:9000"
    endpoint = os.environ.get("MINIO_ENDPOINT", "minio:9000")

    # dev-defaults совпадают с docker-compose (MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)
    access_key = os.environ.get("MINIO_ACCESS_KEY", os.environ.get("MINIO_ROOT_USER", "minio"))
    secret_key = os.environ.get("MINIO_SECRET_KEY", os.environ.get("MINIO_ROOT_PASSWORD", "minio12345"))

    secure = os.environ.get("MINIO_SECURE", "0") == "1"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def ensure_bucket(client: Minio, bucket: str) -> None:
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


@dataclass
class MinioStream:
    """File-like wrapper to make sure urllib3 connection is released."""

    resp: object

    def read(self, *args, **kwargs):
        return self.resp.read(*args, **kwargs)

    def close(self):
        try:
            self.resp.close()
        finally:
            try:
                self.resp.release_conn()
            except Exception:
                pass
