import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pollAPI } from '../services/api';

function Home() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPolls();
  }, []);

  const loadPolls = async () => {
    try {
      setLoading(true);
      const data = await pollAPI.getAll();
      setPolls(data.polls);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading polls...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🗳️ Live Voting</h1>
        <Link to="/create" className="btn btn-primary">
          Create New Poll
        </Link>
      </div>

      <div className="polls-grid">
        {polls.length === 0 ? (
          <div className="empty-state">
            <p>No polls yet. Create one to get started!</p>
            <Link to="/create" className="btn btn-primary">
              Create First Poll
            </Link>
          </div>
        ) : (
          polls.map((poll) => (
            <div key={poll.id} className="poll-card">
              <h3>{poll.title}</h3>
              <div className="poll-meta">
                <span>{poll.optionCount} options</span>
                <span className="status-badge">{poll.status}</span>
              </div>
              <div className="poll-actions">
                <Link to={`/poll/${poll.id}`} className="btn btn-secondary">
                  Vote Now
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;