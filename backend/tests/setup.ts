process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/relay-test";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "silent";
process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-at-least-32-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-at-least-32-characters";
// Integration tests do not require a live Redis server; transport behavior is unit-tested.
process.env.REDIS_URL = "";
process.env.AUDIO_STORAGE_DIR = ".relay-data/test-audio";
