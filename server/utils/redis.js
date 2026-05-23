const { createClient } = require('redis');

let client = null;

const isCacheReady = () => Boolean(client?.isReady);

/**
 * Tear down the Redis client so failed connections do not keep retrying in the background.
 */
const teardownClient = async () => {
    const current = client;
    client = null;
    if (!current) return;

    current.removeAllListeners();
    try {
        if (current.isOpen) {
            await current.disconnect();
        }
    } catch {
        // ignore shutdown errors
    }
};

const logCacheDisabled = (() => {
    let logged = false;
    return () => {
        if (logged) return;
        logged = true;
        console.log('⚠️ Redis unavailable — running without cache');
    };
})();

/**
 * Connect to Redis. Called once on server startup.
 * If REDIS_URL is not set or Redis is unavailable, the app runs without caching.
 */
const connectRedis = async () => {
    const url = process.env.REDIS_URL?.trim();

    if (!url) {
        console.log('ℹ️  REDIS_URL not set — running without cache');
        return;
    }

    try {
        client = createClient({
            url,
            socket: {
                connectTimeout: 2000,
                reconnectStrategy: (retries) => {
                    if (retries > 1) return false;
                    return 200;
                },
            },
        });

        // Required so connection errors do not become unhandled rejections.
        client.on('error', () => {});

        const connectTimeoutMs = 6000;
        await Promise.race([
            client.connect(),
            new Promise((_, reject) => {
                setTimeout(
                    () => reject(new Error('Redis connect timeout')),
                    connectTimeoutMs
                );
            }),
        ]);

        if (!client.isReady) {
            throw new Error('Redis connected but not ready');
        }

        console.log('📡 Redis connected');
    } catch {
        await teardownClient();
        logCacheDisabled();
    }
};

/**
 * Get a cached value. Returns parsed JSON or null on miss/error.
 */
const getCache = async (key) => {
    if (!isCacheReady()) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

/**
 * Set a cache value with TTL in seconds.
 */
const setCache = async (key, data, ttlSeconds = 60) => {
    if (!isCacheReady()) return;
    try {
        await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
    } catch {
        // ignore — app continues without cache
    }
};

/**
 * Delete a specific cache key.
 */
const deleteCache = async (key) => {
    if (!isCacheReady()) return;
    try {
        await client.del(key);
    } catch {
        // ignore
    }
};

/**
 * Delete all keys matching a glob pattern (e.g., "events:*").
 */
const deleteCachePattern = async (pattern) => {
    if (!isCacheReady()) return;
    try {
        const batch = [];
        for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
            batch.push(key);
            if (batch.length >= 100) {
                await client.del(batch);
                batch.length = 0;
            }
        }
        if (batch.length > 0) {
            await client.del(batch);
        }
    } catch {
        // ignore
    }
};

/**
 * Disconnect Redis gracefully. Called on server shutdown.
 */
const disconnectRedis = async () => {
    const current = client;
    if (!current) return;

    client = null;
    current.removeAllListeners();
    try {
        if (current.isOpen) {
            await current.quit();
        }
    } catch {
        try {
            if (current.isOpen) {
                await current.disconnect();
            }
        } catch {
            // ignore
        }
    }
};

module.exports = {
    connectRedis,
    disconnectRedis,
    getCache,
    setCache,
    deleteCache,
    deleteCachePattern,
};
