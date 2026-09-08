import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/tox_documents")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MOCK_PROCESSING_DELAY_SECONDS = float(os.getenv("MOCK_PROCESSING_DELAY_SECONDS", "4"))
