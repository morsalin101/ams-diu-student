'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { api, timeUtils } from '@/lib/utils';

interface Question {
  question_id: number;
  question_text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  question_type: 'option' | 'text';
  marks: number;
  subject: string;
}

interface ExamData {
  exam_id: number;
  exam_details: {
    department: string;
    semester: string;
    total_questions: number;
    duration_minutes: number;
  };
  questions: Question[];
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

export default function ExamInterface() {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [currentSubject, setCurrentSubject] = useState<string>('All');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const initializeExam = async () => {
      // Get student data from localStorage
      const studentDataStr = localStorage.getItem('studentData');
      if (!studentDataStr) {
        router.push('/');
        return;
      }

      const student = JSON.parse(studentDataStr);
      setStudentData(student);

      // Get selected exam ID from dashboard
      const selectedExamIdStr = localStorage.getItem('selectedExamId');
      if (!selectedExamIdStr) {
        // Fallback to old method for backward compatibility
        const scheduleDataStr = localStorage.getItem('examSchedule');
        if (scheduleDataStr) {
          const scheduleData = JSON.parse(scheduleDataStr);
          const activeExam = scheduleData.results?.find(
            (exam: any) => exam.is_active
          );
          if (activeExam) {
            try {
              const examQuestions = await api.getExamQuestions(activeExam.exam);
              setExamData(examQuestions);
              const endTime = new Date(activeExam.end_time).getTime();
              const now = new Date().getTime();
              const timeLeftSeconds = Math.max(
                0,
                Math.floor((endTime - now) / 1000)
              );
              setTimeLeft(timeLeftSeconds);
              const uniqueSubjects = [
                ...new Set(examQuestions.questions.map((q: any) => q.subject)),
              ] as string[];
              setSubjects(uniqueSubjects);
              setCurrentSubject('All');
              setLoading(false);
              return;
            } catch (error) {
              console.error('Failed to fetch exam questions:', error);
              setError('Failed to load exam questions');
            }
          }
        }
        setError('No exam selected. Please go back to the dashboard.');
        setLoading(false);
        return;
      }

      const selectedExamId = parseInt(selectedExamIdStr);

      try {
        // Fetch exam questions for the selected exam
        const examQuestions = await api.getExamQuestions(selectedExamId);
        setExamData(examQuestions);

        // For now, set a default duration if not provided in the API response
        // You might want to get this from the student scheduled exams API
        const defaultDurationMinutes =
          examQuestions.exam_details?.duration_minutes || 120;
        const timeLeftSeconds = defaultDurationMinutes * 60;
        setTimeLeft(timeLeftSeconds);

        // Group questions by subject
        const uniqueSubjects = [
          ...new Set(examQuestions.questions.map((q: Question) => q.subject)),
        ] as string[];
        setSubjects(uniqueSubjects);
        setCurrentSubject('All');
      } catch (error) {
        console.error('Failed to fetch exam data:', error);
        setError('Failed to load exam questions');
      } finally {
        setLoading(false);
      }
    };

    initializeExam();
  }, [router]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && examData) {
      // Auto-submit when time is up
      handleSubmitExam();
    }
  }, [timeLeft, examData]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleLogout = () => {
    localStorage.removeItem('studentData');
    localStorage.removeItem('examSchedule');
    localStorage.removeItem('selectedExamId');
    router.push('/');
  };

  const handleSubmitExam = async () => {
    if (!examData || !studentData) return;

    setSubmitting(true);

    try {
      // Prepare submissions array
      const submissions = Object.entries(answers).map(
        ([questionId, answer]) => ({
          question_id: parseInt(questionId),
          answer: answer,
        })
      );

      // Submit exam
      const result = await api.submitExam(
        examData.exam_id,
        studentData.studentId,
        submissions
      );

      // Store results
      localStorage.setItem(
        'examResults',
        JSON.stringify({
          examId: examData.exam_id,
          totalSubmitted: result.total_submitted,
          message: result.message,
          answers: answers,
          submittedAt: new Date().toISOString(),
        })
      );

      router.push('/results');
    } catch (error) {
      console.error('Failed to submit exam:', error);
      setError('Failed to submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getAnsweredCount = (subject: string) => {
    if (!examData) return 0;
    const subjectQuestions = examData.questions.filter(
      q => q.subject === subject
    );
    return subjectQuestions.filter(q => answers[q.question_id]).length;
  };

  const getTotalQuestions = (subject: string) => {
    if (!examData) return 0;
    return examData.questions.filter(q => q.subject === subject).length;
  };

  const getCurrentSubjectQuestions = () => {
    if (!examData) return [];
    if (currentSubject === 'All') return examData.questions;
    return examData.questions.filter(q => q.subject === currentSubject);
  };

  const getTotalAnsweredCount = () => {
    if (!examData) return 0;
    return examData.questions.filter(q => answers[q.question_id]).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading exam...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push('/pre-exam')}
              className="w-full mt-4"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!studentData || !examData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">No exam data available</div>
      </div>
    );
  }

  const currentSubjectQuestions = getCurrentSubjectQuestions();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-3 md:p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Mobile Header */}
          <div className="flex flex-col gap-3 md:hidden">
            {/* Top Row: Logo and Logout */}
            <div className="flex items-center justify-between">
              <Image
                src="/assets/img/diu-logo2.png"
                alt="Daffodil International University"
                width={80}
                height={80}
                className="h-10 w-auto"
              />
              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200"
                title="Logout"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17L21 12L16 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            {/* University & Exam Info */}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                Daffodil International University
              </p>
              <p className="text-xs text-gray-600">
                Faculty of Science & Information Technology
              </p>
              <p className="text-xs text-gray-600">
                {examData.exam_details.semester}
              </p>
            </div>

            {/* Student Info & Timer */}
            <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
              <div className="space-y-3 text-left">
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-gray-900">
                    Student&apos;s Name:{' '}
                    <span className="font-normal text-gray-700">
                      {studentData?.fullName || 'N/A'}
                    </span>
                  </p>

                  <p className="text-sm font-semibold text-gray-900">
                    Serial No:{' '}
                    <span className="font-normal text-gray-700">
                      {studentData?.fId || 'N/A'}
                    </span>
                  </p>

                  <p className="text-sm font-semibold text-gray-900">
                    Department:{' '}
                    <span className="font-normal text-gray-700">
                      {examData?.exam_details?.department || 'N/A'}
                    </span>
                  </p>
                </div>

                <div className="flex flex-col items-center rounded-xl border border-[#2E3094] bg-[#2E3094]/5 p-2 text-center">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#2E3094]/50 bg-white">
                    <svg
                      className="h-5 w-5 text-[#2E3094]"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 8v4l2.5 1.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#2E3094]/80">
                    Time Left
                  </p>
                  <div className="mt-1 text-xl font-semibold text-[#2E3094] font-mono">
                    {timeUtils.formatTime(timeLeft)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex justify-between items-center gap-8 py-2">
            {/* Left Side: Logo + University Info */}
            <div className="flex flex-col justify-between flex-1">
              <div className="flex items-center gap-4">
                <Image
                  src="/assets/img/diu-logo2.png"
                  alt="Daffodil International University"
                  width={100}
                  height={100}
                  className="h-20 w-auto flex-shrink-0"
                />
                <div className="space-y-0">
                  <h1 className="text-2xl font-bold text-black leading-tight mb-1">
                    Daffodil International University
                  </h1>
                  <p className="text-base font-semibold text-black leading-tight">
                    Faculty of Science and Information Technology
                  </p>
                  <p className="text-base font-semibold text-black leading-tight">
                    {examData.exam_details.semester}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Student Info + Timer + Logout */}
            <div className="flex items-center gap-6">
              <div className="space-y-1.5 text-left">
                <p className="text-base font-semibold text-black">
                  Student&apos;s Name:{' '}
                  <span className="font-normal">
                    {studentData?.fullName || 'Student'}
                  </span>
                </p>
                <p className="text-base font-semibold text-black">
                  Serial No:{' '}
                  <span className="font-normal">
                    {studentData?.fId || 'N/A'}
                  </span>
                </p>
                <p className="text-base font-semibold text-black">
                  Department:{' '}
                  <span className="font-normal">
                    {examData.exam_details.department}
                  </span>
                </p>
              </div>

              <div className="h-16 w-px bg-gray-300"></div>

              <div className="flex flex-col items-center rounded-xl border border-[#2E3094] bg-[#2E3094]/5 px-4 py-3 text-center shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#2E3094]/50 bg-white">
                  <svg
                    className="h-5 w-5 text-[#2E3094]"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8v4l2.5 1.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#2E3094]/80">
                  Time Left
                </p>
                <div className="mt-1 text-2xl font-semibold text-[#2E3094] font-mono">
                  {timeUtils.formatTime(timeLeft)}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200"
                title="Logout"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 17L21 12L16 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <div>
                <CardTitle className="text-gray-900 text-lg md:text-xl">
                  Total Questions: {examData.exam_details.total_questions}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Select a subject to filter questions or view all at once
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {/* All Questions Button */}

                <Button
                  variant={currentSubject === 'All' ? 'default' : 'outline'}
                  className={`flex items-center gap-2 ${
                    currentSubject === 'All'
                      ? 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white border-[#2E3094]'
                      : '!bg-zinc-100/50 text-gray-600 hover:border-gray-400  hover:text-gray-800 border-gray-300 shadow-sm'
                  }`}
                  onClick={() => setCurrentSubject('All')}
                >
                  <span>All Questions</span>
                  <Badge
                    variant="secondary"
                    className={
                      currentSubject === 'All'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }
                  >
                    {getTotalAnsweredCount()}/
                    {examData?.exam_details.total_questions || 0}
                  </Badge>
                </Button>

                {/* Subject Buttons */}
                {subjects.map(subject => (
                  <Button
                    key={subject}
                    variant={currentSubject === subject ? 'default' : 'outline'}
                    className={`flex items-center gap-2 ${
                      currentSubject === subject
                        ? 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white border-[#2E3094]'
                        : '!bg-zinc-100/50 text-gray-600 hover:border-gray-400  hover:text-gray-800 border-gray-300 shadow-sm'
                    }`}
                    onClick={() => setCurrentSubject(subject)}
                  >
                    <span>{subject}</span>
                    <Badge
                      variant="secondary"
                      className={
                        currentSubject === subject
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }
                    >
                      {getAnsweredCount(subject)}/{getTotalQuestions(subject)}
                    </Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Questions */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">
              {currentSubject === 'All' ? 'All Questions' : currentSubject}
              {currentSubject !== 'All' && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({currentSubjectQuestions.length} question
                  {currentSubjectQuestions.length !== 1 ? 's' : ''})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {currentSubjectQuestions.map((question, index) => {
              const globalIndex =
                examData?.questions.findIndex(
                  q => q.question_id === question.question_id
                ) ?? index;
              return (
                <div
                  key={question.question_id}
                  className="space-y-4 p-4 border border-gray-100 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <span className="inline-block w-8 h-8 bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white rounded-full text-center leading-8 text-sm font-bold flex-shrink-0">
                          {globalIndex + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-black">
                            {question.question_text}
                          </h3>
                          {currentSubject === 'All' && (
                            <Badge
                              variant="outline"
                              className="mt-2 border-blue-300 text-blue-700 bg-blue-50"
                            >
                              {question.subject}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="ml-4 border-[#2E3094] text-[#2E3094] flex-shrink-0"
                    >
                      {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                    </Badge>
                  </div>

                  {question.question_type === 'option' ? (
                    <div className="space-y-3">
                      {Object.entries(question.options).map(
                        ([optionKey, optionValue]) => {
                          const isSelected =
                            answers[question.question_id] === optionKey;
                          return (
                            <div
                              key={optionKey}
                              className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#2E3094]/10 hover:to-[#4C51BF]/10 ${
                                isSelected
                                  ? 'border-[#2E3094] bg-gradient-to-r from-[#2E3094]/20 to-[#4C51BF]/20 shadow-md'
                                  : 'border-gray-200 hover:border-[#2E3094]'
                              }`}
                              onClick={() =>
                                handleAnswerChange(
                                  question.question_id,
                                  optionKey
                                )
                              }
                            >
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                  isSelected
                                    ? 'border-[#2E3094] bg-gradient-to-r from-[#2E3094] to-[#4C51BF]'
                                    : 'border-gray-300 hover:border-[#2E3094]'
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <Label
                                className={`cursor-pointer flex-1 text-base ${
                                  isSelected
                                    ? 'text-blue-900 font-medium'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span className="font-semibold text-black mr-2">
                                  {optionKey}.
                                </span>
                                {optionValue}
                              </Label>
                            </div>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label
                        htmlFor={`desc-${question.question_id}`}
                        className="text-sm font-medium text-black"
                      >
                        Your Answer:
                      </Label>
                      <Textarea
                        id={`desc-${question.question_id}`}
                        placeholder="Write your answer here..."
                        value={answers[question.question_id] || ''}
                        onChange={e =>
                          handleAnswerChange(
                            question.question_id,
                            e.target.value
                          )
                        }
                        className="min-h-[120px] bg-white border-2 border-gray-300 text-black placeholder:text-gray-500 focus:border-[#2E3094] focus:ring-2 focus:ring-[#2E3094]/20"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Card className="border-gray-200 bg-white">
            <CardContent className="pt-6">
              {error && (
                <Alert className="border-red-200 bg-red-50 mb-4">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleSubmitExam}
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white px-12 py-3 text-lg disabled:opacity-50"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </div>
                ) : (
                  'Submit Exam'
                )}
              </Button>
              <p className="text-sm text-gray-600 mt-2">
                Answered: {Object.keys(answers).length} /{' '}
                {examData.exam_details.total_questions} questions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
