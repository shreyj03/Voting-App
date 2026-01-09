require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function createPoll(title) {
  const response = await axios.post(`${API_URL}/polls`, {
    title,
    options: ['Yes', 'No']
  });
  return response.data.poll.id;
}

async function testRateLimitAcrossPolls() {
  console.log('🧪 Testing Rate Limiting Across Multiple Polls\n');
  
  // Create 15 polls
  console.log('Creating 15 test polls...');
  const pollIds = [];
  for (let i = 1; i <= 15; i++) {
    const pollId = await createPoll(`Rate limit test ${i}`);
    pollIds.push(pollId);
    process.stdout.write(`Created poll ${i}/15\r`);
  }
  console.log('\n✅ All polls created\n');
  
  // Vote on each poll (same IP)
  const TEST_IP = '10.0.0.250';
  let successCount = 0;
  let rateLimitedCount = 0;
  
  console.log('Voting on each poll...\n');
  
  for (let i = 0; i < pollIds.length; i++) {
    try {
      const response = await axios.post(
        `${API_URL}/polls/${pollIds[i]}/vote`,
        { optionId: 'A' },
        {
          headers: {
            'X-Forwarded-For': TEST_IP
          }
        }
      );
      
      successCount++;
      const remaining = response.headers['x-ratelimit-remaining'];
      console.log(`✅ Vote ${i + 1}: Success (Remaining: ${remaining})`);
      
    } catch (error) {
      if (error.response?.status === 429) {
        rateLimitedCount++;
        const retryAfter = error.response.headers['retry-after'];
        console.log(`🛑 Vote ${i + 1}: RATE LIMITED (Retry after: ${retryAfter}s)`);
      } else {
        console.log(`❌ Vote ${i + 1}: Error - ${error.response?.data?.error}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Results:');
  console.log(`   Successful votes: ${successCount}`);
  console.log(`   Rate limited: ${rateLimitedCount}`);
  console.log(`   Expected: ~10 success, ~5 rate limited`);
  
  if (successCount === 10 && rateLimitedCount === 5) {
    console.log('\n✅ RATE LIMITING WORKS PERFECTLY!');
  } else if (rateLimitedCount > 0) {
    console.log('\n✅ Rate limiting is working!');
  } else {
    console.log('\n❌ Rate limiting did not trigger');
  }
}

testRateLimitAcrossPolls();