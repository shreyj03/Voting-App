const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const { 
  getVoteCounts, 
  incrementVote, 
  hasVoted, 
  recordVote 
} = require('../services/redis');
const { rateLimitVote } = require('../middleware/rateLimit');

// POST /api/polls - Create a new poll
router.post('/polls', async (req, res) => {
  try {
    const { title, options, settings } = req.body;
    
    if (!title || !options || !Array.isArray(options)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Title and options array are required'
      });
    }
    
    if (options.length < 2 || options.length > 10) {
      return res.status(400).json({
        error: 'Invalid options',
        message: 'Poll must have between 2 and 10 options'
      });
    }
    
    const formattedOptions = options.map((opt, index) => ({
      id: String.fromCharCode(65 + index),
      text: typeof opt === 'string' ? opt : opt.text
    }));
    
    const poll = new Poll({
      title,
      options: formattedOptions,
      settings: settings || {},
      createdBy: req.headers['x-user-id'] || 'anonymous'
    });
    
    await poll.save();
    
    res.status(201).json({
      success: true,
      poll: {
        id: poll._id,
        title: poll.title,
        options: poll.options,
        status: poll.status,
        createdAt: poll.createdAt
      }
    });
    
  } catch (error) {
    console.error('Create poll error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create poll'
    });
  }
});

// GET /api/polls/:id - Get a single poll
router.get('/polls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid poll ID format'
      });
    }
    
    const poll = await Poll.findById(id);
    
    if (!poll) {
      return res.status(404).json({
        error: 'Poll not found'
      });
    }
    
    res.json({
      success: true,
      poll: {
        id: poll._id,
        title: poll.title,
        options: poll.options,
        status: poll.status,
        settings: poll.settings,
        createdAt: poll.createdAt,
        updatedAt: poll.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({
      error: 'Failed to fetch poll'
    });
  }
});

// GET /api/polls/:id/results - Get poll with vote counts
router.get('/polls/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid poll ID format'
      });
    }
    
    const poll = await Poll.findById(id);
    
    if (!poll) {
      return res.status(404).json({
        error: 'Poll not found'
      });
    }
    
    const optionIds = poll.options.map(opt => opt.id);
    const voteCounts = await getVoteCounts(id, optionIds);
    
    const results = poll.options.map(option => {
      const voteData = voteCounts.find(v => v.optionId === option.id);
      return {
        id: option.id,
        text: option.text,
        votes: voteData ? voteData.votes : 0
      };
    });
    
    const totalVotes = results.reduce((sum, opt) => sum + opt.votes, 0);
    
    res.json({
      success: true,
      poll: {
        id: poll._id,
        title: poll.title,
        status: poll.status,
        createdAt: poll.createdAt
      },
      results,
      totalVotes
    });
    
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      error: 'Failed to fetch results'
    });
  }
});

// GET /api/polls - List all active polls
router.get('/polls', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const polls = await Poll.findActive()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select('title options status createdAt');
    
    const total = await Poll.countDocuments({ status: 'active' });
    
    res.json({
      success: true,
      polls: polls.map(p => ({
        id: p._id,
        title: p.title,
        optionCount: p.options.length,
        status: p.status,
        createdAt: p.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('List polls error:', error);
    res.status(500).json({
      error: 'Failed to fetch polls'
    });
  }
});

// POST /api/polls/:id/vote - Cast a vote
router.post('/polls/:id/vote', rateLimitVote,async (req, res) => {
  try {
    const { id } = req.params;
    const { optionId } = req.body;
    
    // Validation
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: 'Invalid poll ID format'
      });
    }
    
    if (!optionId) {
      return res.status(400).json({
        error: 'Option ID is required'
      });
    }
    
    const poll = await Poll.findById(id);
    
    if (!poll) {
      return res.status(404).json({
        error: 'Poll not found'
      });
    }
    
    if (!poll.isActive()) {
      return res.status(400).json({
        error: 'Poll is not active',
        message: 'This poll has been closed or expired'
      });
    }
    
    const optionExists = poll.options.some(opt => opt.id === optionId);
    
    if (!optionExists) {
      return res.status(400).json({
        error: 'Invalid option',
        message: `Option '${optionId}' does not exist in this poll`
      });
    }
    
    const identifier = 
      req.headers['x-forwarded-for']?.split(',')[0] || 
      req.ip || 
      req.connection.remoteAddress || 
      'unknown';
    
    const alreadyVoted = await hasVoted(id, identifier);
    
    if (alreadyVoted) {
      return res.status(409).json({
        error: 'Already voted',
        message: 'You have already voted on this poll'
      });
    }
    
    // Cast the vote
    await incrementVote(id, optionId);
    await recordVote(id, identifier);
    
    // Get updated results
    const optionIds = poll.options.map(opt => opt.id);
    const voteCounts = await getVoteCounts(id, optionIds);
    
    const results = poll.options.map(option => {
      const voteData = voteCounts.find(v => v.optionId === option.id);
      return {
        id: option.id,
        text: option.text,
        votes: voteData ? voteData.votes : 0
      };
    });
    
    const totalVotes = results.reduce((sum, opt) => sum + opt.votes, 0);
    
    // CONCEPT: Get io from app (attached in index.js)
    const io = req.app.get('io');
    
    // Real-time broadcast
    const updatePayload = {
      pollId: id,
      results,
      totalVotes,
      lastVote: {
        optionId,
        timestamp: new Date().toISOString()
      }
    };
    
    io.to(`poll:${id}`).emit('poll_update', updatePayload);
    console.log(`📡 Broadcasted update for poll ${id} to room`);
    
    res.json({
      success: true,
      message: 'Vote recorded successfully',
      votedFor: optionId,
      results,
      totalVotes
    });
    
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      error: 'Failed to record vote',
      message: error.message
    });
  }
});

module.exports = router;