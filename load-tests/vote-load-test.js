import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 200 },  // Spike to 200 users
    { duration: '1m', target: 200 },   // Stay at 200
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s (generous for free tier)
    errors: ['rate<0.1'],               // Error rate under 10%
  },
};

const BASE_URL = 'https://voting-app-i3ap.onrender.com/api';

let pollId = null;

export function setup() {
  console.log('Creating test poll...');
  
  const createRes = http.post(
    `${BASE_URL}/polls`,
    JSON.stringify({
      title: 'Load Test Poll - ' + new Date().toISOString(),
      options: ['Option A', 'Option B', 'Option C', 'Option D']
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (createRes.status !== 201) {
    console.error('Failed to create poll:', createRes.body);
    return { pollId: null };
  }
  
  const poll = JSON.parse(createRes.body);
  console.log('Created test poll:', poll.poll.id);
  return { pollId: poll.poll.id };
}

export default function (data) {
  if (!data.pollId) {
    console.error('No poll ID available');
    return;
  }
  
  const pollId = data.pollId;
  const options = ['A', 'B', 'C', 'D'];
  const randomOption = options[Math.floor(Math.random() * options.length)];
  
  // Simulate different IPs for each virtual user
  const fakeIP = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  // Cast vote
  const voteRes = http.post(
    `${BASE_URL}/polls/${pollId}/vote`,
    JSON.stringify({ optionId: randomOption }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': fakeIP,
      },
      timeout: '10s',
    }
  );
  
  // Check response (200 = success, 409 = already voted, 429 = rate limited)
  const success = check(voteRes, {
    'status is 200, 409, or 429': (r) => [200, 409, 429].includes(r.status),
    'response time OK': (r) => r.timings.duration < 5000,
  });
  
  if (!success) {
    console.error(`Vote failed: ${voteRes.status} - ${voteRes.body}`);
  }
  
  errorRate.add(!success);
  
  // Get results
  const resultsRes = http.get(`${BASE_URL}/polls/${pollId}/results`, {
    timeout: '10s',
  });
  
  check(resultsRes, {
    'results status is 200': (r) => r.status === 200,
  });
  
  sleep(1); // Wait 1 second between requests per user
}

export function teardown(data) {
  if (data.pollId) {
    console.log(`Test complete. Poll ID: ${data.pollId}`);
    console.log(`View results: https://voting-app-xi-gray.vercel.app/poll/${data.pollId}`);
  }
}