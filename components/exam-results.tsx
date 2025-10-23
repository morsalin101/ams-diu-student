'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/utils';

interface ExamResultData {
  student_id: number;
  exam_id: number;
  student_name: string;
  exam_details: {
    department: string;
    semester: string;
    total_questions: number;
  };
  results: {
    total_questions_attempted: number;
    correct_answers: number;
    wrong_answers: number;
    score_percentage: number;
    grade: string;
  };
}

interface StudentData {
  studentId: number;
  username: string;
  fId: string;
  fullName: string;
  email: string;
  createdAt: string;
  message: string;
}

export default function ExamResults() {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [results, setResults] = useState<ExamResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchResults = async () => {
      // Get student data from localStorage
      const studentDataStr = localStorage.getItem('studentData');
      const examResultsStr = localStorage.getItem('examResults');

      if (!studentDataStr || !examResultsStr) {
        router.push('/');
        return;
      }

      const student = JSON.parse(studentDataStr);
      const submissionData = JSON.parse(examResultsStr);
      setStudentData(student);

      try {
        // Fetch exam results from API
        const resultData = await api.getExamResult(
          submissionData.examId,
          student.studentId
        );
        setResults(resultData);
      } catch (error: any) {
        console.error('Failed to fetch results:', error);

        // Handle specific error messages from backend
        if (error.message.includes('Results are not published yet')) {
          setError('Results are not published yet. Please check back later.');
        } else if (error.message.includes('No results found')) {
          setError(
            'No results found for this exam. Please contact the administration.'
          );
        } else {
          setError('Failed to load exam results. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [router]);

  const handleLogout = () => {
    // Clear all data
    localStorage.removeItem('studentData');
    localStorage.removeItem('examResults');
    localStorage.removeItem('examSchedule');
    router.push('/');
  };

  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case 'A+':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'A':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'B+':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'B':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'C+':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'C':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'D':
        return 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF]';
      case 'F':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPassStatus = (score: number) => {
    return score >= 60 ? 'PASSED' : 'FAILED';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading results...</div>
      </div>
    );
  }

  if (error) {
    const isResultsNotPublished = error.includes(
      'Results are not published yet'
    );

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          {/* Simple Header */}
          <div className="bg-white border-b-2 border-gray-200 mb-6 p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Daffodil International University
            </h1>
            <p className="text-sm text-gray-600">Admission Test Results</p>
          </div>

          {isResultsNotPublished ? (
            <div className="space-y-4">
              {/* Success Message */}
              <div className="bg-white border-l-4 border-green-500 p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Exam Submitted Successfully
                    </h3>
                    <p className="text-sm text-gray-600">
                      Your responses have been saved
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Notice */}
              <div className="bg-white border border-gray-200 p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Results Not Published Yet
                </h2>
                <p className="text-gray-600 mb-6">
                  Results will be available once published by the administration
                </p>

                {/* What's Next */}
                <div className="bg-gray-50 border border-gray-200 p-4 text-left max-w-lg mx-auto">
                  <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                    What happens next?
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Your responses are securely recorded</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-600">•</span>
                      <span>Administration is reviewing submissions</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-purple-600">•</span>
                      <span>Results will be published soon</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-orange-600">•</span>
                      <span>Check back here to view your results</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => router.push('/dashboard')}
                  className="bg-[#2E3094] hover:bg-[#252865] text-white"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="border-gray-300 hover:bg-gray-50"
                >
                  Refresh
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white border-l-4 border-red-500 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Error</h3>
                  <p className="text-sm text-gray-600">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!studentData || !results) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-600">No results available</div>
      </div>
    );
  }

  const gradeColor = getGradeColor(results.results.grade);
  const passStatus = getPassStatus(results.results.score_percentage);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border-b-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Daffodil International University
              </h1>
              <p className="text-sm text-gray-600">Admission Test Results</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-white border-2 border-gray-200 hover:bg-blue-900/10 transition-all duration-300 shadow-sm hover:shadow-md group"
              title="Logout"
              aria-label="Logout"
            >
              <Image
                src="/logoutIcon.png"
                alt="Logout"
                width={20}
                height={20}
                className="w-5 h-5 group-hover:scale-110 transition-transform duration-200"
              />
              <span className="text-gray-700 group-hover:text-blue-900 font-semibold text-sm transition-colors duration-200">
                Logout
              </span>
            </button>
          </div>
        </div>

        {/* Pass/Fail Status */}
        <div
          className={`rounded-lg shadow-md p-6 ${
            passStatus === 'PASSED'
              ? 'bg-green-50 border-l-4 border-green-500'
              : 'bg-red-50 border-l-4 border-red-500'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                passStatus === 'PASSED' ? 'bg-green-500' : 'bg-red-500'
              }`}
            >
              {passStatus === 'PASSED' ? (
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h2
                className={`text-2xl font-bold mb-1 ${
                  passStatus === 'PASSED' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {passStatus === 'PASSED'
                  ? 'Congratulations! You Passed'
                  : 'Not Passed'}
              </h2>
              <p
                className={`text-sm ${
                  passStatus === 'PASSED' ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {passStatus === 'PASSED'
                  ? 'You have successfully completed the admission test.'
                  : 'Review your performance and prepare for the next opportunity.'}
              </p>
            </div>
          </div>
        </div>

        {/* Score Overview
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:scale-105">
            
            <div className="text-xs text-gray-600 uppercase tracking-wide">Score</div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:scale-105">
            <div
              className={`text-3xl font-bold text-white px-3 py-2 rounded-lg inline-block ${gradeColor} mb-2 shadow-sm`}
            >
              {results.results.grade}
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Grade</div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:scale-105">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {results.results.correct_answers}
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Correct</div>
          </div>
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:scale-105">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {results.results.wrong_answers}
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wide">Wrong</div>
          </div>
        </div> */}

        {/* Student Information */}
        {/* <div className="bg-white border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Student Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Student ID:</span>
              <span className="text-sm font-medium text-gray-900">
                {results.student_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Name:</span>
              <span className="text-sm font-medium text-gray-900">
                {results.student_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Department:</span>
              <span className="text-sm font-medium text-gray-900">
                {results.exam_details.department}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Semester:</span>
              <span className="text-sm font-medium text-gray-900">
                {results.exam_details.semester}
              </span>
            </div>
          </div>
        </div> */}

        {/* Exam Details */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Exam Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-2xl font-bold text-[#2E3094]">
                {results.results.score_percentage}%
              </div>
              <div className="text-xs text-gray-600 uppercase">Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {results.exam_details.total_questions}
              </div>
              <div className="text-xs text-gray-600 uppercase">
                Total Questions
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {results.results.total_questions_attempted}
              </div>
              <div className="text-xs text-gray-600 uppercase">Attempted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {results.results.correct_answers}
              </div>
              <div className="text-xs text-gray-600 uppercase">Correct</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {results.results.wrong_answers}
              </div>
              <div className="text-xs text-gray-600 uppercase">Wrong</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-[#2E3094] hover:bg-[#252865] text-white"
          >
            Go to Dashboard
          </Button>
          <Button
            onClick={() => router.push('/pre-exam')}
            variant="outline"
            className="border-0 !bg-green-800/90 text-white hover:!bg-green-800"
          >
            Pre-Exam
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pb-6">
          <p>
            Results are provisional. For queries, contact the admissions office.
          </p>
        </div>
      </div>
    </div>
  );
}
