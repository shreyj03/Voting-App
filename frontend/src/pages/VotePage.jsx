import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { pollAPI } from '../services/api';
import socketService from '../services/socket';

function VotePage() {
  const { id } = useParams();
  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voted, setVoted] = useState(false);
  const [votedFor, setVotedFor] = useState(null);

  useEffect(() => {
    loadPoll();
    loadResults();

    socketService.joinPoll(id, handlePollUpdate);

    return () => {
      socketService.leavePoll(id);
    };
  }, [id]);

  const loadPoll = async () => {
    try {
      const data = await pollAPI.getById(id);
      setPoll(data.poll);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    try {
      const data = await pollAPI.getResults(id);
      setResults(data.results);
      setTotalVotes(data.totalVotes);
    } catch (err) {
      console.error('Load results error:', err);
    }
  };

  const handlePollUpdate = (data) => {
    console.log('📡 Received update:', data);
    setResults(data.results);
    setTotalVotes(data.totalVotes);
  };

  const handleVote = async (optionId) => {
    try {
      const response = await pollAPI.vote(id, optionId);
      setVoted(true);
      setVotedFor(optionId);
      setResults(response.results);
      setTotalVotes(response.totalVotes);
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      
      if (err.response?.status === 409) {
        // Already voted
        setVoted(true);
        alert(message);
      } else if (err.response?.status === 429) {
        // Rate limited
        alert(`⛔ ${message}`);
      } else {
        alert(`Error: ${message}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading poll...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-box">{error}</div>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="vote-page">
        <div className="poll-header">
          <h1>{poll.title}</h1>
          <div className="poll-stats">
            <span className="status-badge">{poll.status}</span>
            <span>{totalVotes} votes</span>
          </div>
        </div>

        {!voted ? (
          <div className="vote-section">
            <h2>Cast Your Vote</h2>
            <div className="options-list">
              {poll.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  className="option-button"
                >
                  <span className="option-id">{option.id}</span>
                  <span className="option-text">{option.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="voted-message">
            ✅ You voted for option {votedFor}
          </div>
        )}

        <div className="results-section">
          <h2>Live Results</h2>
          <div className="results-list">
            {results.map((result) => {
              const percentage = totalVotes > 0 
                ? ((result.votes / totalVotes) * 100).toFixed(1) 
                : 0;
              
              return (
                <div 
                  key={result.id} 
                  className={`result-item ${votedFor === result.id ? 'voted' : ''}`}
                >
                  <div className="result-header">
                    <span className="option-label">
                      <strong>{result.id}:</strong> {result.text}
                    </span>
                    <span className="result-stats">
                      {result.votes} votes ({percentage}%)
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Link to="/" className="btn btn-secondary">
          ← Back to Polls
        </Link>
      </div>
    </div>
  );
}

export default VotePage;