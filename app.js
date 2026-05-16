const STORAGE_KEY = "kaoyan_mistake_review_v2";
const SETTINGS_KEY = "kaoyan_mistake_review_settings_v1";
const CLOUD_CONFIG_KEY = "study_review_cloud_config_v1";
const defaultSettings = {
  eventName: "27考研",
  deadlineDate: "2026-11-15",
  startDate: "2026-05-15",
};
const masteryLevels = {
  0: { label: "完全不会", base: 0.5 },
  1: { label: "部分想起", base: 2.5 },
  2: { label: "独立做出", base: 6.5 },
  3: { label: "熟练掌握", base: 21 },
  4: { label: "迁移讲解", base: 60 },
};
const difficultyConditions = {
  complete_failure: { label: "完全不会", factor: 0.5, correct: false },
  severe_struggle: { label: "严重卡顿", factor: 0.8, correct: false },
  normal_success: { label: "正常做对", factor: 1.0, correct: true },
  easy_success: { label: "轻松做对", factor: 1.3, correct: true },
  instant_solution: { label: "秒解", factor: 1.8, correct: true },
};
const stabilityFactors = [
  { successes: 0, factor: 0.7 },
  { successes: 1, factor: 1.0 },
  { successes: 2, factor: 1.3 },
  { successes: 3, factor: 1.7 },
  { successes: 4, factor: 2.2 },
];

const state = {
  problems: loadProblems(),
  settings: loadSettings(),
  cloudConfig: loadCloudConfig(),
  cloudClient: null,
  cloudUser: null,
  cloudSaveTimer: null,
  activeView: "dashboard",
  filterSubject: "全部",
  search: "",
  selectedDate: todayText(),
  calendarYear: 2026,
  calendarMonth: 4,
};

