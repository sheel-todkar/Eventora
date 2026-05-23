const { createClient } = require('redis');

let client = null;
let isConnected = false;

/**
 * Connect to Redis. Called once on server startup.
 * If Redis is unavailable, the app continues without caching.
 */
const connectRedis = async () => {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
        client = createClient({ url });

        client.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
            isConnected = false;
        });

        client.on('connect', () => {
            console.log('📡 Redis connected');
            isConnected = true;
        });

        client.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });

        client.on('end', () => {
            console.log('🔌 Redis disconnected');
            isConnected = false;
        });

        await client.connect();
    } catch (error) {
        console.error('⚠️ Redis connection failed — running without cache:', error.message);
        isConnected = false;
    }
};

/**
 * Get a cached value. Returns parsed JSON or null on miss/error.
 */
const getCache = async (key) => {
    if (!isConnected || !client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Redis GET error:', error.message);
        return null;
    }
};

/**
 * Set a cache value with TTL in seconds.
 */
const setCache = async (key, data, ttlSeconds = 60) => {
    if (!isConnected || !client) return;
    try {
        await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
    } catch (error) {
        console.error('Redis SET error:', error.message);
    }
};

/**
 * Delete a specific cache key.
 */
const deleteCache = async (key) => {
    if (!isConnected || !client) return;
    try {
        await client.del(key);
    } catch (error) {
        console.error('Redis DEL error:', error.message);
    }
};

/**
 * Delete all keys matching a glob pattern (e.g., "events:*").
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 */
const deleteCachePattern = async (pattern) => {
    if (!isConnected || !client) return;
    try {
        let cursor = 0;
        do {
            const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
            cursor = result.cursor;
            if (result.keys.length > 0) {
                await client.del(result.keys);
            }
        } while (cursor !== 0);
    } catch (error) {
        console.error('Redis pattern DEL error:', error.message);
    }
};

/**
 * Disconnect Redis gracefully. Called on server shutdown.
 */
const disconnectRedis = async () => {
    if (client) {
        try {
            await client.quit();
        } catch (error) {
            console.error('Redis disconnect error:', error.message);
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
