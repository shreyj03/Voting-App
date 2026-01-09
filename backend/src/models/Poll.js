const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
    title: {
    type: String,
    required: [true, 'Poll title is required'], // Error message if missing
    trim: true,  // Remove whitespace from start/end
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title must be less than 200 characters']
  },

    options: [{
    id: {
      type: String,
      required: true
      // Will be "A", "B", "C", "D" etc.
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Option text must be less than 100 characters']
    },
  votes: {
      type: Number,
      default: 0
    }
  }],
  
  status: {
    type: String,
    enum: ['active', 'closed', 'draft'], 
    default: 'active'
  },

  createdBy: {
    type: String,
    default: 'anonymous'
  },

  settings: {
    allowMultipleVotes: {
      type: Boolean,
      default: false // defualt one vote per person
    },
    requireAuth: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: null // No expiration by default
    }
  },

  totalVotes: {
    type: Number,
    default: 0
  },

  lastSyncedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

pollSchema.path('options').validate(function(options) {
  return options && options.length >= 2 && options.length <= 10;
}, 'Poll must have between 2 and 10 options');

pollSchema.methods.isActive = function() {
  // Check status
  if (this.status !== 'active') return false;
    if (this.settings.expiresAt && this.settings.expiresAt < new Date()) {
    return false;
  }
  return true;
};

pollSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    $or: [
      { 'settings.expiresAt': null },
      { 'settings.expiresAt': { $gt: new Date() } }
    ]
  });
};

const Poll = mongoose.model('Poll', pollSchema);

module.exports = Poll;

