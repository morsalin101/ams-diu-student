'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { timeUtils, api } from '@/lib/utils';

interface StudentInfo {
  username: string;
  f_id: string;
  department_shortname: string;
}

interface ExamDetails {
  department: string;
  semester: string;
  total_questions: number;
  total_marks: number;
  duration_minutes: number;
  language: string;
  faculty: string;
}

interface ScheduleDetails {
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface TeacherInfo {
  teacher_id: number;
  teacher_name: string;
}

interface SubmissionStatus {
  number_of_submissions: number;
  total_questions: number;
  has_submitted: boolean;
  is_completed: boolean;
  completion_percentage: number;
}

interface ScheduledExam {
  assignment_id: number;
  schedule_id: number;
  exam_id: number;
  exam_details: ExamDetails;
  schedule_details: ScheduleDetails;
  teacher_info: TeacherInfo;
  submission_status: SubmissionStatus;
  assigned_at: string;
}

interface StudentScheduledExamsResponse {
  student_id: number;
  student_info: StudentInfo;
  scheduled_exams: ScheduledExam[];
  total_assigned_exams: number;
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

export default function StudentDashboard() {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [scheduledExams, setScheduledExams] =
    useState<StudentScheduledExamsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [examTimers, setExamTimers] = useState<
    Record<
      number,
      {
        timeLeft: number;
        canStart: boolean;
        hasEnded: boolean;
        isActive: boolean;
      }
    >
  >({});

  const router = useRouter();

  useEffect(() => {
    // Get student data from localStorage
    const studentDataStr = localStorage.getItem('studentData');

    if (studentDataStr) {
      const student = JSON.parse(studentDataStr);
      setStudentData(student);
      fetchScheduledExams(student.studentId);
    } else {
      router.push('/');
      return;
    }
  }, [router]);

  const fetchScheduledExams = async (studentId: number) => {
    try {
      const data = await api.getStudentScheduledExams(studentId);
      setScheduledExams(data);
      initializeTimers(data.scheduled_exams);
    } catch (error) {
      console.error('Failed to fetch scheduled exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeTimers = (exams: ScheduledExam[]) => {
    const timers: Record<
      number,
      {
        timeLeft: number;
        canStart: boolean;
        hasEnded: boolean;
        isActive: boolean;
      }
    > = {};

    exams.forEach(exam => {
      const now = new Date().getTime();
      const startTime = new Date(exam.schedule_details.start_time).getTime();
      const endTime = new Date(exam.schedule_details.end_time).getTime();

      const hasEnded = now >= endTime;
      const isActive = now >= startTime && now < endTime;
      const canStart = isActive && exam.schedule_details.is_active;
      const timeLeft = Math.max(0, Math.floor((startTime - now) / 1000));

      timers[exam.exam_id] = {
        timeLeft,
        canStart,
        hasEnded,
        isActive,
      };
    });

    setExamTimers(timers);
  };

  useEffect(() => {
    if (!scheduledExams) return;

    const updateTimers = () => {
      const updatedTimers = { ...examTimers };
      let hasChanges = false;

      scheduledExams.scheduled_exams.forEach(exam => {
        const now = new Date().getTime();
        const startTime = new Date(exam.schedule_details.start_time).getTime();
        const endTime = new Date(exam.schedule_details.end_time).getTime();

        const hasEnded = now >= endTime;
        const isActive = now >= startTime && now < endTime;
        const canStart = isActive && exam.schedule_details.is_active;
        const timeLeft = Math.max(0, Math.floor((startTime - now) / 1000));

        const currentTimer = updatedTimers[exam.exam_id];
        if (
          currentTimer &&
          (currentTimer.timeLeft !== timeLeft ||
            currentTimer.canStart !== canStart ||
            currentTimer.hasEnded !== hasEnded ||
            currentTimer.isActive !== isActive)
        ) {
          updatedTimers[exam.exam_id] = {
            timeLeft,
            canStart,
            hasEnded,
            isActive,
          };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setExamTimers(updatedTimers);
      }
    };

    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, [scheduledExams, examTimers]);

  const handleStartExam = (examId: number) => {
    // Store the selected exam ID for the exam interface
    localStorage.setItem('selectedExamId', examId.toString());
    router.push('/exam');
  };

  const handleCheckResults = async (examId: number) => {
    if (!studentData) return;

    try {
      // Check if results are available
      await api.getExamResult(examId, studentData.studentId);

      // Store exam results info and navigate
      localStorage.setItem(
        'examResults',
        JSON.stringify({
          examId: examId,
          submittedAt: new Date().toISOString(),
        })
      );

      router.push('/results');
    } catch (error: any) {
      console.error('Failed to fetch results:', error);

      // Show a user-friendly alert for the specific error
      if (error.message.includes('Results are not published yet')) {
        alert('Results are not published yet. Please check back later.');
      } else if (error.message.includes('No results found')) {
        alert(
          'No results found for this exam. Please contact the administration.'
        );
      } else {
        alert('Failed to check results. Please try again later.');
      }
    }
  };

  const refreshSchedule = async () => {
    if (!studentData) return;

    setRefreshing(true);
    try {
      const data = await api.getStudentScheduledExams(studentData.studentId);
      setScheduledExams(data);
      initializeTimers(data.scheduled_exams);
    } catch (error) {
      console.error('Failed to refresh schedule:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentData');
    localStorage.removeItem('selectedExamId');
    router.push('/');
  };

  const getExamStatusBadge = (exam: ScheduledExam) => {
    const timer = examTimers[exam.exam_id];
    if (!timer) return <Badge variant="outline">Loading...</Badge>;

    // Check if already submitted
    if (
      exam.submission_status &&
      exam.submission_status.number_of_submissions > 0
    ) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          Submitted
        </Badge>
      );
    }

    if (timer.hasEnded) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">Ended</Badge>
      );
    }

    if (timer.canStart) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Active - Can Start
        </Badge>
      );
    }

    if (timer.isActive && !exam.schedule_details.is_active) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          Inactive
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
        Scheduled
      </Badge>
    );
  };

