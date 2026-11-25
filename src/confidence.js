const MOOD_SCORES = {
  stuck: 42,
  building: 72,
  confident: 94
};

export function classifyConfidence(score) {
  if (score >= 80) {
    return {
      tier: 'exam_ready',
      label: 'Exam Confident',
      tagline: 'Strong mastery & consistent execution'
    };
  }
  if (score >= 58) {
    return {
      tier: 'building',
      label: 'Building Confidence',
      tagline: 'Solid foundation — 1–2 practice sets from mastery'
    };
  }
  return {
    tier: 'needs_support',
    label: 'Needs Support',
    tagline: 'Priority focus topic — review notes & coach walkthrough'
  };
}

export function computeStudentAnalytics(studentId, db) {
  const student = db.users.find((u) => u.id === studentId);
  if (!student) return null;

  const studentAttempts = db.quiz_attempts.filter((a) => a.student_id === studentId);
  const studentSubmissions = db.submissions.filter((s) => s.student_id === studentId);
  const studentAttendance = db.attendance.filter((a) => a.student_id === studentId);
  const studentResProgress = db.resource_progress.filter((r) => r.student_id === studentId);

  // Overall attendance rate
  let attendanceRate = 92;
  if (studentAttendance.length > 0) {
    const earned = studentAttendance.reduce((acc, item) => {
      if (item.status === 'present') return acc + 1;
      if (item.status === 'late') return acc + 0.65;
      return acc;
    }, 0);
    attendanceRate = Math.round((earned / studentAttendance.length) * 100);
  }

  // Overall quiz accuracy
  const quizAverage =
    studentAttempts.length > 0
      ? Math.round(studentAttempts.reduce((sum, a) => sum + a.score_percent, 0) / studentAttempts.length)
      : null;

  // Graded homework average
  const gradedSubmissions = studentSubmissions.filter(
    (s) => s.status === 'graded' && typeof s.marks_awarded === 'number'
  );
  let homeworkAverage = null;
  if (gradedSubmissions.length > 0) {
    const percents = gradedSubmissions.map((sub) => {
      const asg = db.assignments.find((a) => a.id === sub.assignment_id);
      const maxMarks = asg?.max_marks || 20;
      return Math.round((sub.marks_awarded / maxMarks) * 100);
    });
    homeworkAverage = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
  }

  const moodScore = MOOD_SCORES[student.confidence_mood] || 72;

  const subjectBreakdowns = db.subjects.map((subject) => {
    const subQuizzes = db.quizzes.filter((q) => q.subject_id === subject.id);
    const subQuizIds = new Set(subQuizzes.map((q) => q.id));
    const subAttempts = studentAttempts.filter((a) => subQuizIds.has(a.quiz_id));

    const subAssignments = db.assignments.filter((a) => a.subject_id === subject.id);
    const subResources = db.resources.filter((r) => r.subject_id === subject.id);
    const subSessions = db.sessions.filter((s) => s.subject_id === subject.id && s.status === 'completed');
    const subSessionIds = new Set(subSessions.map((s) => s.id));
    const subAtt = studentAttendance.filter((a) => subSessionIds.has(a.session_id));

    const topicScores = (subject.topics || []).map((topicObj) => {
      const topicName = topicObj.name;
      // Quizzes for this topic
      const tQuizzes = subQuizzes.filter((q) => q.topic === topicName);
      const tQuizIds = new Set(tQuizzes.map((q) => q.id));
      const tAttempts = subAttempts.filter((a) => tQuizIds.has(a.quiz_id));
      const latestQuizScore =
        tAttempts.length > 0
          ? tAttempts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].score_percent
          : null;

      // Homework for this topic
      const tAssignments = subAssignments.filter((a) => a.topic === topicName);
      const tAsgIds = new Set(tAssignments.map((a) => a.id));
      const tSubs = studentSubmissions.filter((s) => tAsgIds.has(s.assignment_id));
      let hwScore = null;
      if (tSubs.length > 0) {
        const sub = tSubs[0];
        const asg = tAssignments.find((a) => a.id === sub.assignment_id);
        if (sub.status === 'graded' && typeof sub.marks_awarded === 'number') {
          hwScore = Math.round((sub.marks_awarded / (asg?.max_marks || 20)) * 100);
        } else {
          hwScore = MOOD_SCORES[sub.student_confidence] || 75;
        }
      }

      // Resources completed for this topic
      const tRes = subResources.filter((r) => r.topic === topicName);
      const completedResCount = tRes.filter((r) =>
        studentResProgress.some((rp) => rp.resource_id === r.id && rp.completed)
      ).length;
      const resScore = tRes.length > 0 ? Math.round((completedResCount / tRes.length) * 100) : null;

      // Attendance check-in for this topic
      const tSessions = subSessions.filter((s) => s.topic === topicName);
      const tSesIds = new Set(tSessions.map((s) => s.id));
      const tAttRecords = subAtt.filter((a) => tSesIds.has(a.session_id));
      let checkinScore = null;
      if (tAttRecords.length > 0) {
        const rec = tAttRecords[0];
        const baseAtt = rec.status === 'present' ? 95 : rec.status === 'late' ? 70 : 35;
        const mood = MOOD_SCORES[rec.confidence_checkin] || 72;
        checkinScore = Math.round(baseAtt * 0.5 + mood * 0.5);
      }

      // Weighted blend across available signals
      const signals = [];
      if (latestQuizScore !== null) signals.push({ val: latestQuizScore, weight: 0.48 });
      if (hwScore !== null) signals.push({ val: hwScore, weight: 0.28 });
      if (checkinScore !== null) signals.push({ val: checkinScore, weight: 0.16 });
      if (resScore !== null) signals.push({ val: Math.max(55, resScore), weight: 0.12 });

      let score;
      if (signals.length === 0) {
        score = Math.round(moodScore * 0.6 + attendanceRate * 0.4 * 0.85);
      } else {
        const totalW = signals.reduce((s, x) => s + x.weight, 0);
        score = Math.round(signals.reduce((s, x) => s + x.val * x.weight, 0) / totalW);
      }
      score = Math.max(25, Math.min(100, score));

      const matchingQuiz = tQuizzes[0] || subQuizzes[0] || null;
      const matchingResource = tRes[0] || subResources[0] || null;

      return {
        id: topicObj.id,
        name: topicName,
        summary: topicObj.summary,
        subject_id: subject.id,
        subject_name: subject.name,
        confidence_score: score,
        ...classifyConfidence(score),
        latest_quiz_score: latestQuizScore,
        homework_score: hwScore,
        recommended_quiz_id: matchingQuiz?.id || null,
        recommended_resource_id: matchingResource?.id || null
      };
    });

    const subjectScore =
      topicScores.length > 0
        ? Math.round(topicScores.reduce((sum, t) => sum + t.confidence_score, 0) / topicScores.length)
        : moodScore;

    return {
      subject_id: subject.id,
      subject_name: subject.name,
      code: subject.code,
      tutor_name: subject.tutor_name,
      icon: subject.icon,
      confidence_score: subjectScore,
      ...classifyConfidence(subjectScore),
      quizzes_taken: subAttempts.length,
      resources_completed: subResources.filter((r) =>
        studentResProgress.some((rp) => rp.resource_id === r.id && rp.completed)
      ).length,
      total_resources: subResources.length,
      topics: topicScores
    };
  });

  const overallConfidence =
    subjectBreakdowns.length > 0
      ? Math.round(subjectBreakdowns.reduce((sum, s) => sum + s.confidence_score, 0) / subjectBreakdowns.length)
      : moodScore;

  const allTopics = subjectBreakdowns.flatMap((s) => s.topics);
  const weakSpotRadar = allTopics
    .filter((t) => t.confidence_score < 76)
    .sort((a, b) => a.confidence_score - b.confidence_score)
    .slice(0, 5);

  const masteredTopicsCount = allTopics.filter((t) => t.confidence_score >= 80).length;

  const pendingAssignments = db.assignments.filter(
    (asg) => !studentSubmissions.some((sub) => sub.assignment_id === asg.id)
  );

  return {
    student_id: student.id,
    student_name: student.name,
    grade: student.grade,
    streak_days: student.streak_days || 1,
    confidence_mood: student.confidence_mood,
    overall_confidence: overallConfidence,
    ...classifyConfidence(overallConfidence),
    attendance_rate: attendanceRate,
    quiz_average: quizAverage ?? overallConfidence,
    quizzes_completed: studentAttempts.length,
    homework_average: homeworkAverage ?? overallConfidence,
    homework_submitted: studentSubmissions.length,
    homework_pending_count: pendingAssignments.length,
    mastered_topics_count: masteredTopicsCount,
    total_topics_count: allTopics.length,
    subjects: subjectBreakdowns,
    weak_spots: weakSpotRadar
  };
}
