"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"
import { timeUtils, api } from "@/lib/utils"

interface StudentData {
  studentId: number
  username: string
  fId: string
  fullName: string
  email: string
  createdAt: string
  message: string
}

interface ExamSchedule {
  id: number
  exam: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
}

interface ScheduleResponse {
  count: number
  next: string | null
  previous: string | null
  results: ExamSchedule[]
}

export default function PreExamCountdown() {
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [examSchedule, setExamSchedule] = useState<ScheduleResponse | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const [examEnded, setExamEnded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Get student data from localStorage
    const studentDataStr = localStorage.getItem("studentData")
    const scheduleDataStr = localStorage.getItem("examSchedule")
    
    if (studentDataStr) {
      setStudentData(JSON.parse(studentDataStr))
    } else {
      router.push("/")
      return
    }

    if (scheduleDataStr) {
      setExamSchedule(JSON.parse(scheduleDataStr))
    }
    
    setLoading(false)
  }, [router])

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!examSchedule || !examSchedule.results.length) return

      const activeExam = examSchedule.results.find(exam => exam.is_active)
      if (!activeExam) return

      if (timeUtils.isExamEnded(activeExam.end_time)) {
        setExamEnded(true)
        setExamStarted(false)
        setTimeLeft(0)
      } else if (timeUtils.isExamActive(activeExam.start_time, activeExam.end_time)) {
        setExamStarted(true)
        setTimeLeft(0)
      } else {
        setExamStarted(false)
        const timeUntil = timeUtils.calculateTimeUntilExam(activeExam.start_time)
        setTimeLeft(Math.max(0, timeUntil))
      }
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    
    return () => clearInterval(timer)
  }, [examSchedule])



  const handleStartExam = () => {
    router.push("/exam")
  }

  const refreshSchedule = async () => {
    setRefreshing(true)
    try {
      const scheduleData = await api.getSchedules()
      localStorage.setItem('examSchedule', JSON.stringify(scheduleData))
      setExamSchedule(scheduleData)
    } catch (error) {
      console.error('Failed to refresh schedule:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("studentData")
    localStorage.removeItem("examSchedule")
    localStorage.removeItem("selectedExamId")
    router.push("/")
  }

  if (loading || !studentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading...</div>
      </div>
    )
  }

  const activeExam = examSchedule?.results.find(exam => exam.is_active)

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/images/diu-logo.png"
                alt="Daffodil International University"
                width={400}
                height={120}
                className="h-20 w-auto"
              />
            </div>
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent mb-4">Admission Test, Summer 2026</h2>
          </div>
          <div className="flex items-start gap-2">
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              size="sm"
              className="border-[#2E3094] text-[#2E3094] hover:bg-[#2E3094] hover:text-white"
            >
              View Dashboard
            </Button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200 mt-1"
              title="Logout"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Student Information */}
        <Card className="mb-8 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Student Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Student ID:</span>
              <span className="text-gray-600">{studentData.fId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Username:</span>
              <span className="text-gray-600">{studentData.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Full Name:</span>
              <span className="text-gray-600">{studentData.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Email:</span>
              <span className="text-gray-600">{studentData.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Exam Schedule Information */}
        <Card className="mb-8 border-gray-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-gray-900">Exam Schedule</CardTitle>
            <button
              onClick={refreshSchedule}
              disabled={refreshing}
              className="p-2 rounded-full text-[#2E3094] hover:bg-gradient-to-r hover:from-[#2E3094] hover:to-[#4C51BF] hover:text-white transition-all duration-200 disabled:opacity-50 ml-auto"
              title="Refresh Schedule"
            >
              {refreshing ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 20V14H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14L18.36 18.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeExam ? (
              <>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Exam ID:</span>
                  <span className="text-gray-600">{activeExam.exam}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Start Time:</span>
                  <span className="text-gray-600">{timeUtils.formatDateTime(activeExam.start_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">End Time:</span>
                  <span className="text-gray-600">{timeUtils.formatDateTime(activeExam.end_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Status:</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    examEnded ? 'bg-red-100 text-red-800' : 
                    examStarted ? 'bg-green-100 text-green-800' : 
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {examEnded ? 'Ended' : examStarted ? 'In Progress' : 'Scheduled'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600">No active exam scheduled</p>
                {examSchedule && examSchedule.results.length > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    {examSchedule.results.length} exam(s) found, but none are currently active
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Countdown Timer */}
        <Card className="text-center border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">
              {examEnded ? "Exam Ended" : examStarted ? "Exam in Progress" : "Exam Starts In"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!activeExam ? (
              <>
                <div className="text-2xl font-bold text-red-600 mb-4">No Active Exam</div>
                <p className="text-gray-600">There is no active exam scheduled at the moment.</p>
              </>
            ) : examEnded ? (
              <>
                <div className="text-4xl font-bold text-red-600 mb-4">Exam Has Ended</div>
                <p className="text-gray-600">The exam period has concluded. Please check your results.</p>
                <Button
                  onClick={() => router.push("/results")}
                  size="lg"
                  className="bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white px-8 py-3 text-lg"
                >
                  View Results
                </Button>
              </>
            ) : examStarted ? (
              <>
                <div className="text-4xl font-bold text-green-600 mb-4">Exam is Live!</div>
                <p className="text-gray-600 mb-6">You can now start your admission test</p>
                <Button
                  onClick={handleStartExam}
                  size="lg"
                  className="bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white px-8 py-3 text-lg"
                >
                  Start Exam
                </Button>
              </>
            ) : (
              <>
                <div className="text-6xl font-bold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent font-mono">{timeUtils.formatTime(timeLeft)}</div>
                <p className="text-gray-600">Please wait for the countdown to finish</p>
                <div className="mt-4 p-4 bg-gradient-to-r from-[#2E3094]/10 to-[#4C51BF]/10 rounded-lg">
                  <p className="text-sm text-[#2E3094]">
                    The exam will automatically become available when the countdown reaches zero.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-8 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-600">
              <li>• The exam consists of 5 subjects: Physics, Mathematics, General Knowledge, English, and ICT</li>
              <li>• You can navigate between subjects at any time during the exam</li>
              <li>• Each subject contains multiple choice questions</li>
              <li>• Make sure to answer all questions before submitting</li>
              <li>• Total exam duration: 2 hours</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