const els = {
  brandMark: document.querySelector("#brandMark"),
  brandTitle: document.querySelector("#brandTitle"),
  brandSubtitle: document.querySelector("#brandSubtitle"),
  cloudStatus: document.querySelector("#cloudStatus"),
  cloudMessage: document.querySelector("#cloudMessage"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseKey: document.querySelector("#supabaseKey"),
  connectCloudBtn: document.querySelector("#connectCloudBtn"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  signUpBtn: document.querySelector("#signUpBtn"),
  signInBtn: document.querySelector("#signInBtn"),
  signOutBtn: document.querySelector("#signOutBtn"),
  pushCloudBtn: document.querySelector("#pushCloudBtn"),
  pullCloudBtn: document.querySelector("#pullCloudBtn"),
  eventName: document.querySelector("#eventName"),
  deadlineDate: document.querySelector("#deadlineDate"),
  daysLeft: document.querySelector("#daysLeft"),
  halfYearProgress: document.querySelector("#halfYearProgress"),
  progressCopy: document.querySelector("#progressCopy"),
  subjectStats: document.querySelector("#subjectStats"),
  viewTitle: document.querySelector("#viewTitle"),
  dashboardView: document.querySelector("#dashboardView"),
  addView: document.querySelector("#addView"),
  reviewView: document.querySelector("#reviewView"),
  calendarView: document.querySelector("#calendarView"),
  totalProblems: document.querySelector("#totalProblems"),
  totalReviews: document.querySelector("#totalReviews"),
  overallAccuracy: document.querySelector("#overallAccuracy"),
  dueProblems: document.querySelector("#dueProblems"),
  recentReviews: document.querySelector("#recentReviews"),
  weakTags: document.querySelector("#weakTags"),
  problemForm: document.querySelector("#problemForm"),
  subject: document.querySelector("#subject"),
  subjectSuggestions: document.querySelector("#subjectSuggestions"),
  questionImageInput: document.querySelector("#questionImageInput"),
  answerImageInput: document.querySelector("#answerImageInput"),
  questionImagePreview: document.querySelector("#questionImagePreview"),
  answerImagePreview: document.querySelector("#answerImagePreview"),
  problemList: document.querySelector("#problemList"),
  filterSubject: document.querySelector("#filterSubject"),
  searchInput: document.querySelector("#searchInput"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  calendarGrid: document.querySelector("#calendarGrid"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarYear: document.querySelector("#calendarYear"),
  calendarMonth: document.querySelector("#calendarMonth"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedDateSummary: document.querySelector("#selectedDateSummary"),
  selectedDateList: document.querySelector("#selectedDateList"),
  cardTemplate: document.querySelector("#problemCardTemplate"),
};

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

els.eventName.addEventListener("input", () => {
  state.settings.eventName = els.eventName.value.trim() || defaultSettings.eventName;
  saveSettings();
  renderProgress();
});

els.deadlineDate.addEventListener("change", () => {
  state.settings.deadlineDate = els.deadlineDate.value || defaultSettings.deadlineDate;
  saveSettings();
  renderProgress();
});

els.connectCloudBtn.addEventListener("click", connectCloud);
els.signUpBtn.addEventListener("click", signUpCloud);
els.signInBtn.addEventListener("click", signInCloud);
els.signOutBtn.addEventListener("click", signOutCloud);
els.pushCloudBtn.addEventListener("click", pushCloudSnapshot);
els.pullCloudBtn.addEventListener("click", pullCloudSnapshot);

els.problemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const scheduleFrom = document.querySelector("#scheduleFrom").value || todayText();
  const masteryLevel = Number(document.querySelector("#masteryLevel").value);
  const difficultyCondition = document.querySelector("#difficultyCondition").value;
  const schedule = buildSchedule(scheduleFrom, masteryLevel, difficultyCondition, 0);
  const problem = {
    id: makeId(),
    subject: els.subject.value.trim(),
    tags: splitTags(document.querySelector("#tags").value),
    questionImageData: els.questionImagePreview.dataset.image || "",
    answerImageData: els.answerImagePreview.dataset.image || "",
    difficulty: document.querySelector("#difficulty").value,
    masteryLevel,
    difficultyCondition,
    consecutiveSuccesses: 0,
    nextReviewStart: schedule.start,
    nextReviewEnd: schedule.end,
    nextReview: schedule.start,
    scheduleNote: schedule.note,
    createdAt: new Date().toISOString(),
    reviews: [],
  };

  if (!problem.questionImageData || !problem.answerImageData) {
    alert("请分别上传题目图片和答案解析图片。");
    return;
  }

  state.problems.unshift(problem);
  saveProblems();
  els.problemForm.reset();
  clearImagePreviews();
  setDefaultReviewDate();
  setView("review");
  render();
});

bindImagePreview(els.questionImageInput, els.questionImagePreview, "上传的题目图片");
bindImagePreview(els.answerImageInput, els.answerImagePreview, "上传的答案解析图片");

els.filterSubject.addEventListener("change", () => {
  state.filterSubject = els.filterSubject.value;
  renderProblemList();
});

els.searchInput.addEventListener("input", () => {
  state.search = els.searchInput.value.trim().toLowerCase();
  renderProblemList();
});

els.calendarYear.addEventListener("change", () => {
  state.calendarYear = Number(els.calendarYear.value) || 2026;
  syncSelectedDateToVisibleMonth();
  renderCalendar();
});

els.calendarMonth.addEventListener("change", () => {
  state.calendarMonth = Number(els.calendarMonth.value) || 0;
  syncSelectedDateToVisibleMonth();
  renderCalendar();
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.problems, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kaoyan-review-${todayText()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", () => {
  const file = els.importInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("导入文件格式不正确");
      state.problems = imported;
      saveProblems();
      render();
    } catch (error) {
      alert(error.message || "导入失败");
    } finally {
      els.importInput.value = "";
    }
  });
  reader.readAsText(file);
});

function loadProblems() {
  try {
    return normalizeProblems(JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedProblems());
  } catch {
    return normalizeProblems(seedProblems());
  }
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...defaultSettings };
  }
}

function loadCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)) || { url: "", key: "" };
  } catch {
    return { url: "", key: "" };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  queueCloudSave();
}

function normalizeProblems(problems) {
  return problems.map((problem) => {
    const masteryLevel = Number(problem.masteryLevel ?? 1);
    const difficultyCondition = problem.difficultyCondition || "normal_success";
    const consecutiveSuccesses = problem.consecutiveSuccesses || 0;
    if (!problem.nextReviewStart) {
      const fromDate = problem.nextReview || todayText();
      const schedule = buildSchedule(fromDate, masteryLevel, difficultyCondition, consecutiveSuccesses);
      problem.nextReviewStart = schedule.start;
      problem.nextReviewEnd = schedule.end;
      problem.scheduleNote = schedule.note;
    }
    problem.masteryLevel = masteryLevel;
    problem.difficultyCondition = difficultyCondition;
    problem.consecutiveSuccesses = consecutiveSuccesses;
    problem.reviews = problem.reviews || [];
    return problem;
  });
}

function saveProblems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.problems));
  queueCloudSave();
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  [els.dashboardView, els.addView, els.reviewView, els.calendarView].forEach((viewEl) => {
    viewEl.classList.remove("active-view");
  });
  document.querySelector(`#${view}View`).classList.add("active-view");
  els.viewTitle.textContent =
    view === "dashboard"
      ? "今天的进步"
      : view === "add"
        ? "录入一道错题"
        : view === "calendar"
          ? "学习日历"
          : "错题复盘";
}

function render() {
  renderCloudPanel();
  renderSubjectControls();
  renderProgress();
  renderSubjectStats();
  renderDashboard();
  renderProblemList();
  renderCalendar();
}

function renderCloudPanel() {
  els.supabaseUrl.value = state.cloudConfig.url || "";
  els.supabaseKey.value = state.cloudConfig.key || "";
  els.cloudStatus.textContent = state.cloudUser ? "已登录" : state.cloudClient ? "已连接" : "未连接";
}

async function connectCloud() {
  if (!window.supabase?.createClient) {
    setCloudMessage("Supabase SDK 未加载。请确认浏览器可以访问 jsDelivr CDN，或改用本地打包版本。", true);
    return;
  }

  const url = els.supabaseUrl.value.trim();
  const key = els.supabaseKey.value.trim();
  if (!url || !key) {
    setCloudMessage("请填写 Supabase URL 和 publishable/anon key。", true);
    return;
  }

  state.cloudConfig = { url, key };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(state.cloudConfig));
  state.cloudClient = window.supabase.createClient(url, key);
  const { data } = await state.cloudClient.auth.getUser();
  state.cloudUser = data?.user || null;
  setCloudMessage(state.cloudUser ? "云端已连接，账号已登录。" : "云端已连接，请注册或登录。");
  renderCloudPanel();
}

async function signUpCloud() {
  if (!(await ensureCloudClient())) return;
  const credentials = getCredentials();
  if (!credentials) return;
  const { data, error } = await state.cloudClient.auth.signUp(credentials);
  if (error) {
    setCloudMessage(error.message, true);
    return;
  }
  state.cloudUser = data.user || null;
  setCloudMessage(state.cloudUser ? "注册成功，已登录。" : "注册成功，请到邮箱确认后再登录。");
  renderCloudPanel();
}

async function signInCloud() {
  if (!(await ensureCloudClient())) return;
  const credentials = getCredentials();
  if (!credentials) return;
  const { data, error } = await state.cloudClient.auth.signInWithPassword(credentials);
  if (error) {
    setCloudMessage(error.message, true);
    return;
  }
  state.cloudUser = data.user;
  setCloudMessage("登录成功。可以保存到云端，或从云端读取。");
  renderCloudPanel();
}

async function signOutCloud() {
  if (!state.cloudClient) return;
  await state.cloudClient.auth.signOut();
  state.cloudUser = null;
  setCloudMessage("已退出云同步账号。");
  renderCloudPanel();
}

