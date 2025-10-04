"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { timeUtils, api } from "@/lib/utils"

interface StudentInfo {
  username: string
  f_id: string
  department_shortname: string
}

interface ExamDetails {
  department: string
  semester: string
  total_questions: number
  total_marks: number
  duration_minutes: number
  language: string
  faculty: string
}

interface ScheduleDetails {
  start_time: string
  end_time: string
  is_active: boolean
}

interface TeacherInfo {
  teacher_id: number
  teacher_name: string
}

interface ScheduledExam {
  assignment_id: number
  schedule_id: number
  exam_id: number
  exam_details: ExamDetails
  schedule_details: ScheduleDetails
  teacher_info: TeacherInfo
  assigned_at: string
}

interface StudentScheduledExamsResponse {
  student_id: number
  student_info: StudentInfo
  scheduled_exams: ScheduledExam[]
  total_assigned_exams: number
}

interface StudentData {
  studentId: number
  username: string
  fId: string
  fullName: string
  email: string
  createdAt: string
  message: string
}

export default function StudentDashboard() {
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [scheduledExams, setScheduledExams] = useState<StudentScheduledExamsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [examTimers, setExamTimers] = useState<Record<number, {
    timeLeft: number
    canStart: boolean
    hasEnded: boolean
    isActive: boolean
  }>>({})
  
  const router = useRouter()

  useEffect(() => {
    // Get student data from localStorage
    const studentDataStr = localStorage.getItem("studentData")
    
    if (studentDataStr) {
      const student = JSON.parse(studentDataStr)
      setStudentData(student)
      fetchScheduledExams(student.studentId)
    } else {
      router.push("/")
      return
    }
  }, [router])

  const fetchScheduledExams = async (studentId: number) => {
    try {
      const data = await api.getStudentScheduledExams(studentId)
      setScheduledExams(data)
      initializeTimers(data.scheduled_exams)
    } catch (error) {
      console.error('Failed to fetch scheduled exams:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeTimers = (exams: ScheduledExam[]) => {
    const timers: Record<number, {
      timeLeft: number
      canStart: boolean
      hasEnded: boolean
      isActive: boolean
    }> = {}

    exams.forEach(exam => {
      const now = new Date().getTime()
      const startTime = new Date(exam.schedule_details.start_time).getTime()
      const endTime = new Date(exam.schedule_details.end_time).getTime()
      
      const hasEnded = now >= endTime
      const isActive = now >= startTime && now < endTime
      const canStart = isActive && exam.schedule_details.is_active
      const timeLeft = Math.max(0, Math.floor((startTime - now) / 1000))

      timers[exam.exam_id] = {
        timeLeft,
        canStart,
        hasEnded,
        isActive
      }
    })

    setExamTimers(timers)
  }

  useEffect(() => {
    if (!scheduledExams) return

    const updateTimers = () => {
      const updatedTimers = { ...examTimers }
      let hasChanges = false

      scheduledExams.scheduled_exams.forEach(exam => {
        const now = new Date().getTime()
        const startTime = new Date(exam.schedule_details.start_time).getTime()
        const endTime = new Date(exam.schedule_details.end_time).getTime()
        
        const hasEnded = now >= endTime
        const isActive = now >= startTime && now < endTime
        const canStart = isActive && exam.schedule_details.is_active
        const timeLeft = Math.max(0, Math.floor((startTime - now) / 1000))

        const currentTimer = updatedTimers[exam.exam_id]
        if (currentTimer && (
          currentTimer.timeLeft !== timeLeft ||
          currentTimer.canStart !== canStart ||
          currentTimer.hasEnded !== hasEnded ||
          currentTimer.isActive !== isActive
        )) {
          updatedTimers[exam.exam_id] = {
            timeLeft,
            canStart,
            hasEnded,
            isActive
          }
          hasChanges = true
        }
      })

      if (hasChanges) {
        setExamTimers(updatedTimers)
      }
    }

    const timer = setInterval(updateTimers, 1000)
    return () => clearInterval(timer)
  }, [scheduledExams, examTimers])

  const handleStartExam = (examId: number) => {
    // Store the selected exam ID for the exam interface
    localStorage.setItem("selectedExamId", examId.toString())
    router.push("/exam")
  }

  const handleCheckResults = async (examId: number) => {
    if (!studentData) return
    
    try {
      // Check if results are available
      await api.getExamResult(examId, studentData.studentId)
      
      // Store exam results info and navigate
      localStorage.setItem(
        "examResults",
        JSON.stringify({
          examId: examId,
          submittedAt: new Date().toISOString()
        })
      )
      
      router.push("/results")
    } catch (error: any) {
      console.error('Failed to fetch results:', error)
      
      // Show a user-friendly alert for the specific error
      if (error.message.includes('Results are not published yet')) {
        alert('Results are not published yet. Please check back later.')
      } else if (error.message.includes('No results found')) {
        alert('No results found for this exam. Please contact the administration.')
      } else {
        alert('Failed to check results. Please try again later.')
      }
    }
  }

  const refreshSchedule = async () => {
    if (!studentData) return
    
    setRefreshing(true)
    try {
      const data = await api.getStudentScheduledExams(studentData.studentId)
      setScheduledExams(data)
      initializeTimers(data.scheduled_exams)
    } catch (error) {
      console.error('Failed to refresh schedule:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("studentData")
    localStorage.removeItem("selectedExamId")
    router.push("/")
  }

  const getExamStatusBadge = (exam: ScheduledExam) => {
    const timer = examTimers[exam.exam_id]
    if (!timer) return <Badge variant="outline">Loading...</Badge>

    if (timer.hasEnded) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Ended</Badge>
    }
    
    if (timer.canStart) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Active - Can Start</Badge>
    }
    
    if (timer.isActive && !exam.schedule_details.is_active) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Inactive</Badge>
    }
    
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Scheduled</Badge>
  }

  if (loading || !studentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto">
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
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent mb-4">
              Student Dashboard - Scheduled Exams
            </h2>
          </div>
          <div className="flex items-start gap-2">
            <Button
              onClick={() => router.push("/pre-exam")}
              variant="outline"
              size="sm"
              className="border-[#2E3094] text-[#2E3094] hover:bg-[#2E3094] hover:text-white"
            >
              Legacy View
            </Button>
            <button
              onClick={refreshSchedule}
              disabled={refreshing}
              className="p-2 rounded-full text-[#2E3094] hover:bg-gradient-to-r hover:from-[#2E3094] hover:to-[#4C51BF] hover:text-white transition-all duration-200 disabled:opacity-50"
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
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200"
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
              <span className="text-gray-600">{scheduledExams?.student_info?.f_id || studentData.fId}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Username:</span>
              <span className="text-gray-600">{scheduledExams?.student_info?.username || studentData.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Full Name:</span>
              <span className="text-gray-600">{studentData.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Department:</span>
              <span className="text-gray-600">{scheduledExams?.student_info?.department_shortname || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Total Assigned Exams:</span>
              <span className="text-gray-600">{scheduledExams?.total_assigned_exams || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Exams */}
        <div className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Scheduled Exams</h3>
              <Badge variant="outline" className="border-[#2E3094] text-[#2E3094]">
                {scheduledExams?.scheduled_exams?.length || 0} exam(s)
              </Badge>
            </div>
          </div>

          {!scheduledExams?.scheduled_exams?.length ? (
            <div className="flex justify-center">
              <Card className="border-gray-200 bg-white max-w-md w-full">
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600 text-lg">No scheduled exams found</p>
                  <p className="text-gray-500 text-sm mt-2">Check back later or contact your administrator</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 max-w-6xl">
              {scheduledExams.scheduled_exams.map((exam) => {
                const timer = examTimers[exam.exam_id]
                return (
                  <Card key={exam.assignment_id} className="border-gray-200 bg-white hover:shadow-lg transition-shadow duration-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg text-gray-900">
                            {exam.exam_details.department}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{exam.exam_details.semester}</p>
                        </div>
                        {getExamStatusBadge(exam)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Exam Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Exam ID:</span>
                          <span className="font-medium text-gray-900">{exam.exam_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Questions:</span>
                          <span className="font-medium text-gray-900">{exam.exam_details.total_questions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Marks:</span>
                          <span className="font-medium text-gray-900">{exam.exam_details.total_marks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium text-gray-900">{exam.exam_details.duration_minutes} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Language:</span>
                          <span className="font-medium text-gray-900">{exam.exam_details.language}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Faculty:</span>
                          <span className="font-medium text-gray-900">{exam.exam_details.faculty}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Teacher:</span>
                          <span className="font-medium text-gray-900">{exam.teacher_info.teacher_name}</span>
                        </div>
                      </div>

                      {/* Schedule Information */}
                      <div className="border-t pt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Time:</span>
                          <span className="font-medium text-gray-900">
                            {timeUtils.formatDateTime(exam.schedule_details.start_time)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Time:</span>
                          <span className="font-medium text-gray-900">
                            {timeUtils.formatDateTime(exam.schedule_details.end_time)}
                          </span>
                        </div>
                      </div>

                      {/* Countdown Timer or Status */}
                      {timer && (
                        <div className="border-t pt-4">
                          {timer.hasEnded ? (
                            <div className="text-center">
                              <p className="text-red-600 font-semibold mb-2">Exam has ended</p>
                              <Button
                                onClick={() => handleCheckResults(exam.exam_id)}
                                size="sm"
                                className="mt-2 bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3]"
                              >
                                Check Results
                              </Button>
                            </div>
                          ) : timer.canStart ? (
                            <div className="text-center">
                              <p className="text-green-600 font-semibold mb-2">Exam is now available!</p>
                              <Button
                                onClick={() => handleStartExam(exam.exam_id)}
                                className="w-full bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3]"
                              >
                                Start Exam
                              </Button>
                            </div>
                          ) : timer.isActive && !exam.schedule_details.is_active ? (
                            <div className="text-center">
                              <p className="text-yellow-600 font-semibold">Exam is inactive</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-gray-600 text-sm mb-2">Starts in:</p>
                              <div className="text-2xl font-bold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent font-mono">
                                {timeUtils.formatTime(timer.timeLeft)}
                              </div>
                              <Button
                                disabled
                                className="w-full mt-2 opacity-50 cursor-not-allowed"
                              >
                                Wait for Start Time
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assignment Date */}
                      <div className="text-xs text-gray-500 border-t pt-2">
                        Assigned: {timeUtils.formatDateTime(exam.assigned_at)}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <Card className="mt-8 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">General Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-600">
              <li>• Make sure you have a stable internet connection before starting any exam</li>
              <li>• The "Start Exam" button will only become clickable when the exam time begins</li>
              <li>• You can monitor the countdown timer to know exactly when each exam starts</li>
              <li>• Once started, you must complete the exam within the specified duration</li>
              <li>• Read all questions carefully before answering</li>
              <li>• Make sure to submit your exam before the time runs out</li>
              <li>• Contact your teacher or administrator if you encounter any technical issues</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}