import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const pollAPI = {
  getAll: async () => {
    const response = await api.get('/polls');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/polls/${id}`);
    return response.data;
  },

  getResults: async (id) => {
    const response = await api.get(`/polls/${id}/results`);
    return response.data;
  },

  create: async (pollData) => {
    const response = await api.post('/polls', pollData);
    return response.data;
  },

  vote: async (pollId, optionId) => {
    const response = await api.post(`/polls/${pollId}/vote`, { optionId });
    return response.data;
  }
};

export default api;