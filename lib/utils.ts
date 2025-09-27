import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// API Base URL
const API_BASE_URL = 'https://ams-diu-backend.onrender.com/api'

// API utility functions
export const api = {
  // Student login
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/student/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
    
    if (!response.ok) {
      throw new Error('Login failed')
    }
    
    return response.json()
  },

  // Get exam schedules
  getSchedules: async () => {
    const response = await fetch(`${API_BASE_URL}/schedules/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch schedules')
    }
    
    return response.json()
  },

  // Get exam questions
  getExamQuestions: async (examId: number) => {
    const response = await fetch(`${API_BASE_URL}/student/exam/${examId}/questions/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch exam questions')
    }
    
    return response.json()
  },

  // Submit exam answers
  submitExam: async (examId: number, studentId: number, submissions: Array<{question_id: number, answer: string}>) => {
    const response = await fetch(`${API_BASE_URL}/student/exam/${examId}/submit/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        student_id: studentId,
        submissions: submissions
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to submit exam')
    }
    
    return response.json()
  },

  // Get exam results
  getExamResult: async (examId: number, studentId: number) => {
    const response = await fetch(`${API_BASE_URL}/student/exam/${examId}/result/${studentId}/`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch exam results')
    }
    
    return response.json()
  }
}

// Time utility functions
export const timeUtils = {
  formatTime: (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  },

  formatDateTime: (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  },

  calculateTimeUntilExam: (startTime: string) => {
    const now = new Date().getTime()
    const examStart = new Date(startTime).getTime()
    return Math.floor((examStart - now) / 1000)
  },

  isExamActive: (startTime: string, endTime: string) => {
    const now = new Date().getTime()
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    return now >= start && now < end
  },

  isExamEnded: (endTime: string) => {
    const now = new Date().getTime()
    const end = new Date(endTime).getTime()
    return now >= end
  }
}
