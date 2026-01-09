import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

class SocketService {
  constructor() {
    this.socket = null;
    this.currentPollId = null;
  }

  connect() {
    if (!this.socket) {
      console.log('Connecting to Socket.IO server...');
      
      this.socket = io(SOCKET_URL, {
        transports: ['polling'], // Start with polling only
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10,
        timeout: 10000
      });
      
      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
      });

      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });
    }
    return this.socket;
  }

  joinPoll(pollId, callback) {
    console.log('Joining poll:', pollId);
    
    if (!this.socket || !this.socket.connected) {
      this.connect();
    }
    
    // Wait for connection before joining
    if (!this.socket.connected) {
      this.socket.once('connect', () => {
        this.doJoinPoll(pollId, callback);
      });
    } else {
      this.doJoinPoll(pollId, callback);
    }
  }

  doJoinPoll(pollId, callback) {
    // Leave previous poll if any
    if (this.currentPollId && this.currentPollId !== pollId) {
      this.socket.emit('leave_poll', this.currentPollId);
      this.socket.off('poll_update');
    }

    this.currentPollId = pollId;
    this.socket.emit('join_poll', pollId);

    // Listen for updates
    this.socket.on('poll_update', (data) => {
      console.log('📡 Received update:', data);
      callback(data);
    });

    this.socket.once('joined_poll', (data) => {
      console.log('🔔 Successfully joined poll:', data.pollId);
    });
  }

  leavePoll(pollId) {
    if (this.socket && pollId) {
      this.socket.emit('leave_poll', pollId);
      this.socket.off('poll_update');
      this.currentPollId = null;
    }
  }

  disconnect() {
    if (this.socket) {
      if (this.currentPollId) {
        this.socket.emit('leave_poll', this.currentPollId);
      }
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();