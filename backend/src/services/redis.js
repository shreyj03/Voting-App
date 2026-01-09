const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME || 'default',
  
  //retry strategy for handling connection issues
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000); 
    return delay;
  },
  maxRetriesPerRequest: 3 
});

// debugging purpose
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

async function incrementVote(pollId, optionId) {
  const key = `poll:${pollId}:option:${optionId}`;
  const newCount = await redis.incr(key);
  return newCount;
}

async function getVoteCounts(pollId, optionIds) {
  const keys = optionIds.map(id => `poll:${pollId}:option:${id}`);
  const counts = await redis.mget(keys);
  
  return counts.map((count, idx) => ({
    optionId: optionIds[idx],
    votes: count ? parseInt(count, 10) : 0
  }));
}

async function hasVoted(pollId, identifier) {
  const key = `poll:${pollId}:voters`;
  const exists = await redis.sismember(key, identifier);
  return exists === 1; 
}

async function recordVote(pollId, identifier) {
  const key = `poll:${pollId}:voters`;
  await redis.sadd(key, identifier);
  
  //expiry (auto-delete after 7 days)
  await redis.expire(key, 60 * 60 * 24 * 7); // 7 days in seconds
}

async function getTotalVotes(pollId, optionIds) {
  const counts = await getVoteCounts(pollId, optionIds);
  return counts.reduce((sum, opt) => sum + opt.votes, 0);
}

module.exports = { 
  redis, 
  incrementVote, 
  getVoteCounts,
  hasVoted,
  recordVote,
  getTotalVotes
};