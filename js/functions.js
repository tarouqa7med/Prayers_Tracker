// Application Script with Firebase Realtime Sync & Laptop Date/Time Awareness

const PRAYERS = [
        { key: 'fajr', name: 'Al-Fajr' },
        { key: 'dhuhr', name: 'Al-Dhuhr' },
        { key: 'asr', name: 'Al-Asr' },
        { key: 'maghrib', name: 'Al-Maghreb' },
        { key: 'isha', name: 'Al-Esha' }
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

let trackerData = {
        lastUpdated: getTodayISO(),
        days: {}
};

let isInitialLoad = true;

// Real-time listener from Firebase
dbRef.on('value', (snapshot) => {
        const serverData = snapshot.val();
        if (serverData && serverData.days) {
                trackerData = serverData;
                normalizeTrackerData();
                ensureRollingWindow();
                
                // فحص الأوقات والتاريخ الحالي للابتوب وتحديث الفوائت أوتوماتيكياً
                checkAndAutoMissedPrayers();

                renderGrid();
                if (!isInitialLoad) {
                        showToast("Data from the cloud is updated automatically");
                }
        } else {
                // If DB is empty, initialize rolling window and push to Firebase
                ensureRollingWindow();
                syncToFirebase();
        }
        isInitialLoad = false;
}, (error) => {
        console.error("Firebase read error:", error);
        setConnectionErrorStatus();
});

function setConnectionErrorStatus() {
        const dot = document.getElementById('syncStatusDot');
        const text = document.getElementById('syncStatusText');
        if (dot && text) {
                dot.className = "w-3.5 h-3.5 rounded-full bg-rose-500";
                text.innerText = "Cloud connection error";
        }
}

function getTodayISO() {
        const today = new Date();
        return formatDateISO(today);
}

function formatDateISO(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
}

function parseISODate(isoStr) {
        const parts = isoStr.split('-');
        return new Date(parts[0], parts[1] - 1, parts[2]);
}

function ensureRollingWindow() {
        const todayStr = getTodayISO();
        const todayDate = parseISODate(todayStr);

        let keys = Object.keys(trackerData.days).sort();
        if (keys.length === 0) {
                for (let i = 0; i < 7; i++) {
                        const d = new Date(todayDate);
                        d.setDate(todayDate.getDate() + i);
                        const dStr = formatDateISO(d);
                        trackerData.days[dStr] = { fajr: 'none', dhuhr: 'none', asr: 'none', maghrib: 'none', isha: 'none' };
                }
        }
}

function normalizeTrackerData() {
        if (!trackerData.days) trackerData.days = {};
        Object.keys(trackerData.days).forEach(dateKey => {
                const day = trackerData.days[dateKey];
                PRAYERS.forEach(p => {
                        const val = day[p.key];
                        if (val === true || val === 'done' || val === 'true') {
                        day[p.key] = 'done';
                        } else if (val === false || val === 'missed' || val === 'false') {
                        day[p.key] = 'missed';
                        } else {
                        day[p.key] = 'none';
                        }
                });
        });
}

// دالة التحقق الذكي بناءً على تاريخ ووقت اللابتوب الحالي
function checkAndAutoMissedPrayers() {
        const now = new Date(); // يعتمد على توقيت اللابتوب الحالي
        const laptopTodayStr = formatDateISO(now);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeMinutes = currentHour * 60 + currentMinute;

        // الحدود الزمنية التقريبية بالدقائق منذ منتصف الليل لكل صلاة:
        const prayerThresholds = {
                fajr: 400,    // 06:40 AM
                dhuhr: 840,    // 02:00 PM
                asr: 1000,    // 04:40 PM
                maghrib: 1200,    // 08:00 PM
                isha: 1350    // 11:59 PM
        };

        let updated = false;
        const laptopTodayDate = parseISODate(laptopTodayStr);

        Object.keys(trackerData.days).forEach(dateKey => {
                const dayData = trackerData.days[dateKey];
                const dayDate = parseISODate(dateKey);

                if (dayDate < laptopTodayDate) {
                        // الأيام السابقة لتاريخ اللابتوب الحالي: أي صلاة لم تُسجل تحول لـ missed
                        PRAYERS.forEach(p => {
                                if (dayData[p.key] === 'none') {
                                        dayData[p.key] = 'missed';
                                        updated = true;
                                }
                        });
                } else if (dateKey === laptopTodayStr) {
                        // نفس تاريخ اللابتوب الحالي: فحص وقت اللابتوب الحالي مع الصلوات
                        PRAYERS.forEach(p => {
                                if (dayData[p.key] === 'none' && currentTimeMinutes > prayerThresholds[p.key]) {
                                        dayData[p.key] = 'missed';
                                        updated = true;
                                }
                        });
                }
        });

        if (updated) {
                syncToFirebase();
        }
}

// Sync data to Firebase Database
async function syncToFirebase() {
        try {
                trackerData.lastUpdated = getTodayISO();
                await dbRef.set(trackerData);
        } catch (err) {
                console.error("Firebase write error:", err);
                showToast("Cloud saving failed", "error");
        }
}

function isDayFullyCompleted(dayObj) {
        if (!dayObj) return false;
        return PRAYERS.every(p => dayObj[p.key] === 'done');
}

async function forceAddDays() {
        const keys = Object.keys(trackerData.days).sort();
        let baseDate = new Date();
        if (keys.length > 0) {
                const lastKey = keys[keys.length - 1];
                baseDate = parseISODate(lastKey);
                baseDate.setDate(baseDate.getDate() + 1);
        }

        for (let i = 0; i < 7; i++) {
                const d = new Date(baseDate);
                d.setDate(baseDate.getDate() + i);
                const dStr = formatDateISO(d);
                if (!trackerData.days[dStr]) {
                        trackerData.days[dStr] = { fajr: 'none', dhuhr: 'none', asr: 'none', maghrib: 'none', isha: 'none' };
                }
        }

        await syncToFirebase();
        showToast("7 new cloud days added");
}

// Render UI Cards
function renderGrid() {
        const container = document.getElementById('daysGrid');
        const successCard = document.getElementById('allSuccessCard');
        if (!container || !successCard) return;

        container.innerHTML = '';

        const todayStr = getTodayISO();
        const todayDate = parseISODate(todayStr);

        const allDayKeys = Object.keys(trackerData.days).sort();
        let visibleDaysCount = 0;

        allDayKeys.forEach(dateKey => {
                const dayData = trackerData.days[dateKey];
                const dayDate = parseISODate(dateKey);

                const isPast = dayDate < todayDate;
                const isToday = dateKey === todayStr;
                const isComplete = isDayFullyCompleted(dayData);

                // Hide completed days automatically
                if ((isPast && isComplete) || (isToday && isComplete)) {
                        return;
                }

                visibleDaysCount++;
                const isOverdueIncomplete = isPast && !isComplete;

                const dayName = DAY_NAMES[dayDate.getDay()];

                let completedPrayersCount = 0;
                PRAYERS.forEach(p => {
                        if (dayData[p.key] === 'done') completedPrayersCount++;
                });

                let cardBgClass = "bg-white border-slate-200 shadow-sm";
                let badgeBgClass = "bg-emerald-50 text-emerald-800";
                let headerTextClass = "text-slate-800";
                let warningBanner = "";

                if (isOverdueIncomplete) {
                        cardBgClass = "bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/40 shadow-md";
                        badgeBgClass = "bg-rose-200 text-rose-900";
                        headerTextClass = "text-rose-950";
                        warningBanner = `
                                <div class="mb-3 px-3 py-1.5 bg-rose-500/10 border border-rose-300 rounded-xl flex items-center gap-2 text-rose-700 text-[11px] font-bold">
                                        <i class="fa-solid fa-triangle-exclamation text-rose-600 text-xs"></i>
                                        <span>Warning: A previous day had missed prayers that had not yet been completed!</span>
                                </div>
                        `;
                } else if (isToday) {
                        cardBgClass = "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md";
                        badgeBgClass = "bg-emerald-600 text-white";
                }

                const cardHtml = `
                        <div class="prayer-card rounded-2xl p-5 border ${cardBgClass} relative overflow-hidden">
                        ${warningBanner}

                                <!-- Card Header -->
                                <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60">
                                        <div>
                                                <div class="flex items-center gap-2">
                                                        <h3 class="font-extrabold ${headerTextClass} text-base">${dayName}</h3>
                                                        ${isToday ? '<span class="text-[10px] px-2 py-0.5 bg-emerald-600 text-white font-bold rounded-md">Today</span>' : ''}
                                                </div>
                                                <span class="text-xs text-slate-500 block font-semibold mt-0.5">${dateKey}</span>
                                        </div>

                                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${badgeBgClass}">
                                        ${completedPrayersCount} / 5
                                        </span>
                                </div>

                                <!-- Prayers Buttons -->
                                <div class="space-y-2">
                                        ${PRAYERS.map(p => {
                                        const val = dayData[p.key];
                                        const isDone = val === 'done';
                                        const isMissed = val === 'missed';

                                        return `
                                                <div class="flex items-center justify-between p-2 rounded-xl bg-white/80 border border-slate-200/70 hover:bg-white transition">
                                                        <span class="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                ${p.name}
                                                                ${isDone ? '<span class="text-[10px] text-emerald-600 font-bold">(Done)</span>' : ''}
                                                                ${isMissed ? '<span class="text-[10px] text-rose-600 font-bold">(Missed)</span>' : ''}
                                                        </span>
                                                
                                                        <div class="flex items-center gap-2">
                                                                <!-- Done Checkmark Button (✓) -->
                                                                <button onclick="togglePrayer('${dateKey}', '${p.key}', 'done')" 
                                                                        title="Prayer completed (✓)"
                                                                        class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition ${isDone ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400 scale-105' : 'bg-slate-100 border border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'}">
                                                                        <i class="fa-solid fa-check"></i>
                                                                </button>

                                                                <!-- Missed Cross Button (✗) -->
                                                                <button onclick="togglePrayer('${dateKey}', '${p.key}', 'missed')" 
                                                                        title="Didn't pray / judge (✗)"
                                                                        class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition ${isMissed ? 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-400 scale-105' : 'bg-slate-100 border border-slate-300 text-slate-400 hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50'}">
                                                                        <i class="fa-solid fa-xmark"></i>
                                                                </button>
                                                        </div>
                                                </div>
                                        `;
                                        }).join('')}
                                </div>

                        </div>
                `;

                container.insertAdjacentHTML('beforeend', cardHtml);
        });

        if (visibleDaysCount === 0) {
                successCard.classList.remove('hidden');
        } else {
                successCard.classList.add('hidden');
        }
}

// Toggle Prayer Status & Save instantly to Firebase
async function togglePrayer(dateKey, prayerKey, targetStatus) {
        if (!trackerData.days[dateKey]) return;

        const currentVal = trackerData.days[dateKey][prayerKey];
        if (currentVal === targetStatus) {
                trackerData.days[dateKey][prayerKey] = 'none';
        } else {
                trackerData.days[dateKey][prayerKey] = targetStatus;
        }

        await syncToFirebase();
        showToast("Updated and data saved to the cloud");
}

async function resetAllData() {
        if (confirm("Are you sure you have reset and unloaded all cloud data?")) {
        trackerData = {
                lastUpdated: getTodayISO(),
                days: {}
        };
        ensureRollingWindow();
        await syncToFirebase();
        showToast("Cloud data has been reset successfully");
        }
}

function showToast(message, type = "success") {
        const toast = document.getElementById('toast');
        if (!toast) return;
        const toastMsg = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');

        if (toastMsg) toastMsg.innerText = message;

        if (toastIcon) {
        if (type === "error") {
                toastIcon.className = "fa-solid fa-circle-exclamation text-rose-400 text-lg";
        } else {
                toastIcon.className = "fa-solid fa-circle-check text-emerald-400 text-lg";
        }
        }

        toast.classList.remove('-translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');

        setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-20', 'opacity-0');
        }, 2500);
}