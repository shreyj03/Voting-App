const cron = require('node-cron');
const Poll = require('../models/Poll');
const { redis, getVoteCounts } = require('./redis');

//Sync Redis vote counts to MongoDB
 /* 
 * How it works:
 * 1. Get all active polls from MongoDB
 * 2. For each poll, fetch vote counts from Redis
 * 3. Update MongoDB with new counts
 * 4. Run every 30 seconds
  */

// Track sync statistics
let syncStats = {
  lastRun: null,
  totalSyncs: 0,
  totalPollsSynced: 0,
  totalVotesSynced: 0,
  errors: 0
};

async function syncPoll(poll) {
  try {
    const optionIds = poll.options.map(opt => opt.id);    
    const voteCounts = await getVoteCounts(poll._id.toString(), optionIds);    
    const totalVotes = voteCounts.reduce((sum, opt) => sum + opt.votes, 0);    
    for (const voteData of voteCounts) {
      const optionIndex = poll.options.findIndex(opt => opt.id === voteData.optionId);
      
      if (optionIndex !== -1) {
        poll.options[optionIndex].votes = voteData.votes;
      }
    }    
    poll.totalVotes = totalVotes;    
    await poll.save();
    
    return {
      pollId: poll._id,
      totalVotes,
      synced: true
    };
    
  } catch (error) {
    console.error(`Sync error for poll ${poll._id}:`, error);
    return {
      pollId: poll._id,
      synced: false,
      error: error.message
    };
  }
}

/**
 sync all active polls
 */
async function syncAllPolls() {
  const startTime = Date.now();
  
  try {
    console.log('Starting sync job...');    
    const polls = await Poll.find({ status: 'active' });
    
    if (polls.length === 0) {
      console.log('No active polls to sync');
      return;
    }
    
    console.log(`Found ${polls.length} active polls`);
    
    // Sync each poll
    const results = await Promise.all(
      polls.map(poll => syncPoll(poll))
    );
    
    // Calculate statistics
    const successCount = results.filter(r => r.synced).length;
    const totalVotes = results.reduce((sum, r) => sum + (r.totalVotes || 0), 0);
    const duration = Date.now() - startTime;
    
    // Update stats
    syncStats.lastRun = new Date();
    syncStats.totalSyncs++;
    syncStats.totalPollsSynced += successCount;
    syncStats.totalVotesSynced += totalVotes;
    
    console.log(`Sync complete: ${successCount}/${polls.length} polls synced, ${totalVotes} total votes (${duration}ms)`);
    
    return {
      success: true,
      pollsSynced: successCount,
      totalPolls: polls.length,
      totalVotes,
      duration
    };
    
  } catch (error) {
    console.error('Sync job failed:', error);
    syncStats.errors++;
    
    return {
      success: false,
      error: error.message
    };
  }
}

function startSyncJob() {
  const job = cron.schedule('*/30 * * * * *', () => {
    syncAllPolls();
  });
    
  setTimeout(() => {
    console.log('Running initial sync...');
    syncAllPolls();
  }, 5000); 
  
  return job;
}

/**
 *sync statistics for monitoring
 */
function getSyncStats() {
  return {
    ...syncStats,
    uptime: syncStats.lastRun ? 
      Math.floor((Date.now() - syncStats.lastRun.getTime()) / 1000) : 
      null
  };
}

module.exports = {
  startSyncJob,
  syncAllPolls,
  getSyncStats
};