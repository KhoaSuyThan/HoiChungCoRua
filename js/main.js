/**
 * Logic tương tác giao diện, hiệu ứng cuộn trang & Bộ nhắc nhở lịch tập thông minh
 * Dự án: Hội chứng Cổ Rùa ở Sinh viên - Cột sống khỏe
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. HIỆU ỨNG CUỘN TRANG & ĐIỀU HƯỚNG MỤC LỤC
  // =========================================================================

  // Hiệu ứng Reveal khi phần tử xuất hiện trong tầm nhìn
  var revealEls = document.querySelectorAll('main .reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            revealObserver.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('in');
    });
  }

  // Tự động kích hoạt liên kết mục lục (Navigation) tương ứng với vị trí đọc
  var navLinks = document.querySelectorAll('nav a');
  var navMap = {};
  navLinks.forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && href.startsWith('#')) {
      navMap[href.slice(1)] = a;
    }
  });

  if ('IntersectionObserver' in window) {
    var scrollSpy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            navLinks.forEach(function (a) {
              a.classList.remove('active');
            });
            var activeLink = navMap[e.target.id];
            if (activeLink) {
              activeLink.classList.add('active');
              var parentNav = activeLink.parentNode;
              parentNav.scrollLeft =
                activeLink.offsetLeft -
                parentNav.clientWidth / 2 +
                activeLink.offsetWidth / 2;
            }
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );

    document.querySelectorAll('main section[id]').forEach(function (s) {
      scrollSpy.observe(s);
    });
  }

  // =========================================================================
  // 2. BỘ NHẮC NHỞ & HẸN GIỜ LỊCH TẬP THÔNG MINH (SMART REMINDER)
  // =========================================================================

  // Các phần tử giao diện trong DOM
  var digitsEl = document.getElementById('timer-digits');
  var statusTextEl = document.getElementById('timer-status-text');
  var btnStart = document.getElementById('btn-timer-start');
  var btnStartLabel = document.getElementById('btn-start-label');
  var btnPause = document.getElementById('btn-timer-pause');
  var btnReset = document.getElementById('btn-timer-reset');
  var btnTestSound = document.getElementById('btn-test-sound');
  var notifStatusBadge = document.getElementById('notif-status-badge');
  var notifPermText = document.getElementById('notif-perm-text');
  var floatBadge = document.getElementById('float-timer-badge');
  var dailyDisplay = document.getElementById('daily-count-display');
  var dailyFill = document.getElementById('daily-progress-fill');
  var dailyPraise = document.getElementById('daily-praise-msg');
  var durationPills = document.querySelectorAll('#duration-pills .pill-btn');
  var countPills = document.querySelectorAll('#target-count-pills .pill-btn');

  // Các phần tử điều khiển Hộp thoại Modal Popup
  var reminderModal = document.getElementById('reminder-modal');
  var btnCloseModal = document.getElementById('modal-close-btn');
  var btnOpenBanner = document.getElementById('btn-open-reminder-banner');
  var floatReminderBtn = document.getElementById('float-reminder-btn');
  var navReminderLink = document.querySelector('nav a[href="#nhac-nho"]');

  // Mở hộp thoại Modal
  function openReminderModal() {
    if (reminderModal) {
      reminderModal.classList.add('open');
      document.body.style.overflow = 'hidden';
      getAudioContext();
    }
  }

  // Đóng hộp thoại Modal
  function closeReminderModal() {
    if (reminderModal) {
      reminderModal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Trạng thái vận hành của bộ hẹn giờ
  var timerInterval = null;
  var isRunning = false;
  var isPaused = false;
  var selectedMinutes = 45; // Mặc định 45 phút mỗi hiệp
  var remainingSeconds = selectedMinutes * 60;
  var targetCount = 3; // Mặc định 3 lần nhắc / ngày
  var dailyCompleted = 0;

  // Lấy chuỗi ngày hôm nay YYYY-MM-DD để quản lý tiến độ
  function getTodayString() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  // Tải trạng thái đã lưu từ localStorage
  function loadSavedState() {
    try {
      var savedDate = localStorage.getItem('corua_today_date');
      var today = getTodayString();

      // Nếu sang ngày mới: Đặt lại số cữ tập hoàn thành về 0
      if (savedDate !== today) {
        localStorage.setItem('corua_today_date', today);
        localStorage.setItem('corua_daily_completed', '0');
        dailyCompleted = 0;
      } else {
        dailyCompleted = parseInt(localStorage.getItem('corua_daily_completed') || '0', 10);
      }

      var savedTarget = localStorage.getItem('corua_target_count');
      if (savedTarget) {
        targetCount = parseInt(savedTarget, 10);
        updateActivePill(countPills, 'data-count', targetCount);
      }

      var savedMin = localStorage.getItem('corua_duration_min');
      if (savedMin) {
        var parsedMin = parseFloat(savedMin);
        if (parsedMin < 1) {
          // Xóa bỏ giá trị 10s test cũ, đưa về mặc định 45 phút
          parsedMin = 45;
          localStorage.setItem('corua_duration_min', '45');
        }
        selectedMinutes = parsedMin;
        remainingSeconds = Math.round(selectedMinutes * 60);
        updateActivePill(durationPills, 'data-min', selectedMinutes);
      }
    } catch (err) {
      console.warn('LocalStorage không khả dụng:', err);
    }
    updateDisplay();
    updateProgressUI();
    updateNotifBadge();
  }

  // Cập nhật trạng thái hiển thị nút chọn (Pills)
  function updateActivePill(pillList, attr, value) {
    pillList.forEach(function (btn) {
      var btnVal = parseFloat(btn.getAttribute(attr));
      if (btnVal === parseFloat(value)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Định dạng giây thành mm:ss
  function formatTime(totalSec) {
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Cập nhật hiển thị số đồng hồ và badge nút nổi
  function updateDisplay() {
    if (digitsEl) digitsEl.textContent = formatTime(remainingSeconds);
    if (floatBadge) {
      if (isRunning) {
        floatBadge.textContent = formatTime(remainingSeconds);
      } else {
        floatBadge.textContent = selectedMinutes + 'm';
      }
    }
  }

  // Cập nhật thanh tiến độ trong ngày
  function updateProgressUI() {
    if (dailyDisplay) {
      dailyDisplay.textContent = dailyCompleted + ' / ' + targetCount + ' lần';
    }
    var pct = Math.min(100, Math.round((dailyCompleted / targetCount) * 100));
    if (dailyFill) {
      dailyFill.style.width = pct + '%';
    }
    if (dailyPraise) {
      if (dailyCompleted >= targetCount) {
        dailyPraise.style.display = 'block';
      } else {
        dailyPraise.style.display = 'none';
      }
    }
  }

  // =========================================================================
  // 3. ÂM THANH CHUÔNG BÁO VỚI WEB AUDIO API (KHÔNG CẦN TẢI FILE MP3 NGOÀI)
  // =========================================================================
  var audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Phát âm thanh chuông "Ding-Dong" trong trẻo, êm dịu
  function playChimeSound() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;

      var now = ctx.currentTime;

      // Nốt 1 (Ding) - Tần số 659.25Hz (E5)
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.9);

      // Nốt 2 (Dong) - Tần số 880Hz (A5)
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.25);
      gain2.gain.setValueAtTime(0, now + 0.25);
      gain2.gain.linearRampToValueAtTime(0.35, now + 0.29);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.4);
    } catch (err) {
      console.warn('Lỗi phát âm thanh chuông:', err);
    }
  }

  // =========================================================================
  // 4. QUẢN LÝ THÔNG BÁO TRÌNH DUYỆT (WEB NOTIFICATION API)
  // =========================================================================
  function updateNotifBadge() {
    if (!notifStatusBadge || !notifPermText) return;
    if (!('Notification' in window)) {
      notifPermText.textContent = 'Trình duyệt không hỗ trợ';
      notifStatusBadge.className = 'notif-badge';
      return;
    }
    if (Notification.permission === 'granted') {
      notifPermText.textContent = 'Đã sẵn sàng';
      notifStatusBadge.className = 'notif-badge active';
    } else if (Notification.permission === 'denied') {
      notifPermText.textContent = 'Đã bị tắt';
      notifStatusBadge.className = 'notif-badge';
    } else {
      notifPermText.textContent = 'Chưa kích hoạt';
      notifStatusBadge.className = 'notif-badge';
    }
  }

  // Yêu cầu quyền thông báo khi người dùng bắt đầu hẹn giờ
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(function () {
        updateNotifBadge();
      });
    }
  }

  // Gửi thông báo đẩy khi hoàn thành một hiệp
  function sendBreakNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      var options = {
        body: 'Đã hoàn thành phiên tập trung! Hãy nghỉ 2–3 phút, thực hiện bài tập thu cằm (Chin tuck) và thả lỏng vai nhé.',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"%3E%3Ccircle cx="15" cy="15" r="14" fill="%231f5c55"/%3E%3Cpath d="M15 6v18M11 10h8M11 15h8M11 20h8" stroke="%23f6f1e7" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
        tag: 'corua-break-reminder',
        renotify: true,
      };
      try {
        var notif = new Notification('Đến giờ giải lao & giãn cơ cổ!', options);
        notif.onclick = function () {
          window.focus();
          var exerciseSec = document.getElementById('he-thong-bai-tap') || document.getElementById('bai-tap');
          if (exerciseSec) exerciseSec.scrollIntoView({ behavior: 'smooth' });
          notif.close();
        };
      } catch (err) {
        console.warn('Không thể gửi Notification:', err);
      }
    }
  }

  // =========================================================================
  // 5. ĐIỀU KHIỂN BỘ ĐẾM GIỜ (TIMER LOGIC)
  // =========================================================================

  // Bắt đầu hoặc tiếp tục phiên đếm ngược
  function startTimer() {
    getAudioContext(); // Kích hoạt AudioContext
    requestNotificationPermission(); // Xin quyền thông báo nếu chưa có

    if (!isRunning) {
      isRunning = true;
      isPaused = false;
      recordActivity('Bật hẹn giờ', (selectedMinutes < 1 ? '10 giây' : selectedMinutes + ' phút') + ' (mục tiêu ' + targetCount + ' lần)');
    } else if (isPaused) {
      isPaused = false;
    }

    if (btnStart) btnStart.style.display = 'none';
    if (btnPause) btnPause.style.display = 'inline-flex';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (digitsEl) digitsEl.classList.add('ticking');
    if (statusTextEl) statusTextEl.textContent = 'Đang tập trung học tập...';

    clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      if (!isPaused && remainingSeconds > 0) {
        remainingSeconds--;
        updateDisplay();

        if (remainingSeconds === 0) {
          handleTimeUp();
        }
      }
    }, 1000);
  }

  var btnCancel = document.getElementById('btn-timer-cancel');
  var autoNextTimeout = null;

  // Tạm dừng bộ đếm
  function pauseTimer() {
    isPaused = true;
    if (btnStart) {
      btnStart.style.display = 'inline-flex';
      if (btnStartLabel) btnStartLabel.textContent = 'Tiếp tục';
    }
    if (btnPause) btnPause.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (digitsEl) digitsEl.classList.remove('ticking');
    if (statusTextEl) statusTextEl.textContent = 'Đang tạm dừng';
  }

  // Hủy hoàn toàn phiên hẹn giờ đang chạy
  function cancelTimer() {
    clearInterval(timerInterval);
    clearTimeout(autoNextTimeout);
    isRunning = false;
    isPaused = false;
    remainingSeconds = Math.round(selectedMinutes * 60);

    if (btnStart) {
      btnStart.style.display = 'inline-flex';
      if (btnStartLabel) btnStartLabel.textContent = 'Bắt đầu phiên học';
    }
    if (btnPause) btnPause.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    if (digitsEl) digitsEl.classList.remove('ticking');
    if (statusTextEl) statusTextEl.textContent = 'Đã hủy phiên hẹn giờ';
    updateDisplay();
  }

  // Đặt lại thời gian về ban đầu
  function resetTimer() {
    clearInterval(timerInterval);
    clearTimeout(autoNextTimeout);
    isRunning = false;
    isPaused = false;
    remainingSeconds = Math.round(selectedMinutes * 60);

    if (btnStart) {
      btnStart.style.display = 'inline-flex';
      if (btnStartLabel) btnStartLabel.textContent = 'Bắt đầu phiên học';
    }
    if (btnPause) btnPause.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    if (digitsEl) digitsEl.classList.remove('ticking');
    if (statusTextEl) statusTextEl.textContent = 'Sẵn sàng đếm ngược';
    updateDisplay();
  }

  var chkAutoRepeat = document.getElementById('chk-auto-repeat');

  // Xử lý khi hết giờ: Phát chuông, gửi thông báo và ghi nhận tiến độ
  function handleTimeUp() {
    clearInterval(timerInterval);
    clearTimeout(autoNextTimeout);
    isRunning = false;
    isPaused = false;

    // Phát chuông báo và gửi thông báo
    playChimeSound();
    sendBreakNotification();

    // Tăng số cữ hoàn thành trong ngày
    dailyCompleted++;
    try {
      localStorage.setItem('corua_daily_completed', String(dailyCompleted));
    } catch (err) {}
    updateProgressUI();
    recordActivity('Hoàn thành hiệp', 'Lần ' + dailyCompleted + '/' + targetCount);

    if (digitsEl) digitsEl.classList.remove('ticking');

    // Kiểm tra xem đã đạt đủ số lần mong muốn trong ngày chưa
    if (dailyCompleted >= targetCount) {
      if (statusTextEl) statusTextEl.textContent = '🎉 Bạn đã hoàn thành đủ số lần giải lao hôm nay!';
      if (btnStart) {
        btnStart.style.display = 'inline-flex';
        if (btnStartLabel) btnStartLabel.textContent = 'Bắt đầu hiệp thêm';
      }
      if (btnPause) btnPause.style.display = 'none';
      if (btnCancel) btnCancel.style.display = 'none';
      remainingSeconds = Math.round(selectedMinutes * 60);
      updateDisplay();
      openReminderModal(); // Mở modal chúc mừng
    } else {
      var isAuto = chkAutoRepeat ? chkAutoRepeat.checked : true;
      if (isAuto) {
        // Chế độ tự động liên hoàn: Tự động đếm tiếp hiệp kế tiếp mà không cần bấm lại
        if (statusTextEl) {
          statusTextEl.textContent = '🔔 Đã xong lần ' + dailyCompleted + '! Tự động đếm lần ' + (dailyCompleted + 1) + '/' + targetCount + ' sau 3 giây...';
        }
        if (btnCancel) btnCancel.style.display = 'inline-flex';
        remainingSeconds = Math.round(selectedMinutes * 60);
        updateDisplay();

        autoNextTimeout = setTimeout(function () {
          startTimer(); // Tự động bắt đầu hiệp tiếp theo
        }, 3000);
      } else {
        // Chế độ thủ công: Chờ người dùng tự bấm
        if (statusTextEl) statusTextEl.textContent = '🔔 Đã hết giờ! Hãy nghỉ ngơi và tập 2–3 phút nhé.';
        if (btnStart) {
          btnStart.style.display = 'inline-flex';
          if (btnStartLabel) btnStartLabel.textContent = 'Bắt đầu hiệp tiếp theo';
        }
        if (btnPause) btnPause.style.display = 'none';
        if (btnCancel) btnCancel.style.display = 'none';
        remainingSeconds = Math.round(selectedMinutes * 60);
        updateDisplay();
        openReminderModal();
      }
    }
  }

  // =========================================================================
  // 6. GẮN SỰ KIỆN TƯƠNG TÁC GIAO DIỆN & MODAL
  // =========================================================================

  // Mở Modal từ Banner Section 04
  if (btnOpenBanner) {
    btnOpenBanner.addEventListener('click', openReminderModal);
  }

  // Mở Modal từ Nút chuông nổi góc phải
  if (floatReminderBtn) {
    floatReminderBtn.addEventListener('click', openReminderModal);
  }

  // Mở Modal từ liên kết Topbar Nav
  if (navReminderLink) {
    navReminderLink.addEventListener('click', function (e) {
      e.preventDefault();
      openReminderModal();
    });
  }

  // Đóng Modal từ nút X
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeReminderModal);
  }

  // Đóng Modal khi bấm vào vùng nền đen mờ bên ngoài
  if (reminderModal) {
    reminderModal.addEventListener('click', function (e) {
      if (e.target === reminderModal) {
        closeReminderModal();
      }
    });
  }

  // Đóng Modal khi bấm phím Escape (ESC)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeReminderModal();
    }
  });

  // Nút Bắt đầu
  if (btnStart) {
    btnStart.addEventListener('click', startTimer);
  }

  // Nút Tạm dừng
  if (btnPause) {
    btnPause.addEventListener('click', pauseTimer);
  }

  // Nút Hủy hoàn toàn phiên hẹn giờ
  if (btnCancel) {
    btnCancel.addEventListener('click', cancelTimer);
  }

  // Nút Đặt lại
  if (btnReset) {
    btnReset.addEventListener('click', resetTimer);
  }

  // Nút Thử chuông
  if (btnTestSound) {
    btnTestSound.addEventListener('click', function () {
      playChimeSound();
      requestNotificationPermission();
    });
  }

  // Chọn thời gian hiệp (30p / 45p / 60p / 10s)
  durationPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var min = parseFloat(this.getAttribute('data-min'));
      selectedMinutes = min;
      updateActivePill(durationPills, 'data-min', min);
      try {
        localStorage.setItem('corua_duration_min', String(min));
      } catch (err) {}

      // Nếu đang chạy thì cập nhật lại hiệp mới
      resetTimer();
    });
  });

  // Chọn mục tiêu số lần trong ngày (1 / 2 / 3 / 4 lần)
  countPills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var count = parseInt(this.getAttribute('data-count'), 10);
      targetCount = count;
      updateActivePill(countPills, 'data-count', count);
      try {
        localStorage.setItem('corua_target_count', String(count));
      } catch (err) {}
      updateProgressUI();
    });
  });

  // =========================================================================
  // 7. HỆ THỐNG THEO DÕI DỮ LIỆU NGƯỜI DÙNG & BẢNG THỐNG KÊ QUẢN TRỊ BÍ MẬT
  // =========================================================================

  // Xác định loại thiết bị truy cập (Mobile hay Desktop)
  function getDeviceType() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS (iPhone/iPad)';
    if (/macintosh|mac os x/i.test(ua)) return 'MacOS';
    if (/windows/i.test(ua)) return 'Windows';
    return 'Desktop/Khác';
  }

  // Định dạng thời gian hiện tại DD/MM/YYYY HH:mm:ss
  function getFormattedTimestamp() {
    var now = new Date();
    var d = String(now.getDate()).padStart(2, '0');
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var y = now.getFullYear();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    return d + '/' + m + '/' + y + ' ' + hh + ':' + mm + ':' + ss;
  }

  // Ghi nhận một sự kiện hoạt động vào bộ nhớ trình duyệt (localStorage)
  function recordActivity(actionName, detailText) {
    try {
      // 1. Cập nhật bảng tổng hợp số lần (Summary Stats)
      var stats = JSON.parse(localStorage.getItem('corua_analytics_stats') || '{}');
      if (!stats.pageviews) stats.pageviews = 0;
      if (!stats.video_posture) stats.video_posture = 0;
      if (!stats.video_exercise) stats.video_exercise = 0;
      if (!stats.timer_starts) stats.timer_starts = 0;
      if (!stats.timer_completed) stats.timer_completed = 0;
      if (!stats.cal_adds) stats.cal_adds = 0;

      if (actionName === 'Truy cập trang') stats.pageviews++;
      else if (actionName === 'Xem Video 30s') stats.video_posture++;
      else if (actionName === 'Xem Video 60s') stats.video_exercise++;
      else if (actionName === 'Bật hẹn giờ') stats.timer_starts++;
      else if (actionName === 'Hoàn thành hiệp') stats.timer_completed++;
      else if (actionName === 'Thêm Calendar') stats.cal_adds++;

      localStorage.setItem('corua_analytics_stats', JSON.stringify(stats));

      // 2. Cập nhật nhật ký danh sách sự kiện chi tiết (Tối đa 150 log gần nhất)
      var logs = JSON.parse(localStorage.getItem('corua_analytics_logs') || '[]');
      logs.unshift({
        time: getFormattedTimestamp(),
        device: getDeviceType(),
        action: actionName,
        detail: detailText || ''
      });
      if (logs.length > 150) logs.pop();
      localStorage.setItem('corua_analytics_logs', JSON.stringify(logs));
    } catch (err) {
      console.warn('Lỗi ghi dữ liệu thống kê:', err);
    }
  }

  // Tự động ghi nhận lượt truy cập trang web (Pageview)
  if (!sessionStorage.getItem('corua_session_tracked')) {
    recordActivity('Truy cập trang', 'Phiên truy cập trang web');
    sessionStorage.setItem('corua_session_tracked', '1');
  }

  // Gắn theo dõi lượt tương tác trên khung Video 1 (30s Tư thế ngồi)
  var postureVideoFrame = document.querySelector('#tu-the .video-frame');
  if (postureVideoFrame) {
    var postureTracked = false;
    postureVideoFrame.addEventListener('click', function () {
      if (!postureTracked) {
        recordActivity('Xem Video 30s', 'Tư thế ngồi chuẩn và thói quen dùng điện thoại');
        postureTracked = true;
      }
    });
  }

  // Gắn theo dõi lượt tương tác trên khung Video 2 (60s Bài tập)
  var exerciseVideoFrame = document.querySelector('#bai-tap .video-frame');
  if (exerciseVideoFrame) {
    var exerciseTracked = false;
    exerciseVideoFrame.addEventListener('click', function () {
      if (!exerciseTracked) {
        recordActivity('Xem Video 60s', 'Chuỗi bài tập vật lý trị liệu cổ vai gáy');
        exerciseTracked = true;
      }
    });
  }

  // Gắn theo dõi lượt bấm nút thêm Google Calendar
  document.querySelectorAll('.cal-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      recordActivity('Thêm Calendar', 'Đồng bộ lịch nhắc tập vào Google Calendar');
    });
  });

  // =========================================================================
  // 8. ĐIỀU KHIỂN BẢNG THỐNG KÊ QUẢN TRỊ BÍ MẬT (ADMIN STATS DASHBOARD)
  // =========================================================================
  var adminModal = document.getElementById('admin-modal');
  var btnCloseAdmin = document.getElementById('admin-modal-close-btn');
  var btnCloseAdminBottom = document.getElementById('btn-close-admin-bottom');
  var btnExportCSV = document.getElementById('btn-export-csv');
  var btnResetStats = document.getElementById('btn-reset-stats');
  var adminSecretTrigger = document.getElementById('admin-secret-trigger');

  // Đổ dữ liệu từ localStorage lên bảng điều khiển Admin Modal
  function renderAdminDashboard() {
    try {
      var stats = JSON.parse(localStorage.getItem('corua_analytics_stats') || '{}');
      var logs = JSON.parse(localStorage.getItem('corua_analytics_logs') || '[]');

      var elPageviews = document.getElementById('stat-pageviews');
      var elVideoPosture = document.getElementById('stat-video-posture');
      var elVideoExercise = document.getElementById('stat-video-exercise');
      var elTimerStarts = document.getElementById('stat-timer-starts');
      var elTimerCompleted = document.getElementById('stat-timer-completed');
      var elCalAdds = document.getElementById('stat-cal-adds');
      var elQuizTests = document.getElementById('stat-quiz-tests');
      var elShares = document.getElementById('stat-shares');
      var logCountText = document.getElementById('log-count-text');
      var tbody = document.getElementById('admin-log-tbody');

      if (elPageviews) elPageviews.textContent = stats.pageviews || 0;
      if (elVideoPosture) elVideoPosture.textContent = stats.video_posture || 0;
      if (elVideoExercise) elVideoExercise.textContent = stats.video_exercise || 0;
      if (elTimerStarts) elTimerStarts.textContent = stats.timer_starts || 0;
      if (elTimerCompleted) elTimerCompleted.textContent = stats.timer_completed || 0;
      if (elCalAdds) elCalAdds.textContent = stats.cal_adds || 0;
      if (elQuizTests) elQuizTests.textContent = stats.quiz_tests || 0;
      if (elShares) elShares.textContent = stats.shares || 0;
      if (logCountText) logCountText.textContent = logs.length + ' sự kiện gần nhất';

      if (tbody) {
        if (logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">Chưa có dữ liệu nào được ghi nhận.</td></tr>';
        } else {
          tbody.innerHTML = logs
            .map(function (log) {
              return (
                '<tr>' +
                '<td style="white-space:nowrap;font-family:monospace">' + log.time + '</td>' +
                '<td>' + log.device + '</td>' +
                '<td><strong style="color:var(--teal)">' + log.action + '</strong></td>' +
                '<td>' + (log.detail || '—') + '</td>' +
                '</tr>'
              );
            })
            .join('');
        }
      }
    } catch (err) {
      console.warn('Lỗi hiển thị dữ liệu Admin:', err);
    }
  }

  // Mở Bảng Quản Trị Bí Mật
  function openAdminModal() {
    if (adminModal) {
      renderAdminDashboard();
      adminModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  // Đóng Bảng Quản Trị Bí Mật
  function closeAdminModal() {
    if (adminModal) {
      adminModal.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Kích hoạt bí mật: Bấm nhanh 3 lần liên tiếp trong 800ms vào chân trang (Footer)
  var secretClickCount = 0;
  var secretClickTimer = null;
  if (adminSecretTrigger) {
    adminSecretTrigger.addEventListener('click', function () {
      secretClickCount++;
      clearTimeout(secretClickTimer);
      if (secretClickCount >= 3) {
        secretClickCount = 0;
        openAdminModal();
      } else {
        secretClickTimer = setTimeout(function () {
          secretClickCount = 0;
        }, 800);
      }
    });
  }

  // Kích hoạt bí mật: Phím tắt bàn phím Ctrl + Shift + A (hoặc Cmd + Shift + A)
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      if (adminModal && adminModal.classList.contains('open')) {
        closeAdminModal();
      } else {
        openAdminModal();
      }
    }
  });

  // Sự kiện đóng bảng quản trị
  if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', closeAdminModal);
  if (btnCloseAdminBottom) btnCloseAdminBottom.addEventListener('click', closeAdminModal);
  if (adminModal) {
    adminModal.addEventListener('click', function (e) {
      if (e.target === adminModal) closeAdminModal();
    });
  }

  // Xuất file CSV báo cáo số liệu (Tương thích 100% với Excel tiếng Việt nhờ UTF-8 BOM)
  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', function () {
      try {
        var stats = JSON.parse(localStorage.getItem('corua_analytics_stats') || '{}');
        var logs = JSON.parse(localStorage.getItem('corua_analytics_logs') || '[]');

        var csv = '\uFEFF'; // BOM UTF-8 để Microsoft Excel không lỗi tiếng Việt

        // Phần 1: Bảng tổng hợp
        csv += 'BÁO CÁO THỐNG KÊ HOẠT ĐỘNG NGƯỜI DÙNG - HỘI CHỨNG CỔ RÙA\n';
        csv += 'Thời gian xuất file: ' + getFormattedTimestamp() + '\n\n';
        csv += 'Chỉ số,Số lượng\n';
        csv += 'Tổng lượt truy cập trang,' + (stats.pageviews || 0) + '\n';
        csv += 'Lượt xem Video 30s (Tư thế ngồi),' + (stats.video_posture || 0) + '\n';
        csv += 'Lượt xem Video 60s (Bài tập y khoa),' + (stats.video_exercise || 0) + '\n';
        csv += 'Số lần bật hẹn giờ học tập,' + (stats.timer_starts || 0) + '\n';
        csv += 'Số hiệp bài tập hoàn thành,' + (stats.timer_completed || 0) + '\n';
        csv += 'Lượt thêm vào Google Calendar,' + (stats.cal_adds || 0) + '\n';
        csv += 'Lượt làm bài test nguy cơ (Quiz),' + (stats.quiz_tests || 0) + '\n';
        csv += 'Lượt chia sẻ tài liệu cộng đồng,' + (stats.shares || 0) + '\n\n';

        // Phần 2: Nhật ký chi tiết
        csv += 'NHẬT KÝ CHI TIẾT TỪNG TƯƠNG TÁC\n';
        csv += 'STT,Thời gian,Thiết bị,Hành động,Chi tiết\n';
        logs.forEach(function (log, index) {
          csv += (index + 1) + ',"' + log.time + '","' + log.device + '","' + log.action + '","' + (log.detail || '').replace(/"/g, '""') + '"\n';
        });

        // Tạo thẻ liên kết tải file về máy
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'bao_cao_thong_ke_co_rua.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert('Lỗi xuất file CSV: ' + err.message);
      }
    });
  }

  // Đặt lại dữ liệu (Reset Stats)
  if (btnResetStats) {
    btnResetStats.addEventListener('click', function () {
      var ok = confirm('Bạn có chắc chắn muốn xóa toàn bộ số liệu thống kê để bắt đầu đo lường lại từ đầu không?');
      if (ok) {
        localStorage.removeItem('corua_analytics_stats');
        localStorage.removeItem('corua_analytics_logs');
        renderAdminDashboard();
        alert('Đã đặt lại toàn bộ số liệu thống kê về 0!');
      }
    });
  }

  // =========================================================================
  // MODULE TRẮC NGHIỆM ĐÁNH GIÁ NGUY CƠ CỔ RÙA (1 PHÚT)
  // =========================================================================
  var quizQuestions = [
    {
      q: '1. Trung bình mỗi ngày bạn dùng máy tính và điện thoại bao lâu?',
      options: [
        { text: 'Dưới 3 giờ / ngày (Ít dùng)', score: 0 },
        { text: 'Từ 3 đến 5 giờ / ngày (Trung bình)', score: 1 },
        { text: 'Trên 5 giờ / ngày (Thường xuyên)', score: 3 }
      ]
    },
    {
      q: '2. Bạn có hay thấy mỏi cổ, căng vai gáy hoặc đau đầu sau ca học không?',
      options: [
        { text: 'Hiếm khi hoặc gần như không bao giờ', score: 0 },
        { text: 'Thỉnh thoảng sau những đợt ôn thi căng thẳng', score: 1 },
        { text: 'Thường xuyên, hầu như ngày nào cũng bị mỏi', score: 3 }
      ]
    },
    {
      q: '3. Khi đứng tự nhiên dựa lưng vào tường, sau đầu bạn có chạm tường dễ dàng?',
      options: [
        { text: 'Chạm tường tự nhiên thoải mái', score: 0 },
        { text: 'Chạm được nhưng phải ngửa cổ gượng gạo', score: 2 },
        { text: 'Khó chạm hoặc đầu chồm hẳn ra phía trước', score: 3 }
      ]
    },
    {
      q: '4. Khi học với laptop, bạn có kê cao màn hình ngang tầm mắt không?',
      options: [
        { text: 'Có giá đỡ kê cao màn hình ngang tầm mắt', score: 0 },
        { text: 'Thỉnh thoảng kê cao bằng chồng sách', score: 1 },
        { text: 'Đặt thẳng trên bàn và luôn cúi nhìn xuống', score: 3 }
      ]
    }
  ];

  var currentQuizIndex = 0;
  var quizTotalScore = 0;

  var quizContainer = document.getElementById('quiz-container');
  var quizProgressFill = document.getElementById('quiz-progress-fill');
  var quizStepTag = document.getElementById('quiz-step-tag');
  var quizQuestionText = document.getElementById('quiz-question-text');
  var quizOptionsGroup = document.getElementById('quiz-options-group');
  var quizResultBox = document.getElementById('quiz-result-box');
  var quizResultBadge = document.getElementById('quiz-result-badge');
  var quizResultTitle = document.getElementById('quiz-result-title');
  var quizResultDesc = document.getElementById('quiz-result-desc');
  var btnQuizRetry = document.getElementById('btn-quiz-retry');

  function renderQuizQuestion() {
    if (!quizContainer || !quizOptionsGroup) return;

    var cur = quizQuestions[currentQuizIndex];
    if (quizStepTag) quizStepTag.textContent = 'Câu hỏi ' + (currentQuizIndex + 1) + ' / ' + quizQuestions.length;
    if (quizQuestionText) quizQuestionText.textContent = cur.q;

    var pct = Math.round(((currentQuizIndex + 1) / quizQuestions.length) * 100);
    if (quizProgressFill) quizProgressFill.style.width = pct + '%';

    quizOptionsGroup.innerHTML = cur.options
      .map(function (opt) {
        return '<button type="button" class="quiz-opt-btn" data-score="' + opt.score + '">' + opt.text + '</button>';
      })
      .join('');

    // Gắn sự kiện chọn đáp án
    var optBtns = quizOptionsGroup.querySelectorAll('.quiz-opt-btn');
    optBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var score = parseInt(this.getAttribute('data-score'), 10);
        quizTotalScore += score;
        currentQuizIndex++;

        if (currentQuizIndex < quizQuestions.length) {
          renderQuizQuestion();
        } else {
          showQuizResult();
        }
      });
    });
  }

  function showQuizResult() {
    if (quizContainer) quizContainer.style.display = 'none';
    if (quizResultBox) quizResultBox.style.display = 'block';

    var level = 'safe';
    var title = 'Cột sống cổ khỏe mạnh (Nguy cơ thấp)';
    var desc = 'Tư thế và thói quen sinh hoạt của bạn đang rất tốt! Hãy tiếp tục duy trì việc giải lao sau mỗi 45 phút học tập để bảo vệ cột sống lâu dài.';

    if (quizTotalScore >= 8) {
      level = 'danger';
      title = 'Cảnh báo: Nguy cơ cao mắc Hội chứng cổ rùa';
      desc = 'Bạn đang có nhiều dấu hiệu điển hình của cổ rùa và chịu tải trọng lớn lên cột sống cổ. Hãy bắt đầu ngay với 9 bài tập phục hồi y tế bên dưới và dùng giá đỡ nâng màn hình laptop!';
    } else if (quizTotalScore >= 4) {
      level = 'warn';
      title = 'Lưu ý: Bắt đầu có dấu hiệu quá tải cổ vai gáy';
      desc = 'Cơ cổ của bạn đang có xu hướng bị căng cứng do thói quen nhìn màn hình. Hãy bật chuông nhắc nhở hẹn giờ 45 phút và tập các bài kéo giãn nhẹ mỗi ngày.';
    }

    if (quizResultBadge) {
      quizResultBadge.className = 'quiz-result-badge ' + level;
      quizResultBadge.textContent = 'KẾT QUẢ ĐÁNH GIÁ: ' + quizTotalScore + ' / 12 ĐIỂM';
    }
    if (quizResultTitle) quizResultTitle.textContent = title;
    if (quizResultDesc) quizResultDesc.textContent = desc;

    // Ghi nhận sự kiện vào Admin Analytics
    trackEvent('Làm bài test nguy cơ', 'Kết quả: ' + title + ' (' + quizTotalScore + ' điểm)');
    var stats = getSavedStats();
    stats.quiz_tests = (stats.quiz_tests || 0) + 1;
    saveStats(stats);
  }

  // Nút làm lại bài test
  if (btnQuizRetry) {
    btnQuizRetry.addEventListener('click', function () {
      currentQuizIndex = 0;
      quizTotalScore = 0;
      if (quizResultBox) quizResultBox.style.display = 'none';
      if (quizContainer) quizContainer.style.display = 'block';
      renderQuizQuestion();
    });
  }

  // Khởi chạy câu hỏi đầu tiên
  renderQuizQuestion();

  // =========================================================================
  // MODULE CHIA SẺ TRUYỀN THÔNG CỘNG ĐỒNG (ZALO / FB / COPY LINK)
  // =========================================================================
  var btnShareCopy = document.getElementById('btn-share-copy');
  var btnShareZalo = document.getElementById('btn-share-zalo');
  var btnShareFb = document.getElementById('btn-share-fb');

  // Tạo Toast popup thông báo nổi
  var toastEl = document.createElement('div');
  toastEl.className = 'toast-msg';
  toastEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5cdb95" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Đã sao chép liên kết trang web vào bộ nhớ tạm!</span>';
  document.body.appendChild(toastEl);

  function showToast(text) {
    if (text) toastEl.querySelector('span').textContent = text;
    toastEl.classList.add('show');
    setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2800);
  }

  function trackShareAction(channel) {
    trackEvent('Chia sẻ tài liệu', 'Kênh: ' + channel);
    var stats = getSavedStats();
    stats.shares = (stats.shares || 0) + 1;
    saveStats(stats);
  }

  // Sao chép liên kết
  if (btnShareCopy) {
    btnShareCopy.addEventListener('click', function () {
      var currentUrl = window.location.href.split('#')[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentUrl).then(function () {
          showToast('Đã sao chép link trang web! Hãy dán gửi cho bạn bè.');
          trackShareAction('Sao chép liên kết');
        });
      } else {
        // Fallback cho trình duyệt cũ
        var dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = currentUrl;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        showToast('Đã sao chép link trang web!');
        trackShareAction('Sao chép liên kết (Fallback)');
      }
    });
  }

  // Đóng/mở Popover Menu chia sẻ ở Footer
  var footerShareTrigger = document.getElementById('footer-share-trigger');
  var footerShareMenu = document.getElementById('footer-share-menu');
  var btnShareMessenger = document.getElementById('btn-share-messenger');

  if (footerShareTrigger && footerShareMenu) {
    footerShareTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      footerShareMenu.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!footerShareMenu.contains(e.target) && e.target !== footerShareTrigger) {
        footerShareMenu.classList.remove('open');
      }
    });
  }

  // Hàm mở cửa sổ Popup nhỏ ở chính giữa màn hình (tránh mở tab mới)
  function openPopupCenter(url, title, w, h) {
    var dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    var dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

    var left = width / 2 - w / 2 + dualScreenLeft;
    var top = height / 2 - h / 2 + dualScreenTop;
    var newWindow = window.open(
      url,
      title,
      'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=' +
        w +
        ', height=' +
        h +
        ', top=' +
        top +
        ', left=' +
        left
    );
    if (window.focus && newWindow) newWindow.focus();
    return newWindow;
  }

  // Chia sẻ Zalo
  if (btnShareZalo) {
    btnShareZalo.addEventListener('click', function (e) {
      e.preventDefault();
      var currentUrl = encodeURIComponent('https://phongnguahoichungcorua.netlify.app');
      var zaloUrl = 'https://zalo.me/share?url=' + currentUrl;
      openPopupCenter(zaloUrl, 'Chia sẻ qua Zalo', 560, 520);
      if (footerShareMenu) footerShareMenu.classList.remove('open');
      trackShareAction('Zalo');
    });
  }

  // Chia sẻ Facebook
  if (btnShareFb) {
    btnShareFb.addEventListener('click', function (e) {
      e.preventDefault();
      var currentUrl = encodeURIComponent('https://phongnguahoichungcorua.netlify.app');
      var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + currentUrl;
      openPopupCenter(fbUrl, 'Chia sẻ qua Facebook', 600, 560);
      if (footerShareMenu) footerShareMenu.classList.remove('open');
      trackShareAction('Facebook');
    });
  }

  // Chia sẻ Messenger
  if (btnShareMessenger) {
    btnShareMessenger.addEventListener('click', function (e) {
      e.preventDefault();
      var currentUrl = encodeURIComponent('https://phongnguahoichungcorua.netlify.app');
      var messUrl = 'https://www.facebook.com/dialog/send?link=' + currentUrl + '&app_id=291494419107518&redirect_uri=' + currentUrl;
      openPopupCenter(messUrl, 'Gửi qua Messenger', 600, 560);
      if (footerShareMenu) footerShareMenu.classList.remove('open');
      trackShareAction('Messenger');
    });
  }

  // Khởi động trạng thái ban đầu
  loadSavedState();
})();

