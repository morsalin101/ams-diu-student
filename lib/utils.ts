import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// API Base URL
const API_BASE_URL = 'https://api.tatomal.me/api';

// Offset between the server (VPS) clock and this device's clock, in ms.
// Kept in sync by api.syncServerTime() so every countdown is anchored to the
// backend rather than the local PC clock (which can be misconfigured).
let clockOffsetMs = 0;

// The backend-anchored "now". Falls back to the local clock (offset 0) until
// the first successful sync, then self-corrects.
export const serverNow = () => Date.now() + clockOffsetMs;

// API utility functions
export const api = {
  // Sync this device's clock to the server. Uses the request round-trip
  // midpoint to estimate the offset, so timers match across all students'
  // machines regardless of their local clock.
  syncServerTime: async () => {
    const t0 = Date.now();
    const response = await fetch(`${API_BASE_URL}/server-time/`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const t1 = Date.now();

    if (!response.ok) {
      throw new Error('Failed to fetch server time');
    }

    const data = await response.json();
    const serverMs = Number(data?.now_ms);
    if (Number.isFinite(serverMs)) {
      clockOffsetMs = serverMs - (t0 + t1) / 2;
    }
    return clockOffsetMs;
  },

  // Student login
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/student/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return response.json();
  },

  // Get exam schedules
  getSchedules: async () => {
    const response = await fetch(`${API_BASE_URL}/schedules/`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch schedules');
    }

    return response.json();
  },

  // Get exam questions
  getExamQuestions: async (examId: number) => {
    const response = await fetch(
      `${API_BASE_URL}/student/exam/${examId}/questions/`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exam questions');
    }

    return response.json();
  },

  // Submit exam answers
  submitExam: async (
    examId: number,
    studentId: number,
    submissions: Array<{ question_id: number; answer: string }>
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/student/exam/${examId}/submit/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          student_id: studentId,
          submissions: submissions,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 'Failed to submit exam. Please try again.'
      );
    }

    return response.json();
  },

  // Autosave a single answer as a draft (server-side persistence)
  saveAnswer: async (
    examId: number,
    studentId: number,
    questionId: number,
    answer: string
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/student/exam/${examId}/save-answer/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          student_id: studentId,
          question_id: questionId,
          answer: answer,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save answer');
    }

    return response.json();
  },

  // Get previously saved draft answers (for recovery after reload/device failure)
  getDraftAnswers: async (examId: number, studentId: number) => {
    const response = await fetch(
      `${API_BASE_URL}/student/exam/${examId}/draft/${studentId}/`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch draft answers');
    }

    return response.json();
  },

  // Get exam results
  getExamResult: async (examId: number, studentId: number) => {
    const response = await fetch(
      `${API_BASE_URL}/student/exam/${examId}/result/${studentId}/`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      if (response.status === 403) {
        throw new Error(errorData?.error || 'Results are not published yet');
      } else if (response.status === 404) {
        throw new Error(errorData?.error || 'No results found for this exam');
      } else {
        throw new Error(errorData?.error || 'Failed to fetch exam results');
      }
    }

    return response.json();
  },

  // Get student scheduled exams
  getStudentScheduledExams: async (studentId: number) => {
    const response = await fetch(
      `${API_BASE_URL}/student/${studentId}/scheduled-exams/`,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch student scheduled exams');
    }

    return response.json();
  },
};

// Time utility functions
export const timeUtils = {
  formatTime: (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  },

  formatDateTime: (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    // Format: DD Month YYYY, HH:MM AM/PM
    const day = date.getDate();
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hoursStr = hours.toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
  },

  calculateTimeUntilExam: (startTime: string) => {
    const now = serverNow();
    const examStart = new Date(startTime).getTime();
    return Math.floor((examStart - now) / 1000);
  },

  isExamActive: (startTime: string, endTime: string) => {
    const now = serverNow();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return now >= start && now < end;
  },

  isExamEnded: (endTime: string) => {
    const now = serverNow();
    const end = new Date(endTime).getTime();
    return now >= end;
  },
};