async function pushCloudSnapshot() {
  if (!(await ensureCloudUser())) return;
  const { error } = await state.cloudClient.from("study_review_snapshots").upsert({
    user_id: state.cloudUser.id,
    payload: state.problems,
    settings: state.settings,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    setCloudMessage(error.message, true);
    return;
  }
  setCloudMessage(`已保存到云端：${new Date().toLocaleString()}`);
}

async function pullCloudSnapshot() {
  if (!(await ensureCloudUser())) return;
  const { data, error } = await state.cloudClient
    .from("study_review_snapshots")
    .select("payload, settings, updated_at")
    .eq("user_id", state.cloudUser.id)
    .maybeSingle();
  if (error) {
    setCloudMessage(error.message, true);
    return;
  }
  if (!data) {
    setCloudMessage("云端还没有快照，可以先点“保存到云端”。", true);
    return;
  }
  const ok = window.confirm(
    `确认用云端数据覆盖当前本地数据吗？\n\n云端更新时间：${data.updated_at || "未知"}\n\n建议覆盖前先点右上角导出备份。`,
  );
  if (!ok) return;
  state.problems = normalizeProblems(data.payload || []);
  state.settings = { ...defaultSettings, ...(data.settings || {}) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.problems));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  setCloudMessage("已从云端读取并覆盖本地数据。");
  render();
}

function queueCloudSave() {
  if (!state.cloudClient || !state.cloudUser) return;
  window.clearTimeout(state.cloudSaveTimer);
  state.cloudSaveTimer = window.setTimeout(() => {
    pushCloudSnapshot();
  }, 900);
}

async function ensureCloudClient() {
  if (state.cloudClient) return true;
  await connectCloud();
  return Boolean(state.cloudClient);
}

async function ensureCloudUser() {
  if (!(await ensureCloudClient())) return false;
  if (state.cloudUser) return true;
  const { data } = await state.cloudClient.auth.getUser();
  state.cloudUser = data?.user || null;
  renderCloudPanel();
  if (!state.cloudUser) {
    setCloudMessage("请先登录云同步账号。", true);
    return false;
  }
  return true;
}

function getCredentials() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setCloudMessage("请填写邮箱和密码。", true);
    return null;
  }
  return { email, password };
}

function setCloudMessage(message, isError = false) {
  els.cloudMessage.textContent = message;
  els.cloudMessage.classList.toggle("error-text", isError);
}

async function initializeCloudFromSavedConfig() {
  const { url, key } = state.cloudConfig;
  if (!url || !key || !window.supabase?.createClient) {
    renderCloudPanel();
    return;
  }

  state.cloudClient = window.supabase.createClient(url, key);
  const { data } = await state.cloudClient.auth.getUser();
  state.cloudUser = data?.user || null;
  setCloudMessage(state.cloudUser ? "已自动连接云端并恢复登录。" : "已自动连接云端，请登录。");
  renderCloudPanel();
}

function renderProgress() {
  const now = new Date();
  const startDate = parseDate(state.settings.startDate || defaultSettings.startDate);
  const deadlineDate = parseDate(state.settings.deadlineDate || defaultSettings.deadlineDate);
  const totalMs = Math.max(1, deadlineDate - startDate);
  const elapsedMs = Math.max(0, Math.min(totalMs, now - startDate));
  const daysLeft = Math.max(0, Math.ceil((deadlineDate - now) / 86400000));
  const progress = Math.round((elapsedMs / totalMs) * 100);
  const eventName = state.settings.eventName || defaultSettings.eventName;

  els.eventName.value = eventName;
  els.deadlineDate.value = state.settings.deadlineDate || defaultSettings.deadlineDate;
  els.brandMark.textContent = eventName.slice(0, 1) || "记";
  els.brandTitle.textContent = `${eventName}复盘台`;
  els.brandSubtitle.textContent = `截止日期：${state.settings.deadlineDate || defaultSettings.deadlineDate}`;
  els.daysLeft.textContent = `${daysLeft} 天`;
  els.halfYearProgress.style.width = `${progress}%`;
  els.progressCopy.textContent = `距离「${eventName}」截止日期 ${state.settings.deadlineDate || defaultSettings.deadlineDate} 还有 ${daysLeft} 天，当前时间进度 ${progress}%。`;
}

