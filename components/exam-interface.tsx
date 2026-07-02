'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CircularTimer } from '@/components/circular-timer';
import { ArrowUp, ListChecks, X } from 'lucide-react';
import Image from 'next/image';
import { api, serverNow } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Question {
  question_id: number;
  question_text: string;
  options: Record<string, string>;
  displayOptions?: DisplayOption[];
  question_type: 'option' | 'text';
  marks: number;
  subject: string;
}

interface DisplayOption {
  originalKey: string;
  displayKey: string;
  value: string;
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

const getSeedHash = (seedInput: string) => {
  let hash = 2166136261;

  for (let index = 0; index < seedInput.length; index++) {
    hash ^= seedInput.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const getSeededRandom = (seedInput: string) => {
  let seed = getSeedHash(seedInput);

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getSeededShuffle = <T,>(items: T[], seedInput: string) => {
  const shuffledItems = [...items];
  const random = getSeededRandom(seedInput);

  for (let index = shuffledItems.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
};

// Deadline = scheduled end, but never longer than the allotted duration.
const getExamWindow = (s: {
  start_time: string;
  end_time: string;
  duration_minutes: number;
}) => {
  const start = new Date(s.start_time).getTime();
  const end = new Date(s.end_time).getTime();
  const deadline = Math.min(start + s.duration_minutes * 60_000, end);
  return {
    deadline,
    totalSeconds: Math.max(1, Math.floor((deadline - start) / 1000)),
  };
};

const getExamDraftKey = (studentId: number, examId: number) =>
  `examDraft:${studentId}:${examId}`;

const getExamSubmittedKey = (studentId: number, examId: number) =>
  `examSubmitted:${studentId}:${examId}`;

const getSubmittedAnswers = (answers: Record<number, string>) =>
  Object.fromEntries(
    Object.entries(answers).filter(([, answer]) => answer.trim().length > 0)
  );

const getDisplayOptions = (
  question: Question,
  studentId: number,
  examId: number
): DisplayOption[] => {
  if (question.question_type !== 'option') {
    return [];
  }

  return getSeededShuffle(
    Object.entries(question.options || {}),
    `${studentId}:${examId}:question:${question.question_id}:options`
  ).map(([originalKey, value], index) => ({
    originalKey,
    displayKey: String.fromCharCode(65 + index),
    value: String(value),
  }));
};

const applyExamPresentationShuffle = (
  examQuestions: ExamData,
  studentId: number
): ExamData => {
  const questionsBySubject = new Map<string, Question[]>();
  const subjectOrder: string[] = [];

  examQuestions.questions.forEach(question => {
    if (!questionsBySubject.has(question.subject)) {
      questionsBySubject.set(question.subject, []);
      subjectOrder.push(question.subject);
    }

    questionsBySubject.get(question.subject)?.push(question);
  });

  const shuffledQuestions = subjectOrder.flatMap(subject => {
    const subjectQuestions = questionsBySubject.get(subject) || [];

    // "Question set" behavior: a base order shared by the whole exam, with
    // each student's FIRST question picked by studentId — so consecutive
    // student IDs are guaranteed to open on different questions instead of
    // colliding by chance. The remaining questions are then shuffled
    // per-student as before, so no two students share a sequence.
    const base = getSeededShuffle(
      subjectQuestions,
      `${examQuestions.exam_id}:subject:${subject}:base`
    );
    const startIndex =
      base.length > 0 ? Math.abs(Number(studentId) || 0) % base.length : 0;
    const first = base[startIndex];
    const rest = getSeededShuffle(
      base.filter((_, index) => index !== startIndex),
      `${studentId}:${examQuestions.exam_id}:subject:${subject}`
    );

    return (first ? [first, ...rest] : rest).map(question => ({
      ...question,
      displayOptions: getDisplayOptions(
        question,
        studentId,
        examQuestions.exam_id
      ),
    }));
  });

  return {
    ...examQuestions,
    questions: shuffledQuestions,
  };
};

export default function ExamInterface() {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [currentSubject, setCurrentSubject] = useState<string>('All');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  // Absolute exam end as epoch ms. Timer is derived from this so it stays
  // accurate across reloads/relogin and background-tab throttling.
  const [deadline, setDeadline] = useState(0);
  // Flips true when the clock hits the deadline; a dedicated effect then
  // auto-submits with the latest answers (avoids a stale-closure submit).
  const [timeUp, setTimeUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showTopButton, setShowTopButton] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null);
  // Callback-ref state so the measure effect runs when the header actually
  // mounts (it only exists after loading finishes, not when examData is set).
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const router = useRouter();

  // Per-question debounce timers for autosaving text answers.
  const textSaveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );

  // Restore answers already saved on the server so a student recovers their
  // work after a reload or a device that switched off mid-exam.
  const restoreDraftAnswers = async (examId: number, studentId: number) => {
    try {
      const data = await api.getDraftAnswers(examId, studentId);
      const saved = data?.answers;
      if (Array.isArray(saved) && saved.length > 0) {
        const restored: Record<number, string> = {};
        saved.forEach((item: { question_id: number; answer: string }) => {
          if (item && item.answer != null && String(item.answer).length > 0) {
            restored[item.question_id] = String(item.answer);
          }
        });
        if (Object.keys(restored).length > 0) {
          setAnswers(prev => ({ ...restored, ...prev }));
        }
      }
    } catch (err) {
      console.error('Failed to restore draft answers:', err);
    }
  };

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

      // Anchor the countdown to the server clock so it's identical on every
      // machine regardless of the local PC time. Best-effort: on failure we
      // fall back to the local clock (offset 0).
      await api.syncServerTime().catch(err => {
        console.error('Failed to sync server time:', err);
      });

      const loadExam = (examQuestions: ExamData) => {
        const presentedExamQuestions = applyExamPresentationShuffle(
          examQuestions,
          student.studentId
        );
        setExamData(presentedExamQuestions);

        const submittedKey = getExamSubmittedKey(
          student.studentId,
          presentedExamQuestions.exam_id
        );
        const isSubmitted = localStorage.getItem(submittedKey) === 'true';

        if (!isSubmitted) {
          const draftKey = getExamDraftKey(
            student.studentId,
            presentedExamQuestions.exam_id
          );
          const savedDraft = localStorage.getItem(draftKey);

          if (savedDraft) {
            try {
              const parsedDraft = JSON.parse(savedDraft);
              setAnswers(parsedDraft.answers || {});
            } catch (error) {
              console.error('Failed to restore exam draft:', error);
              localStorage.removeItem(draftKey);
            }
          }
        }

        return presentedExamQuestions;
      };

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
              const presentedExamQuestions = loadExam(examQuestions);
              const { deadline, totalSeconds } = getExamWindow({
                start_time: activeExam.start_time,
                end_time: activeExam.end_time,
                duration_minutes:
                  examQuestions.exam_details?.duration_minutes ?? 120,
              });
              setDeadline(deadline);
              setTotalTime(totalSeconds);
              setTimeLeft(Math.max(0, Math.round((deadline - serverNow()) / 1000)));
              await restoreDraftAnswers(
                presentedExamQuestions.exam_id,
                student.studentId
              );
              const uniqueSubjects = [
                ...new Set(
                  presentedExamQuestions.questions.map(
                    (q: Question) => q.subject
                  )
                ),
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
        const presentedExamQuestions = loadExam(examQuestions);

        const durationMinutes =
          examQuestions.exam_details?.duration_minutes || 120;

        // Anchor the timer to the scheduled window stashed by the dashboard so
        // it survives reloads/relogin. Fall back to duration-from-now only if
        // the schedule is missing.
        const scheduleStr = localStorage.getItem('selectedExamSchedule');
        let examDeadline: number;
        let totalSeconds: number;
        if (scheduleStr) {
          const schedule = JSON.parse(scheduleStr);
          ({ deadline: examDeadline, totalSeconds } = getExamWindow({
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_minutes: schedule.duration_minutes || durationMinutes,
          }));
        } else {
          // ponytail: no schedule → fall back to duration from now; this path
          // resets on reload and needs a backend start timestamp to fix
          // cross-device. Shouldn't happen once the dashboard stashes times.
          examDeadline = serverNow() + durationMinutes * 60_000;
          totalSeconds = durationMinutes * 60;
        }
        setDeadline(examDeadline);
        setTotalTime(totalSeconds);
        setTimeLeft(Math.max(0, Math.round((examDeadline - serverNow()) / 1000)));

        // Restore any answers already saved on the server (recovery).
        await restoreDraftAnswers(
          presentedExamQuestions.exam_id,
          student.studentId
        );

        // Group questions by subject
        const uniqueSubjects = [
          ...new Set(
            presentedExamQuestions.questions.map((q: Question) => q.subject)
          ),
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
    if (!deadline || !examData) return;

    const tick = () => {
      const left = Math.max(0, Math.round((deadline - serverNow()) / 1000));
      setTimeLeft(left);
      // Just flag time-up; the submit effect below handles it with fresh answers.
      if (left <= 0) setTimeUp(true);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, examData]);

  // Auto-submit the student's saved drafts when time runs out, even if they
  // never clicked Submit. Runs when `timeUp` flips, so it captures the latest
  // `answers` (not the stale snapshot the interval closure would hold).
  useEffect(() => {
    if (!timeUp || !examData || !studentData || submitting) return;
    const submittedKey = getExamSubmittedKey(
      studentData.studentId,
      examData.exam_id
    );
    if (localStorage.getItem(submittedKey) === 'true') return;

    // Nothing answered → the backend (correctly) 400s on an empty submit and the
    // student stays ABSENT. Don't loop on that — mark done locally and leave.
    if (Object.keys(getSubmittedAnswers(answers)).length === 0) {
      localStorage.setItem(submittedKey, 'true');
      localStorage.removeItem(
        getExamDraftKey(studentData.studentId, examData.exam_id)
      );
      router.push('/results');
      return;
    }

    handleSubmitExam();
  }, [timeUp, examData, studentData, submitting, answers]);

  // Show the back-to-top button once the student has scrolled down a bit.
  useEffect(() => {
    const onScroll = () => setShowTopButton(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Measure the (responsive) sticky header so the navigator sits just below it
  // and never overlaps. A ResizeObserver re-measures on any header size change
  // (font/logo load, browser zoom, viewport resize). Keyed to the mounted
  // element itself — keying on data states measured too early (header not in
  // the DOM yet) and left headerH at 0, hiding the navigator's top.
  useEffect(() => {
    if (!headerEl) return;
    const measure = () => setHeaderH(headerEl.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, [headerEl]);

  // Scroll to a question requested from the navigator. Depends on
  // currentSubject so that when jumpToQuestion had to switch back to "All",
  // the effect re-runs once the target question is actually in the DOM.
  useEffect(() => {
    if (pendingScrollId == null) return;
    const id = pendingScrollId;
    requestAnimationFrame(() => {
      document
        .getElementById(`q-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setPendingScrollId(null);
  }, [pendingScrollId, currentSubject]);

  const jumpToQuestion = (question: Question) => {
    if (currentSubject !== 'All' && currentSubject !== question.subject) {
      setCurrentSubject('All');
    }
    setPendingScrollId(question.question_id);
    setNavOpen(false);
  };

  const persistAnswer = async (questionId: number, answer: string) => {
    if (!examData || !studentData) return;

    setSaveStatus('saving');
    try {
      await api.saveAnswer(
        examData.exam_id,
        studentData.studentId,
        questionId,
        answer
      );
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to autosave answer:', err);
      // Keep the answer in state; final submit is the backstop and the next
      // change will retry the save.
      setSaveStatus('error');
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));

    // Immediately persist the answer to the server as a draft so the student
    // can rejoin (after a reload / dead device) and keep their submission.
    const question = examData?.questions.find(
      q => q.question_id === questionId
    );
    const isTextAnswer = question?.question_type === 'text';

    if (isTextAnswer) {
      // Debounce text answers so we don't fire a request per keystroke.
      if (textSaveTimers.current[questionId]) {
        clearTimeout(textSaveTimers.current[questionId]);
      }
      textSaveTimers.current[questionId] = setTimeout(() => {
        delete textSaveTimers.current[questionId];
        void persistAnswer(questionId, answer);
      }, 800);
    } else {
      // Option answers save immediately on click.
      void persistAnswer(questionId, answer);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentData');
    localStorage.removeItem('examSchedule');
    localStorage.removeItem('selectedExamId');
    localStorage.removeItem('selectedExamSchedule');
    router.push('/');
  };

  const handleSubmitClick = () => {
    if (Object.keys(getSubmittedAnswers(answers)).length === 0) {
      setError('Please answer at least one question before submitting.');
      return;
    }

    setError('');
    setShowSubmitConfirm(true);
  };

  const handleSubmitExam = async () => {
    if (!examData || !studentData) return;

    setShowSubmitConfirm(false);
    setSubmitting(true);

    const submittedAnswers = getSubmittedAnswers(answers);

    try {
      // Prepare submissions array
      const submissions = Object.entries(submittedAnswers).map(
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
          answers: submittedAnswers,
          submittedAt: new Date().toISOString(),
        })
      );
      localStorage.removeItem(
        getExamDraftKey(studentData.studentId, examData.exam_id)
      );
      localStorage.setItem(
        getExamSubmittedKey(studentData.studentId, examData.exam_id),
        'true'
      );

      router.push('/results');
    } catch (error) {
      console.error('Failed to submit exam:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to submit exam. Please try again.'
      );
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
  const questionNumberById: Record<number, number> = Object.fromEntries(
    examData.questions.map((q, i) => [q.question_id, i + 1])
  );

  const renderNavigator = () => (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-semibold text-gray-900">Questions</span>
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          className="lg:hidden text-gray-500 hover:text-gray-700"
          aria-label="Close navigator"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Subject filters double as buttons: pick "All" or a subject */}
      <button
        type="button"
        onClick={() => {
          setCurrentSubject('All');
          setNavOpen(false);
        }}
        className={`w-full mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
          currentSubject === 'All'
            ? 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white border-[#2E3094]'
            : 'bg-white text-gray-700 border-gray-300 hover:border-[#2E3094]'
        }`}
      >
        <span>All Questions</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            currentSubject === 'All'
              ? 'bg-white/20'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {getTotalAnsweredCount()}/{examData.exam_details.total_questions}
        </span>
      </button>

      <div className="space-y-3">
        {subjects.map(subject => (
          <div key={subject}>
            <button
              type="button"
              onClick={() => {
                setCurrentSubject(subject);
                setNavOpen(false);
              }}
              className={`w-full mb-1.5 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${
                currentSubject === subject
                  ? 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white border-[#2E3094]'
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-[#2E3094] hover:text-[#2E3094]'
              }`}
            >
              <span className="truncate">{subject}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  currentSubject === subject
                    ? 'bg-white/20'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {getAnsweredCount(subject)}/{getTotalQuestions(subject)}
              </span>
            </button>
            <div className="flex flex-wrap gap-1">
              {examData.questions
                .filter(q => q.subject === subject)
                .map(q => {
                  const answered = Boolean(answers[q.question_id]);
                  return (
                    <button
                      key={q.question_id}
                      type="button"
                      onClick={() => jumpToQuestion(q)}
                      title={`Question ${questionNumberById[q.question_id]}`}
                      className={`h-8 w-8 rounded text-xs font-semibold border transition-colors ${
                        answered
                          ? 'bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white border-[#2E3094]'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-[#2E3094] hover:text-[#2E3094]'
                      }`}
                    >
                      {questionNumberById[q.question_id]}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div
        ref={setHeaderEl}
        className="bg-white border-b border-gray-200 px-3 py-3 md:px-4 md:py-5 sticky top-0 z-20 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Logo + University Info */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Image
              src="/assets/img/diu-logo2.png"
              alt="Daffodil International University"
              width={100}
              height={100}
              className="h-9 w-auto flex-shrink-0 md:h-16"
            />
            <div className="min-w-0">
              <h1 className="text-sm md:text-2xl font-bold text-black leading-tight truncate">
                Daffodil International University
              </h1>
              <p className="text-[11px] md:text-base font-semibold text-gray-700 leading-tight truncate">
                Faculty of Science &amp; Information Technology
              </p>
              <p className="text-[11px] md:text-base font-semibold text-gray-700 leading-tight truncate">
                {examData.exam_details.semester}
              </p>
            </div>
          </div>

          {/* Right: Timer + Logout */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <CircularTimer timeLeft={timeLeft} totalTime={totalTime} size={100} />
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors duration-200"
              title="Logout"
              aria-label="Logout"
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

      <div className="max-w-7xl mx-auto lg:flex lg:items-start">
        {/* Left navigator — sticky inside the same centered band as the header */}
        <aside
          className="hidden lg:block sticky w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4"
          style={{ top: headerH, maxHeight: `calc(100vh - ${headerH}px)` }}
        >
          {renderNavigator()}
        </aside>

        {/* Main column */}
        <div className="min-w-0 lg:flex-1">
          <div className="max-w-5xl mx-auto p-3 md:p-4">
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
          <CardContent className="space-y-4 md:space-y-5">
            {currentSubjectQuestions.map((question, index) => {
              const globalIndex =
                examData?.questions.findIndex(
                  q => q.question_id === question.question_id
                ) ?? index;
              return (
                <div
                  key={question.question_id}
                  id={`q-${question.question_id}`}
                  className="space-y-3 p-3 border border-gray-100 rounded-lg scroll-mt-28"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 md:gap-3">
                        <span className="inline-block w-6 h-6 md:w-7 md:h-7 bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white rounded-full text-center leading-6 md:leading-7 text-xs md:text-sm font-bold flex-shrink-0">
                          {globalIndex + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm md:text-base font-semibold text-black break-words">
                            {question.question_text}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-blue-300 text-blue-700 bg-blue-50"
                      >
                        {question.subject}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-[#2E3094] text-[#2E3094]"
                      >
                        {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                      </Badge>
                    </div>
                  </div>

                  {question.question_type === 'option' ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:gap-2.5">
                      {(
                        question.displayOptions ||
                        getDisplayOptions(
                          question,
                          studentData.studentId,
                          examData.exam_id
                        )
                      ).map(option => {
                          const isSelected =
                            answers[question.question_id] ===
                            option.originalKey;
                          return (
                            <div
                              key={option.originalKey}
                              className={`flex items-center space-x-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-[#2E3094]/10 hover:to-[#4C51BF]/10 ${
                                isSelected
                                  ? 'border-[#2E3094] bg-gradient-to-r from-[#2E3094]/20 to-[#4C51BF]/20 shadow-md'
                                  : 'border-gray-200 hover:border-[#2E3094]'
                              }`}
                              onClick={() =>
                                // Clicking the selected option again deselects it.
                                handleAnswerChange(
                                  question.question_id,
                                  isSelected ? '' : option.originalKey
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
                                className={`cursor-pointer flex-1 text-sm md:text-base break-words ${
                                  isSelected
                                    ? 'text-blue-900 font-medium'
                                    : 'text-gray-700'
                                }`}
                              >
                                <span className="font-semibold text-black mr-2">
                                  {option.displayKey}.
                                </span>
                                {option.value}
                              </Label>
                            </div>
                          );
                        })}
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
                onClick={handleSubmitClick}
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
                Answered: {getTotalAnsweredCount()} /{' '}
                {examData.exam_details.total_questions} questions
              </p>
              <p className="text-xs mt-1 h-4">
                {saveStatus === 'saving' && (
                  <span className="text-gray-500">Saving…</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-green-600">
                    All answers saved to server
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-600">
                    Couldn&apos;t save last answer — it will retry automatically
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
          </div>
        </div>
      </div>

      {/* Mobile navigator drawer (below-lg): opened via the list button */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setNavOpen(false)}
          />
          <div
            className="absolute left-0 bottom-0 w-72 max-w-[85%] overflow-y-auto bg-white p-4 shadow-xl"
            style={{ top: headerH }}
          >
            {renderNavigator()}
          </div>
        </div>
      )}

      {/* Mobile: open the navigator */}
      {!navOpen && (
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="lg:hidden fixed bottom-6 left-6 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white shadow-lg flex items-center justify-center"
          aria-label="Open question navigator"
        >
          <ListChecks className="h-5 w-5" />
        </button>
      )}

      {/* Back to top */}
      {showTopButton && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-[#2E3094] to-[#4C51BF] text-white shadow-lg flex items-center justify-center hover:from-[#252865] hover:to-[#3d42a3]"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your exam?</DialogTitle>
            <DialogDescription>
              Review your submission overview below. You can&apos;t change your
              answers after submitting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">
                {examData.exam_details.total_questions}
              </p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-gray-500">Answered</p>
              <p className="text-xl font-bold text-green-600">
                {Object.keys(getSubmittedAnswers(answers)).length}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-gray-500">Missing</p>
              <p className="text-xl font-bold text-amber-600">
                {Math.max(
                  0,
                  examData.exam_details.total_questions -
                    Object.keys(getSubmittedAnswers(answers)).length
                )}
              </p>
            </div>
          </div>

          {examData.exam_details.total_questions -
            Object.keys(getSubmittedAnswers(answers)).length >
            0 && (
            <p className="text-sm text-amber-700">
              You still have{' '}
              {examData.exam_details.total_questions -
                Object.keys(getSubmittedAnswers(answers)).length}{' '}
              unanswered question
              {examData.exam_details.total_questions -
                Object.keys(getSubmittedAnswers(answers)).length !==
              1
                ? 's'
                : ''}
              . They will be left blank.
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSubmitConfirm(false)}
              disabled={submitting}
            >
              Keep Answering
            </Button>
            <Button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="bg-gradient-to-r from-[#2E3094] to-[#4C51BF] hover:from-[#252865] hover:to-[#3d42a3] text-white"
            >
              {submitting ? 'Submitting…' : 'Confirm Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