  if (loading || !studentData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 md:px-12 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-8">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <Image
                src="/images/diu-logo.png"
                alt="Daffodil International University"
                width={200}
                height={60}
                className="h-20 w-auto"
              />
            </div>
            <div className="border-l-4 border-[#2E3094] pl-4">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Student Dashboard
              </h2>
              <p className="text-sm text-gray-600 font-medium">
                Scheduled Exams Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* <Button
              onClick={() => router.push('/pre-exam')}
              variant="outline"
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-blue-400 text-white border-none"
            >
              Legacy View
            </Button> */}

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

        {/* Student Information */}
        <Card className="mb-8 border-gray-200 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm ">
          <CardHeader className="pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2E3094] to-[#4C51BF] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Student Information
                </CardTitle>
              </div>
              {/* <Badge className="bg-blue-50 text-[#2E3094] border border-blue-200 px-3 py-1">
                {scheduledExams?.total_assigned_exams ?? 0} exam(s)
              </Badge> */}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ">
              <div className="bg-white rounded-lg p-4 border border-gray-200 ">
                <div className="text-xs font-medium text-gray-500 mb-1 ">
                  Student ID
                </div>
                <div className="text-base font-bold text-gray-900 font-mono">
                  {scheduledExams?.student_info?.f_id || studentData.fId}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Username
                </div>
                <div className="text-base font-bold text-gray-900">
                  {scheduledExams?.student_info?.username ||
                    studentData.username}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 ">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Full Name
                </div>
                <div className="text-base font-bold text-gray-900">
                  {studentData.fullName}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 ">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Department
                </div>
                <div className="text-base font-bold text-gray-900">
                  {scheduledExams?.student_info?.department_shortname || 'N/A'}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200 ">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Total Assigned Exams
                </div>
                <div className="text-base font-bold text-[#2E3094]">
                  {scheduledExams?.total_assigned_exams ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* =========== START: MODIFIED SCHEDULED EXAMS SECTION ============ */}
        {/* ================================================================== */}

