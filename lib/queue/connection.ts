import { Redis, RedisOptions } from 'ioredis';

const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.error('Redis connection failed after 10 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
};

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(redisConfig);

    redisConnection.on('connect', () => {
      console.log('✓ Redis connected');
    });

    redisConnection.on('error', (error) => {
      console.error('Redis connection error:', error.message);
    });

    redisConnection.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  return redisConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    console.log('Redis connection closed gracefully');
  }
}

export { redisConfig };