function renderSubjectStats() {
  const subjects = getSubjects();
  const maxCount = Math.max(1, ...subjects.map((subject) => countBySubject(subject)));
  els.subjectStats.innerHTML = subjects.length
    ? subjects
        .map((subject) => {
          const count = countBySubject(subject);
          const width = Math.round((count / maxCount) * 100);
          return `
            <div class="subject-stat">
              <strong>${escapeHtml(subject)}</strong>
              <span>${count} 题</span>
              <div class="subject-bar"><span style="width: ${width}%"></span></div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">录入错题后会自动出现科目统计。</div>`;
}

function renderSubjectControls() {
  const subjects = getSubjects();
  els.subjectSuggestions.innerHTML = subjects
    .map((subject) => `<option value="${escapeHtml(subject)}"></option>`)
    .join("");
  const options = ["全部", ...subjects];
  const current = options.includes(state.filterSubject) ? state.filterSubject : "全部";
  state.filterSubject = current;
  els.filterSubject.innerHTML = options
    .map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`)
    .join("");
  els.filterSubject.value = current;
}

function renderDashboard() {
  const totalReviews = state.problems.reduce((sum, problem) => sum + problem.reviews.length, 0);
  const correctReviews = state.problems.reduce(
    (sum, problem) => sum + problem.reviews.filter((review) => review.correct).length,
    0,
  );
  const today = todayText();
  const dueCount = state.problems.filter((problem) => isDueOn(problem, today)).length;

  els.totalProblems.textContent = state.problems.length;
  els.totalReviews.textContent = totalReviews;
  els.overallAccuracy.textContent = totalReviews
    ? `${Math.round((correctReviews / totalReviews) * 100)}%`
    : "--";
  els.dueProblems.textContent = dueCount;

  const recent = state.problems
    .flatMap((problem) =>
      problem.reviews.map((review) => ({
        ...review,
        subject: problem.subject,
        summary: problem.tags?.length ? problem.tags.join(" / ") : "图片错题",
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  els.recentReviews.classList.toggle("empty-state", recent.length === 0);
  els.recentReviews.innerHTML = recent.length
    ? recent
        .map(
          (review) => `
            <div class="timeline-item">
              <strong>${review.date} · ${review.correct ? "正确" : "错误"}</strong>
              <span>${review.subject} · ${review.summary}</span>
            </div>
          `,
        )
        .join("")
    : "暂无复盘记录。";

  const weakTags = collectWeakTags();
  els.weakTags.classList.toggle("empty-state", weakTags.length === 0);
  els.weakTags.innerHTML = weakTags.length
    ? weakTags
        .map((item) => `<span class="weak-tag">${item.tag} · ${item.wrong}/${item.total}</span>`)
        .join("")
    : "录入题目后会自动统计。";
}

function renderProblemList() {
  const filtered = state.problems.filter((problem) => {
    const subjectMatch =
      state.filterSubject === "全部" || problem.subject === state.filterSubject;
    const searchText = [problem.subject, problem.difficulty, ...problem.tags].join(" ").toLowerCase();
    return subjectMatch && (!state.search || searchText.includes(state.search));
  });

  if (!filtered.length) {
    els.problemList.innerHTML = `<div class="panel empty-state">还没有符合条件的错题。</div>`;
    return;
  }

  els.problemList.innerHTML = "";
  filtered.forEach((problem) => {
    const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
    const accuracy = getAccuracy(problem);
    card.querySelector(".subject-pill").textContent = problem.subject;
    card.querySelector(".difficulty-pill").textContent = problem.difficulty;
    card.querySelector(".accuracy-pill").textContent = accuracy.label;
    renderProblemImage(
      card.querySelector(".question-image"),
      getQuestionImage(problem),
      problem.question || "旧版文字题目",
    );
    card.querySelector(".tag-row").innerHTML = problem.tags
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join("");
    card.querySelector(".memory-line").textContent = getMemoryLine(problem);
    renderProblemImage(
      card.querySelector(".answer-image"),
      getAnswerImage(problem),
      problem.answer || "旧版文字解析",
    );
    card.querySelector(".history-line").textContent = getHistoryLine(problem);

    card.querySelector(".toggle-answer").addEventListener("click", (event) => {
      const box = card.querySelector(".answer-box");
      box.hidden = !box.hidden;
      event.currentTarget.textContent = box.hidden ? "查看解析" : "收起解析";
    });
    card.querySelectorAll("[data-condition]").forEach((button) => {
      button.addEventListener("click", () => recordReview(problem.id, button.dataset.condition));
    });
    card.querySelector(".delete-problem").addEventListener("click", () => deleteProblem(problem.id));
    els.problemList.appendChild(card);
  });
}

function deleteProblem(problemId) {
  const problem = state.problems.find((item) => item.id === problemId);
  if (!problem) return;
  const tags = problem.tags?.length ? problem.tags.join(" / ") : "未分类";
  const ok = window.confirm(
    `确认删除这道题目吗？\n\n科目：${problem.subject}\n知识点：${tags}\n\n删除后，这道题的图片、复盘记录和日历安排都会被移除。`,
  );
  if (!ok) return;
  state.problems = state.problems.filter((item) => item.id !== problemId);
  saveProblems();
  render();
}

function recordReview(problemId, condition) {
  const problem = state.problems.find((item) => item.id === problemId);
  if (!problem) return;
  const conditionMeta = difficultyConditions[condition] || difficultyConditions.normal_success;
  const tags = problem.tags?.length ? problem.tags.join(" / ") : "未分类";
  const ok = window.confirm(
    `确认记录这次复盘为「${conditionMeta.label}」吗？\n\n科目：${problem.subject}\n知识点：${tags}\n\n确认后会写入今天的复盘记录，并重新计算下一次复习窗口。`,
  );
  if (!ok) return;
  const correct = conditionMeta.correct;
  const nextMastery = updateMastery(problem.masteryLevel ?? 1, condition);
  const consecutiveSuccesses = correct ? (problem.consecutiveSuccesses || 0) + 1 : 0;
  const schedule = buildSchedule(todayText(), nextMastery, condition, consecutiveSuccesses);
  problem.reviews.push({
    date: todayText(),
    correct,
    condition,
    conditionLabel: conditionMeta.label,
    masteryLevel: nextMastery,
  });
  problem.masteryLevel = nextMastery;
  problem.difficultyCondition = condition;
  problem.consecutiveSuccesses = consecutiveSuccesses;
  problem.nextReviewStart = schedule.start;
  problem.nextReviewEnd = schedule.end;
  problem.nextReview = schedule.start;
  problem.scheduleNote = schedule.note;
  saveProblems();
  render();
}

function countBySubject(subject) {
  return state.problems.filter((problem) => problem.subject === subject).length;
}

function getSubjects() {
  return [...new Set(state.problems.map((problem) => problem.subject).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-Hans-CN"),
  );
}

function splitTags(value) {
  return value
    .split(/[,，、\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getAccuracy(problem) {
  if (!problem.reviews.length) return { value: null, label: "未重刷" };
  const correct = problem.reviews.filter((review) => review.correct).length;
  return {
    value: correct / problem.reviews.length,
    label: `${Math.round((correct / problem.reviews.length) * 100)}% 正确`,
  };
}

function getHistoryLine(problem) {
  const windowText = getReviewWindowText(problem);
  if (!problem.reviews.length) return `复习窗口：${windowText}`;
  const history = problem.reviews
    .slice(-5)
    .map((review) => `${review.date} ${review.conditionLabel || (review.correct ? "对" : "错")}`)
    .join(" / ");
  return `最近记录：${history}。复习窗口：${windowText}`;
}

function getMemoryLine(problem) {
  const level = Number(problem.masteryLevel ?? 1);
  const condition = problem.difficultyCondition || "normal_success";
  const levelLabel = masteryLevels[level]?.label || "部分想起";
  const conditionLabel = difficultyConditions[condition]?.label || "正常做对";
  return `掌握度 L${level} ${levelLabel} · 提取难度 ${conditionLabel} · 连续成功 ${problem.consecutiveSuccesses || 0} · ${problem.scheduleNote || "动态间隔"}`;
}

function getReviewWindowText(problem) {
  const start = problem.nextReviewStart || problem.nextReview || todayText();
  const end = problem.nextReviewEnd || start;
  return start === end ? start : `${start} 至 ${end}`;
}

function collectWeakTags() {
  const map = new Map();
  state.problems.forEach((problem) => {
    const total = problem.reviews.length || 1;
    const wrong = problem.reviews.filter((review) => !review.correct).length || 0;
    problem.tags.forEach((tag) => {
      const item = map.get(tag) || { tag, total: 0, wrong: 0 };
      item.total += total;
      item.wrong += wrong;
      map.set(tag, item);
    });
  });
  return [...map.values()]
    .filter((item) => item.wrong > 0)
    .sort((a, b) => b.wrong / b.total - a.wrong / a.total)
    .slice(0, 10);
}

function bindImagePreview(input, preview, alt) {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      clearImagePreview(preview);
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      preview.dataset.image = reader.result;
      preview.innerHTML = `<img alt="${alt}" src="${reader.result}" />`;
    });
    reader.readAsDataURL(file);
  });
}

function clearImagePreviews() {
  clearImagePreview(els.questionImagePreview, "题目图片预览");
  clearImagePreview(els.answerImagePreview, "答案解析图片预览");
}

function clearImagePreview(preview, text = "图片预览") {
  preview.dataset.image = "";
  preview.textContent = text;
}

function renderProblemImage(container, imageData, fallbackText) {
  if (imageData) {
    container.innerHTML = `<img alt="错题图片" src="${imageData}" />`;
    return;
  }

  container.textContent = fallbackText || "暂无图片";
}

function getQuestionImage(problem) {
  return problem.questionImageData || problem.imageData || "";
}

function getAnswerImage(problem) {
  return problem.answerImageData || "";
}

function setDefaultReviewDate() {
  const input = document.querySelector("#scheduleFrom");
  input.value = todayText();
}

function buildSchedule(fromDateText, masteryLevel, condition, consecutiveSuccesses) {
  const base = masteryLevels[masteryLevel]?.base || masteryLevels[1].base;
  const difficultyFactor = difficultyConditions[condition]?.factor || 1;
  const stabilityFactor = getStabilityFactor(consecutiveSuccesses);
  const interval = Math.max(0.5, base * difficultyFactor * stabilityFactor);
  const startOffset = Math.max(0, Math.round(interval * 0.85));
  const endOffset = Math.max(startOffset, Math.round(interval * 1.15));
  const fromDate = parseDate(fromDateText);

  return {
    start: addDaysText(fromDate, startOffset),
    end: addDaysText(fromDate, endOffset),
    note: `动态间隔约 ${formatInterval(interval)} 天`,
  };
}

function getStabilityFactor(consecutiveSuccesses) {
  const capped = Math.min(4, Math.max(0, consecutiveSuccesses || 0));
  return stabilityFactors.find((item) => item.successes === capped)?.factor || 0.7;
}

function updateMastery(currentLevel, condition) {
  const level = Number(currentLevel ?? 1);
  if (condition === "complete_failure") return Math.max(0, level - 1);
  if (condition === "severe_struggle") return Math.max(0, level);
  if (condition === "normal_success") return Math.min(4, level + 1);
  return Math.min(4, level + 1);
}

function isDueOn(problem, dateText) {
  const start = problem.nextReviewStart || problem.nextReview;
  const end = problem.nextReviewEnd || start;
  if (!start) return false;
  return dateText >= start && dateText <= end;
}

function renderCalendar() {
  if (!els.calendarGrid) return;
  els.calendarYear.value = state.calendarYear;
  els.calendarMonth.value = String(state.calendarMonth);
  els.calendarTitle.textContent = `${state.calendarYear} 年 ${state.calendarMonth + 1} 月复习安排`;
  els.calendarGrid.innerHTML = "";
  els.calendarGrid.appendChild(buildMonth(state.calendarYear, state.calendarMonth));
  renderSelectedDate();
}

function buildMonth(year, month) {
  const monthEl = document.createElement("article");
  monthEl.className = "month-card";
  const title = document.createElement("h3");
  title.textContent = `${year} 年 ${month + 1} 月`;
  monthEl.appendChild(title);

  const weekRow = document.createElement("div");
  weekRow.className = "weekday-row";
  ["一", "二", "三", "四", "五", "六", "日"].forEach((day) => {
    const item = document.createElement("span");
    item.textContent = day;
    weekRow.appendChild(item);
  });
  monthEl.appendChild(weekRow);

  const days = document.createElement("div");
  days.className = "month-days";
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < leading; i += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-day blank";
    days.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateText = formatDate(new Date(year, month, day));
    const summary = getDaySummary(dateText);
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.classList.toggle("has-work", summary.due.length > 0 || summary.reviewed.length > 0 || summary.created.length > 0);
    button.classList.toggle("selected", state.selectedDate === dateText);
    button.innerHTML = `
      <strong>${day}</strong>
      <span>${summary.due.length ? `待 ${summary.due.length}` : ""}</span>
      <span>${summary.reviewed.length ? `学 ${summary.reviewed.length}` : ""}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedDate = dateText;
      renderCalendar();
    });
    days.appendChild(button);
  }

  monthEl.appendChild(days);
  return monthEl;
}