        <div className="space-y-6 pt-5">
          {/* Section Header from Image */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/ScheduleIcon.png"
                alt="Schedule"
                width={32}
                height={32}
                className="w-6 h-6"
              />
              <h3 className="text-xl font-semibold text-gray-900">
                Your Scheduled Exams
              </h3>
            </div>
            <Badge className="bg-blue-50 text-[#2E3094] border border-blue-200 font-medium px-3 py-1.5 rounded-full tracking-wide">
              {scheduledExams?.total_assigned_exams ?? 0}{' '}
              {scheduledExams?.total_assigned_exams === 1 ? 'Exam' : 'Exams'}
            </Badge>
          </div>

          {/* Conditional Rendering: Empty State or Exam List */}
          {!scheduledExams?.scheduled_exams?.length ? (
            // NEW: Empty State UI from Image
            <Card className="border-gray-200 bg-white">
              <CardContent className="py-20 text-center">
                <div className="max-w-md mx-auto">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                    <svg
                      className="h-8 w-8 text-indigo-600"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="16" y1="2" y2="6"></line>
                      <line x1="8" y1="2" y2="6"></line>
                      <line x1="3" y1="10" y2="10"></line>
                    </svg>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-gray-800">
                    No scheduled exams found
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
                    Check back later or contact your administrator if you
                    believe this is an error.
                  </p>
                  <div className="mt-8 flex justify-center gap-3">
                    <Button
                      onClick={refreshSchedule}
                      disabled={refreshing}
                      className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white hover:opacity-90 flex items-center gap-2"
                    >
                      <svg
                        className={`h-4 w-4 ${
                          refreshing ? 'animate-spin' : ''
                        }`}
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold border-none py-2 px-4 rounded inline-flex items-center"
                      onClick={() =>
                        alert('Contact support functionality not implemented.')
                      }
                    >
                      Contact Support
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // EXISTING: Exam List Rendering
            <div className="grid gap-6 grid-cols-1">
              {scheduledExams.scheduled_exams.map(exam => {
                const timer = examTimers[exam.exam_id];
                return (
                  <Card
                    key={exam.assignment_id}
                    className="w-full border-gray-200 bg-white rounded-xl shadow-sm  transform  transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl font-bold text-gray-900">
                            {exam.exam_details.department}
                          </CardTitle>
                          <p className="text-sm text-gray-600">
                            {exam.exam_details.semester}
                          </p>
                        </div>
                        {getExamStatusBadge(exam)}
                      </div>
                    </CardHeader>
                    <CardContent className="w-full">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left: Exam details (50% width on md+) */}
                        <div className="text-sm">
                          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-md h-full">
                            <dl className="divide-y divide-gray-100">
                              {/* Exam ID */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Exam ID
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_id}
                                </dd>
                              </div>

                              {/* Questions */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Questions
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_details.total_questions}
                                </dd>
                              </div>

                              {/* Total Marks */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Total Marks
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_details.total_marks}
                                </dd>
                              </div>
                              {/* Duration */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Duration
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_details.duration_minutes} min
                                </dd>
                              </div>

                              {/* Language */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Language
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_details.language}
                                </dd>
                              </div>

                              {/* Faculty */}
                              <div className="flex justify-between items-center px-4 py-3">
                                <dt className="text-gray-700 font-semibold text-sm">
                                  Faculty
                                </dt>
                                <dd className="text-gray-900 font-bold text-sm">
                                  {exam.exam_details.faculty}
                                </dd>
                              </div>

                              {/* Teacher */}
                              <div className="flex justify-between items-center px-4 py-3 bg-blue-50">
                                <dt className="text-blue-900 font-bold text-sm">
                                  Teacher
                                </dt>
                                <dd className="text-blue-900 font-bold text-sm">
                                  {exam.teacher_info.teacher_name}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {/* Submission status (below details) */}
                          {exam.submission_status &&
                            exam.submission_status.number_of_submissions >
                              0 && (
                              <div className="mt-3">
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                  <p className="text-blue-800 font-semibold text-sm flex items-center">
                                    <svg
                                      className="w-4 h-4 mr-2"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    Already Submitted
                                  </p>
                                </div>
                              </div>
                            )}
                          {/* 
                          <div className="text-xs text-gray-500 mt-3">
                            Assigned:{' '}
                            {timeUtils.formatDateTime(exam.assigned_at)}
                          </div> */}
                        </div>

                        {/* Right: Schedule and actions (50% width on md+) */}
                        <div className="text-sm">
                          <div className="space-y-4 h-full flex flex-col p-4">
                            {/* Time Cards in 2 columns */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* Start Time Card */}
                              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-blue-100">
                                <div className="bg-gradient-to-br from-[#2E3094] to-[#4C51BF] flex items-center justify-center gap-2 py-3 px-3">
                                  <svg
                                    className="w-5 h-5 text-white"
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
                                  <div className="text-sm font-bold text-white tracking-wide">
                                    Start Time
                                  </div>
                                </div>
                                <div className="bg-gradient-to-br from-gray-50 to-blue-50 py-4 px-3">
                                  {(() => {
                                    const date = new Date(
                                      exam.schedule_details.start_time
                                    );
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
                                    const minutes = date
                                      .getMinutes()
                                      .toString()
                                      .padStart(2, '0');
                                    const ampm = hours >= 12 ? 'PM' : 'AM';
                                    hours = hours % 12 || 12;
                                    const hoursStr = hours
                                      .toString()
                                      .padStart(2, '0');
                                    return (
                                      <div className="text-center space-y-1">
                                        <div className="text-sm font-bold text-gray-600">
                                          {day} {month} {year}
                                        </div>
                                        <div className="text-base font-extrabold text-gray-800">
                                          {hoursStr}:{minutes} {ampm}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* End Time Card */}
                              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-blue-100">
                                <div className="bg-gradient-to-br from-[#2E3094] to-[#4C51BF]  flex items-center justify-center gap-2 py-3 px-3">
                                  <svg
                                    className="w-5 h-5 text-white"
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
                                  <div className="text-sm font-bold text-white tracking-wide">
                                    End Time
                                  </div>
                                </div>
                                <div className="bg-gradient-to-br from-gray-50 to-blue-50 py-4 px-3">
                                  {(() => {
                                    const date = new Date(
                                      exam.schedule_details.end_time
                                    );
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
                                    const minutes = date
                                      .getMinutes()
                                      .toString()
                                      .padStart(2, '0');
                                    const ampm = hours >= 12 ? 'PM' : 'AM';
                                    hours = hours % 12 || 12;
                                    const hoursStr = hours
                                      .toString()
                                      .padStart(2, '0');
                                    return (
                                      <div className="text-center space-y-1">
                                        <div className="text-sm font-bold text-gray-600">
                                          {day} {month} {year}
                                        </div>
                                        <div className="text-base font-extrabold text-gray-800">
                                          {hoursStr}:{minutes} {ampm}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Countdown / actions */}
                            <div className="flex-1 flex items-center justify-center px-2">
                              {timer ? (
                                timer.hasEnded ? (
                                  <div className="text-center w-full">
                                    <div className="bg-red-50 rounded-xl p-4 mb-3 border border-red-200">
                                      <p className="text-red-700 font-bold text-sm">
                                        Exam has ended
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() =>
                                        handleCheckResults(exam.exam_id)
                                      }
                                      className="w-full py-3 rounded-xl text-sm font-bold bg-[#2E3094] text-white shadow-lg hover:bg-[#2C2F8F]"
                                    >
                                      Check Results
                                    </Button>
                                  </div>
                                ) : timer.canStart ? (
                                  <div className="text-center w-full">
                                    {exam.submission_status &&
                                    exam.submission_status
                                      .number_of_submissions > 0 ? (
                                      <div className="space-y-3">
                                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                                          <p className="text-blue-700 font-semibold text-sm">
                                            Already Submitted
                                          </p>
                                        </div>
                                        <Button
                                          onClick={() =>
                                            handleCheckResults(exam.exam_id)
                                          }
                                          className="w-full py-3 rounded-xl text-sm font-bold bg-[#2E3094] text-white shadow-lg"
                                        >
                                          View Submission
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        onClick={() =>
                                          handleStartExam(exam.exam_id)
                                        }
                                        className="w-full py-5 rounded-2xl text-lg font-extrabold bg-gradient-to-r from-blue-600 to-blue-500 shadow-xl text-white flex items-center justify-center gap-2"
                                      >
                                        <svg
                                          className="w-6 h-6"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                        Start Exam
                                      </Button>
                                    )}
                                  </div>
                                ) : timer.isActive &&
                                  !exam.schedule_details.is_active ? (
                                  <div className="text-center w-full">
                                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                                      <p className="text-yellow-700 font-bold text-sm">
                                        Exam is inactive
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center w-full">
                                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 mb-3 border border-indigo-200">
                                      <p className="text-gray-600 text-xs font-semibold mb-2">
                                        Starts in
                                      </p>
                                      <div className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-mono">
                                        {timeUtils.formatTime(timer.timeLeft)}
                                      </div>
                                    </div>
                                    <Button
                                      disabled
                                      className="w-full py-3 rounded-xl text-sm font-bold bg-gray-400 cursor-not-allowed opacity-60 text-white"
                                    >
                                      Wait for Start Time
                                    </Button>
                                  </div>
                                )
                              ) : (
                                <div className="text-center w-full">
                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <p className="text-gray-500 text-sm font-medium">
                                      Timer unavailable
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* ============= END: MODIFIED SCHEDULED EXAMS SECTION ============ */}
        {/* ================================================================== */}
      </div>
    </div>
  );
}
