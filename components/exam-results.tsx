"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { api } from "@/lib/utils"

interface ExamResultData {
  student_id: number
  exam_id: number
  student_name: string
  exam_details: {
    department: string
    semester: string
    total_questions: number
  }
  results: {
    total_questions_attempted: number
    correct_answers: number
    wrong_answers: number
    score_percentage: number
    grade: string
  }
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

export default function ExamResults() {
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [results, setResults] = useState<ExamResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchResults = async () => {
      // Get student data from localStorage
      const studentDataStr = localStorage.getItem("studentData")
      const examResultsStr = localStorage.getItem("examResults")
      
      if (!studentDataStr || !examResultsStr) {
        router.push("/")
        return
      }

      const student = JSON.parse(studentDataStr)
      const submissionData = JSON.parse(examResultsStr)
      setStudentData(student)

      try {
        // Fetch exam results from API
        const resultData = await api.getExamResult(submissionData.examId, student.studentId)
        setResults(resultData)
      } catch (error) {
        console.error('Failed to fetch results:', error)
        setError("Failed to load exam results")
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [router])

  const handleLogout = () => {
    // Clear all data
    localStorage.removeItem("studentData")
    localStorage.removeItem("examResults")
    localStorage.removeItem("examSchedule")
    router.push("/")
  }

  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case "A+": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "A": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "B+": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "B": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "C+": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "C": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "D": return "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]"
      case "F": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getPassStatus = (score: number) => {
    return score >= 60 ? "PASSED" : "FAILED"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading results...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push("/pre-exam")} className="w-full mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!studentData || !results) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">No results available</div>
      </div>
    )
  }

  const gradeColor = getGradeColor(results.results.grade)
  const passStatus = getPassStatus(results.results.score_percentage)

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Daffodil International University</h1>
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent mb-4">Admission Test Results</h2>
          </div>
          <div className="flex items-start">
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200 mt-4"
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
        <Card className="mb-6 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Student Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Student ID:</span>
              <span className="text-gray-600">{results.student_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Name:</span>
              <span className="text-gray-600">{results.student_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Department:</span>
              <span className="text-gray-600">{results.exam_details.department}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-900">Semester:</span>
              <span className="text-gray-600">{results.exam_details.semester}</span>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <Card className="mb-6 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center justify-between">
              <span>Exam Results</span>
              <Badge
                className={`${passStatus === "PASSED" ? "bg-gradient-to-r from-[#2E3094] to-[#4C51BF]" : "bg-red-500"} text-white`}
                variant="secondary"
              >
                {passStatus}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-3xl font-bold bg-gradient-to-r from-[#2E3094] to-[#4C51BF] bg-clip-text text-transparent">{results.results.score_percentage}%</div>
                <div className="text-sm text-gray-600">Overall Score</div>
              </div>
              <div className="space-y-2">
                <div className={`text-3xl font-bold text-white px-3 py-1 rounded ${gradeColor}`}>
                  {results.results.grade}
                </div>
                <div className="text-sm text-gray-600">Grade</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-500 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4905 2.02168 11.3363C2.16356 9.18203 2.99721 7.13214 4.39828 5.49C5.79935 3.84785 7.69279 2.71571 9.79619 2.24805C11.8996 1.78038 14.1003 1.99806 16.07 2.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {results.results.correct_answers}
                </div>
                <div className="text-sm text-gray-600">Correct Answers</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-red-500 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M15 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {results.results.wrong_answers}
                </div>
                <div className="text-sm text-gray-600">Wrong Answers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Statistics */}
        <Card className="mb-6 border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Exam Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">Total Questions:</span>
                  <Badge variant="outline" className="min-w-[60px]">
                    {results.exam_details.total_questions}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">Questions Attempted:</span>
                  <Badge variant="outline" className="min-w-[60px]">
                    {results.results.total_questions_attempted}
                  </Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-gray-900">Correct Answers:</span>
                  <Badge className="bg-green-500 text-white min-w-[60px]">
                    {results.results.correct_answers}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-gray-900">Wrong Answers:</span>
                  <Badge className="bg-red-500 text-white min-w-[60px]">
                    {results.results.wrong_answers}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Results are provisional and subject to verification by the university.</p>
          <p className="mt-2">For any queries, please contact the admissions office.</p>
        </div>
      </div>
    </div>
  )
}