function renderSelectedDate() {
  const summary = getDaySummary(state.selectedDate);
  els.selectedDateTitle.textContent = state.selectedDate;
  els.selectedDateSummary.textContent = `待复盘 ${summary.due.length} 题 · 已复盘 ${summary.reviewed.length} 题 · 新录入 ${summary.created.length} 题`;

  const rows = [
    ...summary.due.map((problem) => taskRow("待复盘", problem)),
    ...summary.reviewed.map((item) => taskRow(item.review.conditionLabel || "已复盘", item.problem)),
    ...summary.created.map((problem) => taskRow("新录入", problem)),
  ];
  els.selectedDateList.classList.toggle("empty-state", rows.length === 0);
  els.selectedDateList.innerHTML = rows.length ? rows.join("") : "这一天暂时没有错题安排。";
}

function getDaySummary(dateText) {
  return {
    due: state.problems.filter((problem) => isDueOn(problem, dateText)),
    reviewed: state.problems.flatMap((problem) =>
      problem.reviews
        .filter((review) => review.date === dateText)
        .map((review) => ({ problem, review })),
    ),
    created: state.problems.filter((problem) => formatDate(new Date(problem.createdAt)) === dateText),
  };
}

function taskRow(label, problem) {
  return `
    <div class="day-task">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(problem.subject)} · ${escapeHtml((problem.tags || []).join(" / ") || "未分类")} · ${getReviewWindowText(problem)}</span>
    </div>
  `;
}

function parseDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatInterval(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function syncSelectedDateToVisibleMonth() {
  const selected = parseDate(state.selectedDate);
  if (
    selected.getFullYear() === state.calendarYear &&
    selected.getMonth() === state.calendarMonth
  ) {
    return;
  }
  state.selectedDate = formatDate(new Date(state.calendarYear, state.calendarMonth, 1));
}

function todayText() {
  return formatDate(new Date());
}

function addDaysText(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return formatDate(next);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `problem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function seedProblems() {
  return [];
}

setDefaultReviewDate();
render();
initializeCloudFromSavedConfig();
