import axios from 'axios';
import getBackendUrl from '../api/getUrl';

export const api = axios.create({
  baseURL: `${getBackendUrl()}:3000/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;

type FailedRequest = {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
};

let failedQueue: FailedRequest[] = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(promise => {
    if (error) promise.reject(error);
    else promise.resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {

      if (isRefreshing) {
        originalRequest._retry = true;
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(api(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${getBackendUrl()}:3000/api/user/refresh`,
          {},
          { withCredentials: true }
        );

        processQueue();
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError);
        return Promise.reject(refreshError);

      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const handleApiError = (error: any) => {
  if (axios.isAxiosError(error) && error.response) {
    return error.response.data?.error || 'An unexpected error occurred';
  }
  return error?.message || 'Network error';
};
