require('dotenv').config({ path: './backend/.env' }); 
const { connectDB } = require('./src/services/database');
const Poll = require('./src/models/Poll');

async function checkVotes() {
  await connectDB();
  
  console.log('📊 Checking MongoDB Vote Data\n');
  
  const polls = await Poll.find({ status: 'active' });
  
  for (const poll of polls) {
    console.log(`Poll: ${poll.title}`);
    console.log(`  ID: ${poll._id}`);
    console.log(`  Total Votes: ${poll.totalVotes}`);
    console.log(`  Last Synced: ${poll.lastSyncedAt || 'Never'}`);
    console.log(`  Options:`);
    
    for (const option of poll.options) {
      console.log(`    ${option.id}: ${option.text} - ${option.votes} votes`);
    }
    
    console.log('');
  }
  
  process.exit(0);
}

checkVotes();