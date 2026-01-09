const { redis } = require('../services/redis');

// Sliding window rate limiter
async function rateLimitVote(req, res, next) {
  try {
    const identifier = 
      req.headers['x-forwarded-for']?.split(',')[0] || 
      req.ip || 
      req.connection.remoteAddress || 
      'unknown';
    
    const limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10; // Max requests
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute    
    const key = `ratelimit:vote:${identifier}`;
    //Current timestamp
    const now = Date.now();
    const windowStart = now - windowMs;
    const pipeline = redis.pipeline();
    
    // Remove old requests (older than window)
    pipeline.zremrangebyscore(key, 0, windowStart);    
    pipeline.zcard(key); 
  
    //Add current request
    const requestId = `${now}-${Math.random()}`; // Unique ID
    pipeline.zadd(key, now, requestId);
    
    // Step 4: Set expiry for the key
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 10);    
    const results = await pipeline.exec();    
    const count = results[1][1]; // [error, result] format
    
    //Check if limit exceeded
    if (count >= limit) {
      // Calculate retry time
      const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTimestamp = oldestRequest[1] ? parseInt(oldestRequest[1]) : now;
      const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      
      //Return 429 with headers
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Maximum ${limit} votes per ${windowMs / 1000} seconds.`,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
        limit,
        remaining: 0,
        resetAt: new Date(oldestTimestamp + windowMs).toISOString()
      }).set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(oldestTimestamp + windowMs).toISOString(),
        'Retry-After': retryAfter > 0 ? retryAfter : 1
      });
    }    
    const remaining = limit - count - 1;
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });
    
    next();
    
  } catch (error) {
    console.error('Rate limit error:', error);
    next();
  }
}
module.exports = {
  rateLimitVote
};