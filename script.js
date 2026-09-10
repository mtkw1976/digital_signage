/**
 * =========================================================
 * Smart Signage Dashboard - Main Script
 * iPad Pro (第2世代) 向け ホームサイネージ制御スクリプト
 * =========================================================
 */

/* =========================================================
   【設定エリア】お好みに応じて書き換えてください
   ========================================================= */
const CONFIG = {
  // 1. 天気予報設定 (現在地 & 品川区大崎駅周辺)
  weather: {
    currentLocationName: "", // 空欄時はGPS・逆ジオコーディングで自動地名判別 (例: 品川区)
    // 品川区大崎駅周辺の座標 (緯度 35.6197, 経度 139.7285)
    locations: {
      osaki: { name: "品川区大崎", lat: 35.6197, lon: 139.7285 },
      current: { name: "現在地", lat: 35.6197, lon: 139.7285, isResolved: false }
    },
    activeLocationKey: "current", // デフォルトは "current" (現在地)
    provider: "open-meteo", // 'open-meteo' (APIキー不要で週間・時間予報対応) または 'openweathermap'
    openWeatherApiKey: "YOUR_OPENWEATHER_API_KEY",
    updateIntervalMinutes: 15
  },

  // 2. Googleカレンダー設定
  calendar: {
    // 画面右上の⚙️設定から登録するか、iPadのlocalStorageに保存されます
    embedUrl: "" 
  },

  // 3. Googleマップ (現在位置) 設定
  map: {
    currentLocationUrl: "" // 空欄時は端末のGPSから自動生成。住所やGoogleマップURLも指定可能
  },

  // 4. YouTubeタイル設定 (おすすめ動画 & ウェザーニュース最新Live)
  youtube: {
    defaultMode: "weather", // 'weather' (ウェザーニュースLive) または 'recommend' (おすすめ動画)
    currentMode: "weather", // 実行時モード
    weatherLiveVideoId: "6qpvwEJ7u2k", // 最新ウェザーニュースLive ID (公式エンドポイント動的解決)
    weatherChannelId: "UCvpdUtzQNW6424N00WVPh3A", // ウェザーニュース公式チャンネルID
    isPremium: true,       // YouTube Premium契約 (広告・CM非表示モード)
    googleAccount: "",     // Premium契約のGoogleアカウント (任意: user@gmail.com)
    adFreeMode: true,      // 広告・CM完全排除モード
    genre: "all_mix",      // おすすめ動画ジャンル
    customVideoIds: [],    // ユーザー指定のカスタム動画ID配列
    rotationSeconds: 180,  // 表示時間: 3分 (180秒)
    autoplay: 1,           // 自動再生 (1: 有効)
    mute: 1                // 消音 (1: ミュート ※iOS/Safari自動再生ポリシー対策)
  },

  // 5. 𝕏 ニュース速報 (IT系 & 秋葉原系) 設定
  news: {
    rotationSeconds: 30, // 切り替え間隔(秒)
    activeChannel: "it", // 'it' または 'akiba'
    rssApiBase: "https://api.rss2json.com/v1/api.json?rss_url=",
    // IT・ガジェット・テクノロジー速報 (ギズモード・ジャパン)
    itRssUrl: "https://www.gizmodo.jp/index.xml",
    // 秋葉原・自作PC・セール特価速報 (ASCII.jp)
    akibaRssUrl: "https://ascii.jp/rss.xml",
    refreshIntervalMinutes: 15
  }
};


/* =========================================================
   1. 時計・日付機能 (1秒毎に更新) & GeminiLive タイマー連動
   ========================================================= */
let clockTimerInterval = null;
let clockTimerTotalSeconds = 0;
let clockTimerRemainingSeconds = 0;

function initClock() {
  const dateEl = document.getElementById("date-display");
  const timeEl = document.getElementById("time-display");
  const secondsEl = document.getElementById("seconds-display");

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  function updateClock() {
    const now = new Date();

    // 端末のタイムゾーンや12時間表記設定に左右されず、常に正確な日本時間(JST)の24時間表記を取得
    const jstDateStr = now.toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    });
    const jstTimeStr = now.toLocaleTimeString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const parts = jstTimeStr.split(":");
    const hours = parts[0] === "24" ? "00" : parts[0];
    const minutes = parts[1] || "00";
    const seconds = parts[2] || "00";

    if (dateEl) dateEl.textContent = jstDateStr;
    const hmEl = document.getElementById("hours-minutes-display");
    if (hmEl) {
      hmEl.textContent = `${hours}:${minutes}`;
    } else if (timeEl && timeEl.childNodes[0]) {
      timeEl.childNodes[0].nodeValue = `${hours}:${minutes}`;
    }
    if (secondsEl) {
      secondsEl.textContent = `:${seconds}`;
    }
  }

  updateClock();
  setInterval(updateClock, 1000);

  // タイマーキャンセルボタンのリスナー登録
  const btnCancel = document.getElementById("btn-clock-timer-cancel");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      cancelClockTimer();
    });
  }
}

// タイマー開始 (GeminiLive音声認識連動)
function startClockTimer(seconds, label = "") {
  if (clockTimerInterval) {
    clearInterval(clockTimerInterval);
    clockTimerInterval = null;
  }

  const bannerEl = document.getElementById("clock-timer-banner");
  const countdownEl = document.getElementById("clock-timer-countdown");
  const progressEl = document.getElementById("clock-timer-progress");
  if (!bannerEl || !countdownEl) return;

  clockTimerTotalSeconds = Math.max(1, Math.round(seconds));
  clockTimerRemainingSeconds = clockTimerTotalSeconds;

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  countdownEl.textContent = formatTime(clockTimerRemainingSeconds);
  if (progressEl) progressEl.style.width = "100%";
  bannerEl.classList.remove("hidden");

  clockTimerInterval = setInterval(() => {
    clockTimerRemainingSeconds--;
    if (clockTimerRemainingSeconds > 0) {
      countdownEl.textContent = formatTime(clockTimerRemainingSeconds);
      if (progressEl) {
        const pct = Math.max(0, (clockTimerRemainingSeconds / clockTimerTotalSeconds) * 100);
        progressEl.style.width = `${pct}%`;
      }
    } else {
      // タイマー終了
      clearInterval(clockTimerInterval);
      clockTimerInterval = null;
      countdownEl.textContent = "00:00";
      if (progressEl) progressEl.style.width = "0%";
      onClockTimerFinished(label);
    }
  }, 1000);
}

// タイマーキャンセル
function cancelClockTimer() {
  if (clockTimerInterval) {
    clearInterval(clockTimerInterval);
    clockTimerInterval = null;
  }
  const bannerEl = document.getElementById("clock-timer-banner");
  if (bannerEl) bannerEl.classList.add("hidden");
}

// タイマー終了通知 (アラーム音 + 音声案内)
function onClockTimerFinished(label) {
  const countdownEl = document.getElementById("clock-timer-countdown");
  if (countdownEl) countdownEl.textContent = "🔔 時間です！";

  playTimerAlarmSound();

  const msg = label ? `${label}のタイマーの時間になりました。` : "タイマーの時間になりました。";
  if (window.speechSynthesis) {
    const uttr = new SpeechSynthesisUtterance(msg);
    uttr.lang = "ja-JP";
    uttr.rate = 1.05;
    window.speechSynthesis.speak(uttr);
  }

  // 15秒後に自動でバナーを閉じる
  setTimeout(() => {
    if (!clockTimerInterval) {
      const bannerEl = document.getElementById("clock-timer-banner");
      if (bannerEl) bannerEl.classList.add("hidden");
    }
  }, 15000);
}

// Web Audio API による心地よい電子チャイム音の合成再生 (外部音声ファイル不要)
function playTimerAlarmSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // ピピピッ・ピピピッ (880Hz, 1046Hz, 1318Hz)
    const tones = [
      { f: 880, start: 0.0, dur: 0.12 },
      { f: 1046, start: 0.16, dur: 0.12 },
      { f: 1318, start: 0.32, dur: 0.25 },
      { f: 880, start: 0.8, dur: 0.12 },
      { f: 1046, start: 0.96, dur: 0.12 },
      { f: 1318, start: 1.12, dur: 0.35 }
    ];

    tones.forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(t.f, now + t.start);
      gain.gain.setValueAtTime(0.28, now + t.start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur);
    });
  } catch (err) {
    console.warn("アラーム音再生スキップ:", err);
  }
}

// グローバル公開
window.startClockTimer = startClockTimer;
window.cancelClockTimer = cancelClockTimer;



/* =========================================================
   2. 天気予報機能 (現在地 & 品川区大崎 / 現在・時間・週間天気)
   ========================================================= */
// 逆ジオコーディング (緯度・経度から市区町村名を日本語で解決)
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ja`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    let place = "";
    if (data.locality && data.city && data.city !== "東京都" && !data.city.includes("区")) {
      place = data.city + data.locality;
    } else if (data.locality) {
      place = data.locality;
    } else if (data.city) {
      place = data.city;
    } else if (data.principalSubdivision) {
      place = data.principalSubdivision;
    }
    return place || null;
  } catch (err) {
    console.warn("逆ジオコーディング通信エラー:", err);
    return null;
  }
}

// 現在地の地名バッジ・タイトルを更新
function updateWeatherLocationBadges(placeName) {
  const badgeCurrent = document.getElementById("weather-loc-badge-current");
  if (badgeCurrent && placeName) {
    badgeCurrent.textContent = `📍 ${placeName}`;
  }
  const titleEl = document.getElementById("weather-tile-title");
  if (titleEl && placeName) {
    titleEl.textContent = `天気予報 (${placeName}・大崎)`;
  }
}

// 端末の現在地(Geolocation)の解決 & 地名解決
async function resolveCurrentLocation() {
  // 1. ユーザー手動指定の地名があれば最優先で適用
  if (CONFIG.weather.currentLocationName && CONFIG.weather.currentLocationName.trim()) {
    const customName = CONFIG.weather.currentLocationName.trim();
    CONFIG.weather.locations.current.name = customName;
    updateWeatherLocationBadges(customName);
  }

  if (!navigator.geolocation) {
    console.warn("Geolocation API未対応です。大崎駅をデフォルトにします。");
    return;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        CONFIG.weather.locations.current.lat = lat;
        CONFIG.weather.locations.current.lon = lon;
        CONFIG.weather.locations.current.isResolved = true;
        console.log("現在地座標取得成功:", lat, lon);

        // 手動指定がない場合は逆ジオコーディングで地名を特定
        if (!CONFIG.weather.currentLocationName || !CONFIG.weather.currentLocationName.trim()) {
          try {
            const place = await reverseGeocode(lat, lon);
            if (place) {
              CONFIG.weather.locations.current.name = place;
              updateWeatherLocationBadges(place);
            }
          } catch (e) {
            console.warn("逆ジオコーディング処理例外:", e);
          }
        }
        // 現在地マップを手動URLが未設定の場合に自動更新
        if (typeof setupCurrentLocationMap === "function") {
          setupCurrentLocationMap(CONFIG.map.currentLocationUrl);
        }
        resolve();
      },
      (err) => {
        console.warn("現在地取得スキップ(許可なし/タイムアウト)。大崎駅をデフォルトにします:", err.message);
        if (typeof setupCurrentLocationMap === "function") {
          setupCurrentLocationMap(CONFIG.map.currentLocationUrl);
        }
        resolve();
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  });
}

// 2拠点同時取得用のメイン関数
async function fetchAllWeather() {
  const mainBadge = document.getElementById("weather-updated-main");
  if (mainBadge) mainBadge.textContent = "2拠点更新中...";

  await Promise.allSettled([
    fetchWeatherForLocation("current"),
    fetchWeatherForLocation("osaki")
  ]);

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (mainBadge) mainBadge.textContent = `2拠点同時監視中 (${timeStr}更新)`;
}

// 指定拠点（current または osaki）の天気予報取得・描画
async function fetchWeatherForLocation(locKey) {
  const targetLoc = CONFIG.weather.locations[locKey];
  if (!targetLoc) return;

  const badgeEl = document.getElementById(`weather-updated-${locKey}`);
  const iconEl = document.getElementById(`weather-icon-${locKey}`);
  const tempEl = document.getElementById(`weather-temp-${locKey}`);
  const descEl = document.getElementById(`weather-desc-${locKey}`);
  const popEl = document.getElementById(`weather-pop-${locKey}`);
  const windEl = document.getElementById(`weather-wind-${locKey}`);
  const hourlyEl = document.getElementById(`weather-hourly-${locKey}`);

  if (badgeEl) badgeEl.textContent = "更新中...";

  try {
    // Open-Meteo API (現在 + 時間予報 + 7日間週間予報)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetLoc.lat}&longitude=${targetLoc.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=7`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 1. 現在天気
    const current = data.current;
    const weatherInfo = parseWmoCode(current.weather_code);

    if (tempEl) tempEl.innerHTML = `${Math.round(current.temperature_2m)}<span class="temp-unit">°C</span>`;
    if (iconEl) iconEl.textContent = weatherInfo.icon;
    if (descEl) descEl.textContent = weatherInfo.desc;
    if (windEl) windEl.textContent = `${current.wind_speed_10m}m/s`;

    // 降水確率 (現在時間帯)
    const currentHour = new Date().getHours();
    const pop = (data.hourly && data.hourly.precipitation_probability) ? (data.hourly.precipitation_probability[currentHour] || 0) : 0;
    if (popEl) popEl.textContent = `${pop}%`;

    // 2. 時間天気 (直近3コマ: +2h, +4h, +6h)
    if (hourlyEl && data.hourly) {
      hourlyEl.innerHTML = "";
      const stepHours = [currentHour + 2, currentHour + 4, currentHour + 6];
      
      stepHours.forEach(h => {
        if (h < data.hourly.time.length) {
          const rawTime = data.hourly.time[h];
          const timeLabel = rawTime ? `${new Date(rawTime).getHours()}:00` : `${h % 24}:00`;
          const hTemp = Math.round(data.hourly.temperature_2m[h]);
          const hCode = data.hourly.weather_code[h];
          const hPop = data.hourly.precipitation_probability[h] || 0;
          const hInfo = parseWmoCode(hCode);

          const item = document.createElement("div");
          item.className = "compact-hourly-slot";
          item.innerHTML = `
            <span class="compact-h-time">${timeLabel}</span>
            <span class="compact-h-icon">${hInfo.icon}</span>
            <span class="compact-h-temp">${hTemp}°</span>
            <span class="compact-h-pop">${hPop}%</span>
          `;
          hourlyEl.appendChild(item);
        }
      });
    }

    // 3. 週間天気バー (明日から5日分を確実に描画)
    const weeklyEl = document.getElementById(`weather-weekly-${locKey}`);
    if (weeklyEl && data.daily && data.daily.time) {
      weeklyEl.innerHTML = "";
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
      
      // i = 1 (明日) から 5日間
      for (let i = 1; i <= 5 && i < data.daily.time.length; i++) {
        const d = new Date(data.daily.time[i]);
        const dayIdx = d.getDay();
        const dayName = (i === 1) ? "明日" : (i === 2 ? "明後日" : `${weekdays[dayIdx]}曜`);
        const dayClass = (dayIdx === 0) ? "sunday" : (dayIdx === 6 ? "saturday" : "");
        const maxT = Math.round(data.daily.temperature_2m_max[i]);
        const minT = Math.round(data.daily.temperature_2m_min[i]);
        const dCode = data.daily.weather_code[i];
        const dInfo = parseWmoCode(dCode);

        const item = document.createElement("div");
        item.className = "compact-weekly-slot";
        item.innerHTML = `
          <span class="compact-w-day ${dayClass}">${dayName}</span>
          <span class="compact-w-icon">${dInfo.icon}</span>
          <span class="compact-w-temp"><span class="w-high">${maxT}°</span>/<span class="w-low">${minT}°</span></span>
        `;
        weeklyEl.appendChild(item);
      }
    }

    // 4. 大雨・線状降水帯・気象警報の個別検知
    await checkSevereWeather(locKey, targetLoc, current);

    const now = new Date();
    if (badgeEl) badgeEl.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} 更新`;

  } catch (err) {
    console.error(`天気予報取得エラー (${targetLoc.name}):`, err);
    if (badgeEl) badgeEl.textContent = "取得エラー";
  }
}

// 気象庁 警報・注意報コード辞書 (特別警報・警報・注意報)
const JMA_WARNING_DICT = {
  // 特別警報 (severe)
  "33": { level: "severe", name: "大雨特別警報", icon: "🚨" },
  "35": { level: "severe", name: "暴風特別警報", icon: "🚨" },
  "36": { level: "severe", name: "暴風雪特別警報", icon: "🚨" },
  "37": { level: "severe", name: "大雪特別警報", icon: "🚨" },
  "38": { level: "severe", name: "波浪特別警報", icon: "🚨" },
  "39": { level: "severe", name: "高潮特別警報", icon: "🚨" },

  // 警報 (warning)
  "03": { level: "warning", name: "大雨警報", icon: "⚠️" },
  "04": { level: "warning", name: "洪水警報", icon: "⚠️" },
  "05": { level: "warning", name: "暴風警報", icon: "⚠️" },
  "06": { level: "warning", name: "暴風雪警報", icon: "⚠️" },
  "07": { level: "warning", name: "大雪警報", icon: "⚠️" },
  "08": { level: "warning", name: "波浪警報", icon: "⚠️" },

  // 注意報 (advisory)
  "10": { level: "advisory", name: "大雨注意報", icon: "☔" },
  "12": { level: "advisory", name: "大雪注意報", icon: "❄️" },
  "13": { level: "advisory", name: "風雪注意報", icon: "💨" },
  "14": { level: "advisory", name: "雷注意報", icon: "⚡" },
  "15": { level: "advisory", name: "強風注意報", icon: "💨" },
  "16": { level: "advisory", name: "波浪注意報", icon: "🌊" },
  "17": { level: "advisory", name: "融雪注意報", icon: "💧" },
  "18": { level: "advisory", name: "洪水注意報", icon: "🌊" },
  "19": { level: "advisory", name: "高潮注意報", icon: "🌊" },
  "20": { level: "advisory", name: "濃霧注意報", icon: "🌫️" },
  "21": { level: "advisory", name: "乾燥注意報", icon: "🍂" },
  "22": { level: "advisory", name: "なだれ注意報", icon: "🏔️" },
  "23": { level: "advisory", name: "低温注意報", icon: "🧊" },
  "24": { level: "advisory", name: "霜注意報", icon: "❄️" },
  "25": { level: "advisory", name: "着氷注意報", icon: "🧊" },
  "26": { level: "advisory", name: "着雪注意報", icon: "❄️" }
};

// 緯度経度から都道府県コード(JMA)を判定
function getJmaPrefCode(lat, lon) {
  if (lat >= 35.1 && lat <= 35.65 && lon >= 139.0 && lon <= 139.8) {
    return "140000"; // 神奈川県
  }
  if (lat >= 35.7 && lat <= 36.4 && lon >= 138.8 && lon <= 139.95) {
    return "110000"; // 埼玉県
  }
  if (lat >= 34.9 && lat <= 36.1 && lon >= 139.85 && lon <= 140.9) {
    return "120000"; // 千葉県
  }
  return "130000"; // デフォルト: 東京都
}

// 各ペイン独立の気象警報・線状降水帯判定 (警報・注意報・平常時の完全対応)
async function checkSevereWeather(locKey, targetLoc, currentData) {
  const bannerEl = document.getElementById(`weather-alert-banner-${locKey}`);
  const badgeEl = document.getElementById(`alert-badge-${locKey}`);
  const textEl = document.getElementById(`alert-text-${locKey}`);
  const paneEl = document.getElementById(`pane-weather-${locKey}`);

  if (!bannerEl) return;

  // テスト用強制フラグ (全ペインまたは個別)
  if (window._weatherAlertTestActive) {
    bannerEl.className = "weather-alert-banner warning";
    if (badgeEl) badgeEl.textContent = "⚠️ 大雨警報・線状降水帯警戒";
    if (textEl) textEl.textContent = `【テスト】${targetLoc.name}: 猛烈な雨・土砂災害・河川氾濫に警戒`;
    paneEl?.classList.add("severe-warning");
    return;
  }

  const activeAlerts = []; // { code, level, name, icon, status }

  // 1. 気象庁 警報・注意報 API の取得・解析
  try {
    const prefCode = (locKey === "osaki") ? "130000" : getJmaPrefCode(targetLoc.lat, targetLoc.lon);
    const jmaUrl = `https://www.jma.go.jp/bosai/warning/data/warning/${prefCode}.json`;
    const res = await fetch(jmaUrl);
    if (res.ok) {
      const data = await res.json();
      
      // 対象エリアコードの絞り込み
      let targetAreaCodes = [];
      if (locKey === "osaki") {
        targetAreaCodes = ["1310900", "130010"]; // 品川区 / 東京地方
      } else if (prefCode === "130000") {
        targetAreaCodes = ["130010", "1310900"]; // 東京地方 / 23区
      }

      for (const areaType of data.areaTypes || []) {
        for (const area of areaType.areas || []) {
          const isTargetArea = targetAreaCodes.length === 0 || targetAreaCodes.includes(area.code);
          if (!isTargetArea) continue;

          for (const w of area.warnings || []) {
            if (!w.code || w.status === "解除" || w.status === "発表警報・注意報はなし") continue;
            
            const info = JMA_WARNING_DICT[w.code];
            if (info && !activeAlerts.some(a => a.name === info.name)) {
              activeAlerts.push({
                code: w.code,
                level: info.level,
                name: info.name,
                icon: info.icon,
                status: w.status
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`気象庁APIスキップ (${locKey}):`, err);
  }

  // 2. Open-Meteo データによる極端気象 (猛烈な雨・激しい雷雨・線状降水帯) 検知
  if (currentData) {
    const code = currentData.weather_code;
    if ([65, 82].includes(code)) {
      if (!activeAlerts.some(a => a.name.includes("大雨"))) {
        activeAlerts.push({
          code: "om-65",
          level: "warning",
          name: "猛烈な大雨・線状降水帯警戒",
          icon: "⚠️",
          status: "急激な降雨"
        });
      }
    } else if ([95, 96, 99].includes(code)) {
      if (!activeAlerts.some(a => a.name.includes("雷"))) {
        activeAlerts.push({
          code: "om-95",
          level: "advisory",
          name: "激しい雷雨・突風警戒",
          icon: "⚡",
          status: "急な天候悪化"
        });
      }
    }
  }

  // 3. 優先度判定 (severe > warning > advisory > normal)
  const severes = activeAlerts.filter(a => a.level === "severe");
  const warnings = activeAlerts.filter(a => a.level === "warning");
  const advisories = activeAlerts.filter(a => a.level === "advisory");

  if (severes.length > 0) {
    const highest = severes[0];
    const names = severes.map(a => a.name);
    bannerEl.className = "weather-alert-banner severe";
    if (badgeEl) badgeEl.textContent = `${highest.icon} ${highest.name}`;
    if (textEl) textEl.textContent = `${names.join("・")}が発表されています。命を守る最善の行動をとってください`;
    paneEl?.classList.add("severe-warning");
  } else if (warnings.length > 0) {
    const highest = warnings[0];
    const names = warnings.map(a => a.name);
    bannerEl.className = "weather-alert-banner warning";
    if (badgeEl) badgeEl.textContent = `${highest.icon} ${highest.name}発令中`;
    if (textEl) textEl.textContent = `${names.join("・")}が発表されています。安全確保に留意してください`;
    paneEl?.classList.add("severe-warning");
  } else if (advisories.length > 0) {
    const highest = advisories[0];
    const names = advisories.map(a => a.name);
    bannerEl.className = "weather-alert-banner advisory";
    if (badgeEl) badgeEl.textContent = `${highest.icon} ${highest.name}`;
    if (textEl) textEl.textContent = `${names.join("・")}発表中`;
    paneEl?.classList.remove("severe-warning");
  } else {
    // 平常時: 警報・注意報がない旨を中間部に明示表示（余白を埋めて安心感を提供）
    bannerEl.className = "weather-alert-banner normal";
    if (badgeEl) badgeEl.textContent = "🟢 平常";
    if (textEl) textEl.textContent = "警報・注意報は発表されていません";
    paneEl?.classList.remove("severe-warning");
  }
}

// 警報表示テスト用関数 (バッジタップ等で動作確認可能)
window.toggleWeatherAlertTest = function() {
  window._weatherAlertTestActive = !window._weatherAlertTestActive;
  fetchAllWeather();
};

// Open-Meteo WMOコードから絵文字と天候名を判定
function parseWmoCode(code) {
  if (code === 0) return { icon: "☀️", desc: "快晴" };
  if (code === 1 || code === 2) return { icon: "🌤️", desc: "晴れ時々曇り" };
  if (code === 3) return { icon: "☁️", desc: "曇り" };
  if ([45, 48].includes(code)) return { icon: "🌫️", desc: "霧" };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", desc: "霧雨" };
  if ([61, 63, 65, 66, 67].includes(code)) return { icon: "🌧️", desc: "雨" };
  if ([71, 73, 75, 77].includes(code)) return { icon: "❄️", desc: "雪" };
  if ([80, 81, 82].includes(code)) return { icon: "🌧️", desc: "にわか雨" };
  if ([95, 96, 99].includes(code)) return { icon: "⛈️", desc: "雷雨" };
  return { icon: "☀️", desc: "晴れ" };
}

function getWeatherIconByOwm(iconCode) {
  if (iconCode.includes("01")) return "☀️";
  if (iconCode.includes("02")) return "🌤️";
  if (iconCode.includes("03") || iconCode.includes("04")) return "☁️";
  if (iconCode.includes("09") || iconCode.includes("10")) return "🌧️";
  if (iconCode.includes("11")) return "⛈️";
  if (iconCode.includes("13")) return "❄️";
  if (iconCode.includes("50")) return "🌫️";
  return "☀️";
}


/* =========================================================
   3. Googleカレンダー & 4. Googleマップ 埋め込み制御
   ========================================================= */

// iframeタグの貼り付けなどから純粋なURLのみを抽出・サニタイズ
function extractUrlOrClean(input) {
  if (!input || typeof input !== "string") return "";
  let val = input.trim();
  const iframeMatch = val.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    val = iframeMatch[1];
  }
  return val.trim();
}

// URLまたは住所・座標からiframeに埋め込み可能なURLを生成 (埋め込み不可ならnull)
function getEmbeddableMapUrl(rawUrl) {
  if (!rawUrl) return null;
  const url = extractUrlOrClean(rawUrl);
  const lower = url.toLowerCase();

  // 既にGoogleマップの埋め込み用URL (embed) または output=embed の場合
  if (lower.includes("/maps/embed") || lower.includes("output=embed")) {
    return url;
  }

  // Googleマップの「現在地共有」短縮URLやアプリリンク、iCloud等はiframe描画が制限されているためnull
  if (lower.includes("maps.app.goo.gl") || lower.includes("goo.gl/maps") || lower.includes("icloud.com") || lower.includes("life360.com")) {
    return null;
  }

  // URL内に座標が含まれる場合 (例: @35.6197,139.7285)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return `https://maps.google.com/maps?q=${atMatch[1]},${atMatch[2]}&z=15&output=embed`;
  }
  const qMatch = url.match(/[?&]q=([0-9.,-]+)/);
  if (qMatch) {
    return `https://maps.google.com/maps?q=${qMatch[1]}&z=15&output=embed`;
  }
  const llMatch = url.match(/[?&]ll=([0-9.,-]+)/);
  if (llMatch) {
    return `https://maps.google.com/maps?q=${llMatch[1]}&z=15&output=embed`;
  }

  // 住所または地名、または "35.6197,139.7285" のような平文入力の場合
  if (!url.startsWith("http://") && !url.startsWith("https://") && url.length > 0) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&z=15&output=embed`;
  }

  // 通常のgoogle.com/maps閲覧用URLはiframe制限があるためnull
  if (lower.includes("google.com/maps") || lower.includes("google.co.jp/maps")) {
    return null;
  }

  return url;
}

// 現在位置のマップ表示制御 (iframe描画 または リアルタイム位置連携カード表示)
function setupCurrentLocationMap(rawUrl) {
  const iframe = document.getElementById("map-iframe-current");
  const placeholder = document.getElementById("map-placeholder-current");
  const placeholderText = document.getElementById("map-placeholder-text");
  const liveCard = document.getElementById("map-live-card-current");
  const openLink = document.getElementById("map-open-link-current");
  const badge = document.getElementById("map-loc-name-badge");

  // 1. 手動指定URLまたは住所が指定されている場合
  if (rawUrl && rawUrl.trim() !== "") {
    const url = extractUrlOrClean(rawUrl);
    if (openLink) {
      openLink.href = url.startsWith("http") ? url : `https://maps.google.com/maps?q=${encodeURIComponent(url)}`;
      openLink.style.display = "inline-flex";
    }

    const embedUrl = getEmbeddableMapUrl(url);
    if (embedUrl) {
      if (iframe) {
        iframe.src = embedUrl;
        iframe.style.display = "block";
      }
      if (placeholder) placeholder.classList.add("hidden");
      if (liveCard) liveCard.classList.add("hidden");
      if (badge) badge.textContent = "📍 指定位置";
    } else {
      // 共有リンクの場合
      if (iframe) {
        iframe.src = "about:blank";
        iframe.style.display = "none";
      }
      if (placeholder) placeholder.classList.add("hidden");
      if (liveCard) {
        liveCard.classList.remove("hidden");
        const btnLaunch = document.getElementById("btn-map-launch-current");
        if (btnLaunch) {
          btnLaunch.href = url;
          btnLaunch.textContent = "🗺️ 現在地をGoogleマップで確認 ↗";
        }
      }
      if (badge) badge.textContent = "📍 共有リンク連携";
    }
    updateFamilyAvatarBadges();
    return;
  }

  // 2. 手動指定がない場合は、端末のGPSまたは天気設定の現在地から自動描画
  const currentLoc = CONFIG.weather.locations.current;
  const lat = currentLoc.lat;
  const lon = currentLoc.lon;
  const locName = (currentLoc.name && currentLoc.name !== "現在地") ? currentLoc.name : "現在地";

  if (badge) badge.textContent = `📍 ${locName}`;
  const directMapUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
  const extMapUrl = `https://maps.google.com/maps?q=${lat},${lon}`;

  if (openLink) {
    openLink.href = extMapUrl;
    openLink.style.display = "inline-flex";
  }

  if (iframe) {
    iframe.src = directMapUrl;
    iframe.style.display = "block";
  }
  if (placeholder) placeholder.classList.add("hidden");
  if (liveCard) liveCard.classList.add("hidden");

  // 3. 家族の現在地共有アバターボタンの表示・リンク更新
  updateFamilyAvatarBadges();
}

// 家族の現在地共有機能は廃止され、単一のGoogleマップ表示に集約されました（後方互換用スタブ）
function updateFamilyAvatarBadges() {}
function openFamilySettingField(target) {}

// 後方互換用ダミー
function setupPersonMapPane(personKey, rawUrl) {
  setupCurrentLocationMap(rawUrl);
}

// Googleカレンダー埋め込みURLを「スケジュール（アジェンダ）表示」モードに整形
function ensureCalendarAgendaMode(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("calendar.google.com/calendar/embed")) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("mode", "AGENDA");
    return parsed.toString();
  } catch (e) {
    if (/mode=[A-Za-z0-9_]+/i.test(url)) {
      return url.replace(/mode=[A-Za-z0-9_]+/i, "mode=AGENDA");
    }
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}mode=AGENDA`;
  }
}

function initEmbeds() {
  // 1. カレンダー (月表示ではなくスケジュール表示 AGENDA に強制適用)
  const calIframe = document.getElementById("calendar-iframe");
  const calPlaceholder = document.getElementById("calendar-placeholder");
  const btnCalExt = document.getElementById("btn-calendar-external");
  const rawCalUrl = CONFIG.calendar.embedUrl;

  if (rawCalUrl && rawCalUrl.trim() !== "") {
    let cleanCalUrl = extractUrlOrClean(rawCalUrl);
    // スケジュール表示 (mode=AGENDA) に変換
    cleanCalUrl = ensureCalendarAgendaMode(cleanCalUrl);
    if (calIframe) calIframe.src = cleanCalUrl;
    if (calPlaceholder) calPlaceholder.classList.add("hidden");
    if (btnCalExt) {
      btnCalExt.href = cleanCalUrl.includes("calendar.google.com") ? cleanCalUrl : "https://calendar.google.com";
    }
  }

  // 2. マップ (現在位置)
  setupCurrentLocationMap(CONFIG.map.currentLocationUrl);
}


/* =========================================================
   5. YouTube プレイヤー & 3分自動ローテーション機能
   ユーザーの好みに合わせた動画を3分ごとに自動切り替え
   ========================================================= */
// ジャンル別おすすめ動画プール (24時間ライブ配信・安定ストリームでCM発生を排除)
const YT_GENRE_POOLS = {
  all_mix: {
    label: "総合ミックス",
    // ニュースライブ、ウェザーニュース、Lo-Fiを順次3分ローテ
    videos: [
      "6qpvwEJ7u2k", // ウェザーニュースLiVE (24h生放送)
      "coYw-eVU0Ks", // テレ朝NEWS24 (24h最新ニュース)
      "CmQi-BxdnSA", // TBS NEWS DIG (24h最新ニュース)
      "jfKfPfyJRdk", // Lofi Girl (Study beats)
      "rUxyKA_-grg"  // Lofi Girl (Chill beats)
    ]
  },
  news_weather: {
    label: "テレビニュース & 天気Live",
    videos: [
      "6qpvwEJ7u2k", // ウェザーニュースLiVE
      "coYw-eVU0Ks", // テレ朝NEWS24
      "CmQi-BxdnSA"  // TBS NEWS DIG 24h
    ]
  },
  akiba_gadget: {
    label: "アキバ・最新テック",
    videos: [
      "CmQi-BxdnSA", // TBS NEWS DIG (最新テック・情報)
      "coYw-eVU0Ks", // テレ朝NEWS24
      "jfKfPfyJRdk", // 作業用Lo-Fi
      "6qpvwEJ7u2k"  // ウェザーニュース
    ]
  },
  latest_tech: {
    label: "最新テック・ニュース",
    videos: [
      "coYw-eVU0Ks", // テレ朝NEWS24
      "CmQi-BxdnSA", // TBS NEWS DIG
      "6qpvwEJ7u2k"  // ウェザーニュース
    ]
  },
  desk_setup: {
    label: "作業用環境・Lo-Fi",
    videos: [
      "jfKfPfyJRdk",
      "rUxyKA_-grg",
      "6qpvwEJ7u2k"
    ]
  },
  lofi_relax: {
    label: "作業用Lo-Fi",
    videos: [
      "jfKfPfyJRdk",
      "rUxyKA_-grg"
    ]
  }
};

let ytPlayer = null;
let ytCurrentPool = [];
let ytCurrentIndex = 0;
let ytTimerInterval = null;
let ytRemainingSeconds = 180; // 3分 (180秒)
let ytConsecutiveErrors = 0; // 連続エラー回数カウンタ

// 現在のアクティブ動画プールを取得
function getYtActivePool() {
  if (CONFIG.youtube.customVideoIds && CONFIG.youtube.customVideoIds.length > 0) {
    return CONFIG.youtube.customVideoIds;
  }
  const genre = CONFIG.youtube.genre || "all_mix";
  const poolObj = YT_GENRE_POOLS[genre] || YT_GENRE_POOLS.all_mix;
  return poolObj.videos;
}

// ウェザーニュース最新Live配信の動画IDを動的に取得 (公式エンドポイント優先)
async function fetchWeatherNewsLiveVideoId() {
  // 1. ウェザーニュース公式ライブJSONエンドポイント (CORS: * 対応、最新Liveを常時配信)
  try {
    const res = await fetch(`https://weathernews.jp/s/live/json/youtube.json?t=${Date.now()}`, {
      cache: "no-store"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.code && typeof data.code === "string" && data.code.trim().length === 11) {
        const liveCode = data.code.trim();
        console.log("ウェザーニュース公式エンドポイントから最新Liveを検出:", liveCode);
        CONFIG.youtube.weatherLiveVideoId = liveCode;
        return liveCode;
      }
    }
  } catch (err) {
    console.warn("ウェザーニュース公式Liveエンドポイント取得エラー:", err);
  }

  // 2. ウェザーニュースLiveリストJSON (フォールバック)
  try {
    const res2 = await fetch(`https://site.weathernews.jp/site/live/json/list.json?t=${Date.now()}`, {
      cache: "no-store"
    });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2 && data2.live && data2.live.id && typeof data2.live.id === "string") {
        const liveId = data2.live.id.trim();
        console.log("ウェザーニュースLiveリストから最新動画IDを検出:", liveId);
        CONFIG.youtube.weatherLiveVideoId = liveId;
        return liveId;
      }
    }
  } catch (err2) {
    // フォールバック
  }

  return CONFIG.youtube.weatherLiveVideoId || "6qpvwEJ7u2k";
}

// YouTube再生モードの切り替え (weather: ウェザーニュースLive / recommend: おすすめ動画)
function switchYoutubeMode(mode) {
  CONFIG.youtube.currentMode = mode;
  const btnWeather = document.getElementById("btn-yt-mode-weather");
  const btnRecommend = document.getElementById("btn-yt-mode-recommend");
  const timerText = document.getElementById("yt-timer-text");
  const timerBar = document.getElementById("yt-timer-bar");

  if (mode === "weather") {
    if (btnWeather) btnWeather.classList.add("active");
    if (btnRecommend) btnRecommend.classList.remove("active");

    if (ytTimerInterval) {
      clearInterval(ytTimerInterval);
      ytTimerInterval = null;
    }
    if (timerText) timerText.textContent = "LIVE";
    if (timerBar) timerBar.style.width = "100%";

    // まず保持している最新IDで即時再生を開始
    const currentLiveId = CONFIG.youtube.weatherLiveVideoId || "6qpvwEJ7u2k";
    console.log(`YouTube: ウェザーニュース最新Live [${currentLiveId}] を再生します`);

    if (ytPlayer && ytPlayer.loadVideoById) {
      try {
        ytPlayer.loadVideoById({
          videoId: currentLiveId,
          startSeconds: 0
        });
        ytPlayer.mute();
        if (CONFIG.youtube.autoplay) ytPlayer.playVideo();
      } catch (err) {
        console.warn("ウェザーニュース再生エラー:", err);
      }
    }

    // バックグラウンドで最新Live枠を検証・もしIDが新しければ即座に切り替え
    fetchWeatherNewsLiveVideoId().then((latestId) => {
      if (CONFIG.youtube.currentMode === "weather" && latestId && latestId !== currentLiveId && ytPlayer && ytPlayer.loadVideoById) {
        console.log(`YouTube: 新しいLive枠 [${latestId}] を検知したため切り替えます`);
        ytPlayer.loadVideoById({
          videoId: latestId,
          startSeconds: 0
        });
        ytPlayer.mute();
        if (CONFIG.youtube.autoplay) ytPlayer.playVideo();
      }
    });
  } else {
    // recommend モード
    if (btnRecommend) btnRecommend.classList.add("active");
    if (btnWeather) btnWeather.classList.remove("active");

    ytCurrentPool = getYtActivePool();
    if (ytCurrentPool.length > 0) {
      const recId = ytCurrentPool[ytCurrentIndex % ytCurrentPool.length];
      console.log(`YouTube: おすすめ動画 [${recId}] を再生します`);
      if (ytPlayer && ytPlayer.loadVideoById) {
        try {
          ytPlayer.loadVideoById({
            videoId: recId,
            startSeconds: 0
          });
          ytPlayer.mute();
          if (CONFIG.youtube.autoplay) ytPlayer.playVideo();
        } catch (err) {
          console.warn("おすすめ動画再生エラー:", err);
        }
      }
    }
    startYtRotationTimer();
  }

  updateYtGenreBadge();
}

function updateYtGenreBadge() {
  const badge = document.getElementById("yt-genre-badge");
  const accountBadge = document.getElementById("yt-account-badge");
  const loginBtn = document.getElementById("btn-yt-login");

  const isPrem = !!CONFIG.youtube.isPremium;
  const account = CONFIG.youtube.googleAccount || "";

  if (accountBadge) {
    if (isPrem) {
      accountBadge.style.display = "inline-flex";
      accountBadge.textContent = account ? `💎 Premium (${account})` : "💎 Premium";
      accountBadge.title = account ? `Premium契約: ${account}` : "YouTube Premium連携モード";
    } else {
      accountBadge.style.display = "none";
    }
  }

  if (loginBtn) {
    if (account) {
      loginBtn.textContent = "アカウント切替 ↗";
      loginBtn.title = `現在のアカウント: ${account}`;
    } else {
      loginBtn.textContent = "ログイン ↗";
    }
  }

  if (!badge) return;
  if (CONFIG.youtube.currentMode === "weather") {
    badge.textContent = "ウェザーニュース Live 🔴";
  } else if (CONFIG.youtube.customVideoIds && CONFIG.youtube.customVideoIds.length > 0) {
    badge.textContent = `カスタムリスト`;
  } else {
    const genre = CONFIG.youtube.genre || "all_mix";
    const poolObj = YT_GENRE_POOLS[genre] || YT_GENRE_POOLS.all_mix;
    badge.textContent = `${poolObj.label}`;
  }
}

// 3分タイマーの更新と次の動画への切り替え (おすすめモード時)
function startYtRotationTimer() {
  if (ytTimerInterval) clearInterval(ytTimerInterval);
  if (CONFIG.youtube.currentMode === "weather") return;

  ytRemainingSeconds = CONFIG.youtube.rotationSeconds || 180;

  const timerText = document.getElementById("yt-timer-text");
  const timerBar = document.getElementById("yt-timer-bar");

  function tick() {
    ytRemainingSeconds--;

    // 分:秒 表記
    const m = Math.floor(ytRemainingSeconds / 60);
    const s = String(ytRemainingSeconds % 60).padStart(2, "0");
    if (timerText) timerText.textContent = `${m}:${s}`;

    // プログレスバー (残り割合)
    const percent = Math.max(0, (ytRemainingSeconds / (CONFIG.youtube.rotationSeconds || 180)) * 100);
    if (timerBar) timerBar.style.width = `${percent}%`;

    // 3分経過したら次の動画へ遷移
    if (ytRemainingSeconds <= 0) {
      playNextVideo();
    }
  }

  tick();
  ytTimerInterval = setInterval(tick, 1000);
}

// 次の好みの動画へシームレス遷移
function playNextVideo() {
  if (CONFIG.youtube.currentMode === "weather") {
    // 天気Liveモードの時は最新配信に更新
    switchYoutubeMode("weather");
    return;
  }

  ytCurrentPool = getYtActivePool();
  if (ytCurrentPool.length === 0) return;

  ytCurrentIndex = (ytCurrentIndex + 1) % ytCurrentPool.length;
  const nextVideoId = ytCurrentPool[ytCurrentIndex];

  console.log(`YouTube 3分経過: 次の動画 [${nextVideoId}] へ切り替えます`);

  if (ytPlayer && ytPlayer.loadVideoById) {
    try {
      ytPlayer.loadVideoById({
        videoId: nextVideoId,
        startSeconds: 0
      });
      ytPlayer.mute(); // 自動再生ポリシー対策
      if (CONFIG.youtube.autoplay) {
        ytPlayer.playVideo();
      }
    } catch (err) {
      console.warn("YouTube 動画切り替え例外:", err);
    }
  }

  // タイマーリセット
  startYtRotationTimer();
}

// YouTube IFrame API準備完了コールバック
window.onYouTubeIframeAPIReady = async function() {
  const initMode = CONFIG.youtube.defaultMode || "weather";
  CONFIG.youtube.currentMode = initMode;

  // ウェザーニュースLiveモードの場合、起動時に即座に最新Live IDを取得
  let liveId = CONFIG.youtube.weatherLiveVideoId || "6qpvwEJ7u2k";
  try {
    liveId = await fetchWeatherNewsLiveVideoId();
  } catch (err) {
    console.warn("起動時LiveID取得エラー:", err);
  }

  ytCurrentPool = getYtActivePool();
  const initialVideoId = (initMode === "weather") ? liveId : (ytCurrentPool[0] || "jfKfPfyJRdk");

  updateYtGenreBadge();

  // 15分ごとに最新Live配信枠を定期チェック (日またぎや番組枠更新時の自動追従)
  setInterval(async () => {
    const oldId = CONFIG.youtube.weatherLiveVideoId;
    const latestId = await fetchWeatherNewsLiveVideoId();
    if (CONFIG.youtube.currentMode === "weather" && latestId && latestId !== oldId && ytPlayer && ytPlayer.loadVideoById) {
      console.log(`YouTube定期監視: 新Live枠 [${latestId}] を検知したため自動更新します`);
      ytPlayer.loadVideoById({ videoId: latestId, startSeconds: 0 });
      ytPlayer.mute();
      if (CONFIG.youtube.autoplay) ytPlayer.playVideo();
    }
  }, 15 * 60 * 1000);

  // モード切替ボタンのリスナー登録
  const btnWeather = document.getElementById("btn-yt-mode-weather");
  const btnRecommend = document.getElementById("btn-yt-mode-recommend");
  if (btnWeather) {
    btnWeather.addEventListener("click", () => switchYoutubeMode("weather"));
  }
  if (btnRecommend) {
    btnRecommend.addEventListener("click", () => switchYoutubeMode("recommend"));
  }

  const playerVars = {
    autoplay: CONFIG.youtube.autoplay ? 1 : 0,
    mute: CONFIG.youtube.mute ? 1 : 0,
    playsinline: 1, // iOS Safariで全画面にならずインライン再生
    controls: 1,
    rel: 0,
    modestbranding: 1,
    enablejsapi: 1
  };

  // YouTube Premium契約時の広告非表示・アノテーション最適化
  if (CONFIG.youtube.isPremium) {
    playerVars.iv_load_policy = 3;
  }

  // オリジン設定 (iOS SafariおよびGitHub Pagesでの埋め込み拒否防止)
  if (window.location.origin && window.location.origin !== "null" && !window.location.origin.startsWith("file:")) {
    playerVars.origin = window.location.origin;
  }

  ytPlayer = new YT.Player("youtube-player", {
    videoId: initialVideoId,
    playerVars: playerVars,
    events: {
      onReady: (event) => {
        ytConsecutiveErrors = 0;
        event.target.mute();
        if (CONFIG.youtube.autoplay) {
          try {
            event.target.playVideo();
          } catch (e) {
            console.warn("YouTube 自動再生待機:", e);
          }
        }
        if (initMode === "recommend") {
          startYtRotationTimer();
        } else {
          const timerText = document.getElementById("yt-timer-text");
          if (timerText) timerText.textContent = "LIVE";
        }
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          ytConsecutiveErrors = 0;
        }
        // 動画自体が3分未満で終了した場合も待たずに次へ
        if (event.data === YT.PlayerState.ENDED) {
          playNextVideo();
        }
      },
      onError: (e) => {
        ytConsecutiveErrors++;
        console.warn(`YouTube Player エラー (code ${e.data || e}), 連続エラー: ${ytConsecutiveErrors}`);

        // プール全件が連続エラーになった場合は無限ループを停止して待機
        if (ytConsecutiveErrors >= ytCurrentPool.length) {
          console.warn("YouTube: 現在再生可能な動画がありません。無限スキップを停止します。");
          if (ytTimerInterval) clearInterval(ytTimerInterval);
          const timerText = document.getElementById("yt-timer-text");
          if (timerText) timerText.textContent = "待機中";
          return;
        }

        // 次の動画を4秒後に試行（高速な繰り返しエラーの防止）
        setTimeout(() => {
          playNextVideo();
        }, 4000);
      }
    }
  });

  // 手動スキップボタン
  const btnSkip = document.getElementById("btn-yt-skip");
  if (btnSkip) {
    btnSkip.addEventListener("click", () => {
      ytConsecutiveErrors = 0;
      playNextVideo();
    });
  }
};




// 6-2. ニュースデータ取得とローテーション
let currentXChannel = "it"; // "it" または "akiba"
const xFeedsData = { it: [], akiba: [] };
const xFeaturedIndices = { it: 0, akiba: 0 };
let xFeaturedRotateTimer = null;
let xFeedRotationTimer = null;

// rss2json APIを利用してCORS制限なく高速・確実にJSON取得する関数 (図・画像抽出対応)
async function fetchRssFeed(rssUrl, fallbackType = "tech") {
  const apiUrl = `${CONFIG.news.rssApiBase}${encodeURIComponent(rssUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (data.status !== "ok" || !data.items) {
    throw new Error(data.message || "RSS取得失敗");
  }

  const defaultAuthors = fallbackType === "tech" 
    ? [{ name: "ギズモード・ジャパン", handle: "@gizmodojapan", icon: "🌐" }, { name: "ITmedia NEWS", handle: "@itmedia_news", icon: "💻" }]
    : [{ name: "ASCII.jp アキバ", handle: "@ascii_akiba", icon: "⚡" }, { name: "エルミタージュ秋葉原", handle: "@hermita_akiba", icon: "🏢" }];

  return data.items.slice(0, 6).map((item, idx) => {
    let rawTitle = item.title || "タイトルなし";
    let source = "";

    const lastHyphenIndex = rawTitle.lastIndexOf(" - ");
    if (lastHyphenIndex !== -1) {
      source = rawTitle.substring(lastHyphenIndex + 3).trim();
      rawTitle = rawTitle.substring(0, lastHyphenIndex).trim();
    }

    let formattedTime = "";
    if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!isNaN(d.getTime())) {
        formattedTime = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    } else {
      formattedTime = `${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, "0")}`;
    }

    let thumbUrl = (item.enclosure && item.enclosure.link) || 
                   (item.enclosure && item.enclosure.url) || 
                   item.thumbnail || "";

    if (!thumbUrl && item.description) {
      const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) thumbUrl = match[1];
    }
    if (!thumbUrl && item.content) {
      const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) thumbUrl = match[1];
    }

    if (!thumbUrl) {
      const defaultTechImages = [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80"
      ];
      const defaultAkibaImages = [
        "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=240&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=240&auto=format&fit=crop&q=80"
      ];
      thumbUrl = (fallbackType === "tech" ? defaultTechImages : defaultAkibaImages)[idx % 4];
    }

    let rawSummary = item.description || item.content || "";
    rawSummary = rawSummary.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (rawSummary.length > 260) rawSummary = rawSummary.substring(0, 260) + "...";

    const authorMeta = defaultAuthors[idx % defaultAuthors.length];
    const repostCount = 12 + ((idx * 29) % 180);
    const likeCount = 45 + ((idx * 83) % 450);

    return {
      title: rawTitle,
      authorName: source || authorMeta.name,
      authorHandle: authorMeta.handle,
      authorIcon: authorMeta.icon,
      link: item.link || "#",
      time: formattedTime,
      thumbUrl: thumbUrl,
      summary: rawSummary || "タップしてXでポスト全文・記事を確認できます。",
      reposts: repostCount,
      likes: likeCount
    };
  });
}



/* =========================================================
   6-2. IT/テック＆アキバ特価ニュース パネル (本格記事ニュース)
   ========================================================= */
let currentNewsChannel = "it";
const newsFeaturedIndices = { it: 0, akiba: 0 };
let newsFeaturedRotateTimer = null;
let newsRotationTimer = null;

function renderNewsPanel(channel) {
  const items = xFeedsData[channel] || [];
  const listEl = document.getElementById(channel === "it" ? "list-news-it" : "list-news-akiba");
  const paneIt = document.getElementById("pane-news-it");
  const paneAkiba = document.getElementById("pane-news-akiba");
  const tabIt = document.getElementById("tab-news-it");
  const tabAkiba = document.getElementById("tab-news-akiba");
  const linkExt = document.getElementById("link-news-ext");

  if (channel === "it") {
    if (paneIt) paneIt.classList.add("active");
    if (paneAkiba) paneAkiba.classList.remove("active");
    if (tabIt) tabIt.classList.add("active");
    if (tabAkiba) tabAkiba.classList.remove("active");
    if (linkExt) linkExt.href = "https://www.gizmodo.jp";
  } else {
    if (paneAkiba) paneAkiba.classList.add("active");
    if (paneIt) paneIt.classList.remove("active");
    if (tabAkiba) tabAkiba.classList.add("active");
    if (tabIt) tabIt.classList.remove("active");
    if (linkExt) linkExt.href = "https://ascii.jp";
  }

  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `<li class="news-item"><div class="news-item-content">ニュースを取得中...</div></li>`;
    return;
  }

  const activeIdx = newsFeaturedIndices[channel];

  listEl.innerHTML = items.slice(0, 4).map((item, idx) => {
    const url = item.link && item.link !== "#" ? escapeHtml(item.link) : "#";
    const isAct = (idx === activeIdx);
    return `
      <li class="news-item ${isAct ? "featured-active" : ""}" id="news-item-${channel}-${idx}">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="news-item-link" onclick="onNewsItemClick('${channel}', ${idx}, event)">
          <div class="news-item-thumb-wrap">
            <img src="${escapeHtml(item.thumbUrl)}" class="news-item-thumb" alt="サムネイル" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80';">
          </div>
          <div class="news-item-content">
            <div class="news-item-title">${escapeHtml(item.title)}</div>
            <div class="news-item-meta">
              <span class="news-source-tag">${escapeHtml(item.authorName)}</span>
              <span class="news-item-time">${item.time}</span>
            </div>
          </div>
          <span class="news-open-icon">↗</span>
        </a>
      </li>
    `;
  }).join("");

  updateNewsFeaturedBox(channel, activeIdx);
}

function updateNewsFeaturedBox(channel, index) {
  const items = xFeedsData[channel] || [];
  if (items.length === 0) return;

  const validIdx = index % items.length;
  newsFeaturedIndices[channel] = validIdx;
  const item = items[validIdx];

  const featuredEl = document.getElementById(channel === "it" ? "featured-news-it" : "featured-news-akiba");
  if (!featuredEl || !item) return;

  const fUrl = item.link && item.link !== "#" ? escapeHtml(item.link) : "#";
  featuredEl.innerHTML = `
    <a href="${fUrl}" target="_blank" rel="noopener noreferrer" class="news-featured-link">
      <div class="news-featured-content">
        <div class="news-featured-title">${escapeHtml(item.title)}</div>
        <p class="news-featured-summary">${escapeHtml(item.summary)}</p>
        <div class="news-featured-meta-row">
          <span class="news-source-tag">${escapeHtml(item.authorName)}</span>
          <span class="news-item-time">${item.time}</span>
          <span class="news-featured-more">記事を読む ↗</span>
        </div>
      </div>
      <div class="news-featured-thumb-wrap">
        <img src="${escapeHtml(item.thumbUrl)}" class="news-featured-thumb" alt="注目写真" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80';">
      </div>
    </a>
  `;

  // リストのハイライト更新
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`news-item-${channel}-${i}`);
    if (el) {
      if (i === validIdx) el.classList.add("featured-active");
      else el.classList.remove("featured-active");
    }
  }
}

window.onNewsItemClick = function(channel, index, event) {
  updateNewsFeaturedBox(channel, index);
};

function switchNewsChannel(targetChannel) {
  currentNewsChannel = targetChannel;
  renderNewsPanel(targetChannel);
}

function initNewsFeedRotation() {
  const tabIt = document.getElementById("tab-news-it");
  const tabAkiba = document.getElementById("tab-news-akiba");
  const timerBar = document.getElementById("news-timer-bar");

  if (tabIt) {
    tabIt.addEventListener("click", () => switchNewsChannel("it"));
  }
  if (tabAkiba) {
    tabAkiba.addEventListener("click", () => switchNewsChannel("akiba"));
  }

  const totalDuration = CONFIG.news.rotationSeconds || 30;
  const tickIntervalMs = 200;
  let progressMs = 0;

  if (newsRotationTimer) clearInterval(newsRotationTimer);

  newsRotationTimer = setInterval(() => {
    progressMs += tickIntervalMs;
    const percent = Math.min((progressMs / (totalDuration * 1000)) * 100, 100);
    if (timerBar) timerBar.style.width = `${percent}%`;

    if (progressMs >= totalDuration * 1000) {
      progressMs = 0;
      switchNewsChannel(currentNewsChannel === "it" ? "akiba" : "it");
    }
  }, tickIntervalMs);

  // 注目記事巡回 (6秒ごと)
  if (newsFeaturedRotateTimer) clearInterval(newsFeaturedRotateTimer);
  newsFeaturedRotateTimer = setInterval(() => {
    const items = xFeedsData[currentNewsChannel];
    if (items && items.length > 0) {
      const nextIdx = (newsFeaturedIndices[currentNewsChannel] + 1) % items.length;
      updateNewsFeaturedBox(currentNewsChannel, nextIdx);
    }
  }, 6000);
}

// 全フィードの最新データ取得
async function loadFeeds() {
  // 1. IT系速報
  try {
    const itItems = await fetchRssFeed(CONFIG.news.itRssUrl || "https://www.gizmodo.jp/index.xml", "tech");
    xFeedsData.it = itItems;
  } catch (err) {
    console.warn("IT系フィードフォールバック:", err);
    xFeedsData.it = [
      {
        title: "次世代AIチップ搭載PCと新型ハイエンドデバイスが続々発表",
        authorName: "ギズモード・ジャパン",
        authorHandle: "@gizmodojapan",
        authorIcon: "🌐",
        link: "https://www.gizmodo.jp/",
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80",
        summary: "最新世代AIチップを搭載した高性能PCや革新的デバイスの実機レビューをお届けします。",
        reposts: 88,
        likes: 312
      },
      {
        title: "「Wi-Fi 7」対応の次世代高速ルーター、実効通信速度を徹底検証",
        authorName: "ITmedia NEWS",
        authorHandle: "@itmedia_news",
        authorIcon: "💻",
        link: "https://www.itmedia.co.jp/",
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=240&auto=format&fit=crop&q=80",
        summary: "最新規格Wi-Fi 7に対応した超高速ルーターが登場。通信安定性とレイテンシを徹底測定。",
        reposts: 54,
        likes: 198
      },
      {
        title: "Google AIとスマート家電連携、音声ルーティンがさらに自然に進化",
        authorName: "テクノロジー速報",
        authorHandle: "@tech_news_jp",
        authorIcon: "🚀",
        link: "https://www.gizmodo.jp/",
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=240&auto=format&fit=crop&q=80",
        summary: "最新生成AIとスマートホームの直接連動により、日々の生活ルーティンが自然な会話で自動化されます。",
        reposts: 120,
        likes: 460
      }
    ];
  }

  // 2. 秋葉原・自作PC特価速報
  try {
    const akibaItems = await fetchRssFeed(CONFIG.news.akibaRssUrl || "https://ascii.jp/rss.xml", "akiba");
    xFeedsData.akiba = akibaItems;
  } catch (err) {
    console.warn("アキバ系フィードフォールバック:", err);
    xFeedsData.akiba = [
      {
        title: "大容量20TB HDD & 4TB NVMe SSDが秋葉原店頭で週末限定特価",
        authorName: "ASCII.jp アキバ",
        authorHandle: "@ascii_akiba",
        authorIcon: "⚡",
        link: "https://ascii.jp/",
        time: "特価",
        thumbUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=240&auto=format&fit=crop&q=80",
        summary: "秋葉原各店にて大容量ストレージが週末限定特価。PCIe Gen4対応SSDが大幅値引き中。",
        reposts: 142,
        likes: 520
      },
      {
        title: "最新RTXグラフィックボード＆Mini-ITX小型ケースの店頭販売開始",
        authorName: "エルミタージュ秋葉原",
        authorHandle: "@hermita_akiba",
        authorIcon: "🏢",
        link: "https://www.gdm.or.jp/",
        time: "新入荷",
        thumbUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=240&auto=format&fit=crop&q=80",
        summary: "省スペースな自作PCに最適なMini-ITXケースと高冷却グラフィックスカードが入荷しました。",
        reposts: 76,
        likes: 240
      },
      {
        title: "秋葉原各ショップ、今週末の数量限定ジャンク＆掘り出し物まとめ",
        authorName: "AKIBA PC Hotline!",
        authorHandle: "@akiba_hotline",
        authorIcon: "🛒",
        link: "https://akiba-pc.watch.impress.co.jp/",
        time: "注目",
        thumbUrl: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=240&auto=format&fit=crop&q=80",
        summary: "中古スマートデバイス、液晶モニター、自作PCパーツの特価セール情報を一挙紹介。",
        reposts: 110,
        likes: 380
      }
    ];
  }

  renderNewsPanel(currentNewsChannel);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}


/* =========================================================
   7. 設定モーダル & localStorage 管理 (個人情報保護機能)
   ========================================================= */
const STORAGE_KEY = "digital_signage_user_settings";

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.calendarUrl) CONFIG.calendar.embedUrl = ensureCalendarAgendaMode(extractUrlOrClean(saved.calendarUrl));
      
      // 現在位置のGoogleマップURL & 家族の現在地共有URL
      if (saved.mapCurrentUrl) CONFIG.map.currentLocationUrl = extractUrlOrClean(saved.mapCurrentUrl);
      else if (saved.mapUrl) CONFIG.map.currentLocationUrl = extractUrlOrClean(saved.mapUrl);
      if (saved.mapWifeUrl) CONFIG.map.wifeEmbedUrl = extractUrlOrClean(saved.mapWifeUrl);
      if (saved.mapDaughterUrl) CONFIG.map.daughterEmbedUrl = extractUrlOrClean(saved.mapDaughterUrl);

      // YouTube & Premium
      if (saved.youtubeDefaultMode) {
        CONFIG.youtube.defaultMode = saved.youtubeDefaultMode;
        CONFIG.youtube.currentMode = saved.youtubeDefaultMode;
      }
      if (typeof saved.youtubeIsPremium === "boolean") CONFIG.youtube.isPremium = saved.youtubeIsPremium;
      else if (typeof saved.isPremium === "boolean") CONFIG.youtube.isPremium = saved.isPremium;

      if (saved.googleAccount) CONFIG.youtube.googleAccount = saved.googleAccount;
      if (typeof saved.adFreeMode === "boolean") CONFIG.youtube.adFreeMode = saved.adFreeMode;

      if (saved.youtubeGenre) CONFIG.youtube.genre = saved.youtubeGenre;
      if (saved.youtubeCustomIds && Array.isArray(saved.youtubeCustomIds)) {
        CONFIG.youtube.customVideoIds = saved.youtubeCustomIds;
      }

      // 天気
      if (saved.currentLocationName) CONFIG.weather.currentLocationName = saved.currentLocationName;
      if (saved.weatherProvider) CONFIG.weather.provider = saved.weatherProvider;
      if (saved.openWeatherApiKey) CONFIG.weather.openWeatherApiKey = saved.openWeatherApiKey;
    }
  } catch (err) {
    console.warn("設定読み込みエラー:", err);
  }
}

function initSettingsModal() {
  const btnOpen = document.getElementById("btn-settings-open");
  const btnClose = document.getElementById("btn-settings-close");
  const btnCancel = document.getElementById("btn-settings-cancel");
  const btnSave = document.getElementById("btn-settings-save");
  const modal = document.getElementById("settings-modal");

  const inputCal = document.getElementById("cfg-calendar-url");
  const inputMapCurrent = document.getElementById("cfg-map-current-url");
  const checkYtPremium = document.getElementById("cfg-youtube-premium");
  const inputGoogleAccount = document.getElementById("cfg-google-account");
  const selectYtDefaultMode = document.getElementById("cfg-youtube-default-mode");
  const selectYtGenre = document.getElementById("cfg-youtube-genre");
  const inputYtCustom = document.getElementById("cfg-youtube-custom-ids");
  const inputLocName = document.getElementById("cfg-current-loc-name");
  const selectProvider = document.getElementById("cfg-weather-provider");
  const groupOwmKey = document.getElementById("group-owm-key");
  const inputOwmKey = document.getElementById("cfg-owm-key");

  // JSONファイル読み込み・書き出し用要素
  const fileInput = document.getElementById("cfg-file-import");
  const btnFilePick = document.getElementById("btn-cfg-file-pick");
  const btnFileExport = document.getElementById("btn-cfg-file-export");
  const importStatus = document.getElementById("json-import-status");

  // 1. JSONファイルインポート機能
  if (btnFilePick && fileInput) {
    btnFilePick.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (importStatus) {
        importStatus.textContent = "ファイルを解析中...";
        importStatus.style.color = "var(--accent-cyan)";
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          applyImportedJsonConfig(parsed);
          if (importStatus) {
            importStatus.textContent = "✅ 設定を正常に読み込みました！適用中...";
            importStatus.style.color = "var(--accent-green)";
          }
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          console.error("JSON読み込み失敗:", err);
          if (importStatus) {
            importStatus.textContent = `❌ JSON解析エラー: ${err.message}`;
            importStatus.style.color = "var(--accent-red)";
          }
        }
      };
      reader.onerror = () => {
        if (importStatus) {
          importStatus.textContent = "❌ ファイル読み込み中にエラーが発生しました";
          importStatus.style.color = "var(--accent-red)";
        }
      };
      reader.readAsText(file, "UTF-8");
    });
  }

  // 2. JSONエクスポート機能
  if (btnFileExport) {
    btnFileExport.addEventListener("click", () => {
      exportCurrentConfigToJson();
    });
  }

  function openModal() {
    if (inputCal) inputCal.value = CONFIG.calendar.embedUrl || "";
    if (inputMapCurrent) inputMapCurrent.value = CONFIG.map.currentLocationUrl || "";
    if (checkYtPremium) checkYtPremium.checked = !!CONFIG.youtube.isPremium;
    if (inputGoogleAccount) inputGoogleAccount.value = CONFIG.youtube.googleAccount || "";
    if (selectYtDefaultMode) selectYtDefaultMode.value = CONFIG.youtube.defaultMode || "weather";
    if (selectYtGenre) selectYtGenre.value = CONFIG.youtube.genre || "all_mix";
    if (inputYtCustom) inputYtCustom.value = (CONFIG.youtube.customVideoIds || []).join(", ");
    if (inputLocName) inputLocName.value = CONFIG.weather.currentLocationName || "";
    if (selectProvider) selectProvider.value = CONFIG.weather.provider || "open-meteo";
    if (inputOwmKey) inputOwmKey.value = (CONFIG.weather.openWeatherApiKey !== "YOUR_OPENWEATHER_API_KEY") ? (CONFIG.weather.openWeatherApiKey || "") : "";
    if (importStatus) importStatus.textContent = "";

    if (groupOwmKey && selectProvider) {
      groupOwmKey.style.display = (selectProvider.value === "openweathermap") ? "flex" : "none";
    }
    modal.classList.add("active");
  }

  function closeModal() {
    modal.classList.remove("active");
  }

  if (selectProvider) {
    selectProvider.addEventListener("change", () => {
      if (groupOwmKey) {
        groupOwmKey.style.display = (selectProvider.value === "openweathermap") ? "flex" : "none";
      }
    });
  }

  if (btnOpen) btnOpen.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const rawCustom = inputYtCustom ? inputYtCustom.value.trim() : "";
      const customList = rawCustom ? rawCustom.split(",").map(s => s.trim()).filter(s => s.length > 0) : [];

      const newSettings = {
        calendarUrl: inputCal ? ensureCalendarAgendaMode(extractUrlOrClean(inputCal.value)) : "",
        mapCurrentUrl: inputMapCurrent ? extractUrlOrClean(inputMapCurrent.value) : "",
        youtubeDefaultMode: selectYtDefaultMode ? selectYtDefaultMode.value : "weather",
        youtubeIsPremium: checkYtPremium ? checkYtPremium.checked : true,
        googleAccount: inputGoogleAccount ? inputGoogleAccount.value.trim() : "",
        adFreeMode: true,
        youtubeGenre: selectYtGenre ? selectYtGenre.value : "all_mix",
        youtubeCustomIds: customList,
        currentLocationName: inputLocName ? inputLocName.value.trim() : "",
        weatherProvider: selectProvider ? selectProvider.value : "open-meteo",
        openWeatherApiKey: inputOwmKey ? inputOwmKey.value.trim() : ""
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      closeModal();
      window.location.reload();
    });
  }
}

// 読み込んだJSONオブジェクトをlocalStorageの設定にマージ
function applyImportedJsonConfig(parsed) {
  if (!parsed || typeof parsed !== "object") return;
  const currentSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

  // 1. カレンダー
  let calVal = "";
  if (parsed.calendar && typeof parsed.calendar === "object") {
    calVal = parsed.calendar.embedUrl || parsed.calendar.url || parsed.calendar.src || "";
  } else if (typeof parsed.calendar === "string") {
    calVal = parsed.calendar;
  }
  if (!calVal) {
    calVal = parsed.calendarUrl || parsed.calendar_url || parsed.calendarEmbedUrl || "";
  }
  if (calVal) currentSettings.calendarUrl = ensureCalendarAgendaMode(extractUrlOrClean(calVal));

  // 2. マップ (現在位置のGoogleマップ & 家族共有)
  let mapVal = "";
  if (parsed.map && typeof parsed.map === "object") {
    mapVal = parsed.map.currentLocationUrl || parsed.map.currentUrl || parsed.map.url || parsed.map.embedUrl || "";
  } else if (typeof parsed.map === "string") {
    mapVal = parsed.map;
  }
  if (!mapVal) {
    mapVal = parsed.mapCurrentUrl || parsed.mapUrl || parsed.currentLocationUrl || "";
  }
  if (mapVal) currentSettings.mapCurrentUrl = extractUrlOrClean(mapVal);

  let wifeVal = (parsed.map && parsed.map.wifeEmbedUrl) || parsed.mapWifeUrl || parsed.wifeEmbedUrl || "";
  if (wifeVal) currentSettings.mapWifeUrl = extractUrlOrClean(wifeVal);

  let daughterVal = (parsed.map && parsed.map.daughterEmbedUrl) || parsed.mapDaughterUrl || parsed.daughterEmbedUrl || "";
  if (daughterVal) currentSettings.mapDaughterUrl = extractUrlOrClean(daughterVal);

  // 3. YouTube & Premium
  if (parsed.youtube && typeof parsed.youtube === "object") {
    if (parsed.youtube.defaultMode) currentSettings.youtubeDefaultMode = parsed.youtube.defaultMode;
    if (typeof parsed.youtube.isPremium === "boolean") currentSettings.youtubeIsPremium = parsed.youtube.isPremium;
    if (parsed.youtube.googleAccount) currentSettings.googleAccount = parsed.youtube.googleAccount.trim();
    if (parsed.youtube.email) currentSettings.googleAccount = parsed.youtube.email.trim();
    if (typeof parsed.youtube.adFreeMode === "boolean") currentSettings.adFreeMode = parsed.youtube.adFreeMode;
    if (parsed.youtube.genre) currentSettings.youtubeGenre = parsed.youtube.genre;
    if (Array.isArray(parsed.youtube.customVideoIds)) currentSettings.youtubeCustomIds = parsed.youtube.customVideoIds;
  }
  if (parsed.youtubeDefaultMode) currentSettings.youtubeDefaultMode = parsed.youtubeDefaultMode;
  if (parsed.googleAccount) currentSettings.googleAccount = parsed.googleAccount.trim();
  if (typeof parsed.youtubeIsPremium === "boolean") currentSettings.youtubeIsPremium = parsed.youtubeIsPremium;
  if (typeof parsed.isPremium === "boolean") currentSettings.youtubeIsPremium = parsed.isPremium;
  if (typeof parsed.adFreeMode === "boolean") currentSettings.adFreeMode = parsed.adFreeMode;
  if (parsed.youtubeGenre) currentSettings.youtubeGenre = parsed.youtubeGenre;
  if (Array.isArray(parsed.youtubeCustomIds)) currentSettings.youtubeCustomIds = parsed.youtubeCustomIds;

  // 4. 天気
  if (parsed.weather && typeof parsed.weather === "object") {
    if (parsed.weather.currentLocationName !== undefined) currentSettings.currentLocationName = parsed.weather.currentLocationName;
    if (parsed.weather.provider) currentSettings.weatherProvider = parsed.weather.provider;
    if (parsed.weather.openWeatherApiKey) currentSettings.openWeatherApiKey = parsed.weather.openWeatherApiKey;
  }
  if (parsed.currentLocationName !== undefined) currentSettings.currentLocationName = parsed.currentLocationName;
  if (parsed.weatherProvider) currentSettings.weatherProvider = parsed.weatherProvider;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
}

// 現在の設定をJSONファイルとしてダウンロード書き出し
function exportCurrentConfigToJson() {
  const exportData = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Smart Digital Signage Configuration",
    exportedAt: new Date().toISOString(),
    calendar: {
      embedUrl: CONFIG.calendar.embedUrl || ""
    },
    map: {
      currentLocationUrl: CONFIG.map.currentLocationUrl || ""
    },
    weather: {
      currentLocationName: CONFIG.weather.currentLocationName || "",
      provider: CONFIG.weather.provider || "open-meteo",
      openWeatherApiKey: (CONFIG.weather.openWeatherApiKey !== "YOUR_OPENWEATHER_API_KEY") ? (CONFIG.weather.openWeatherApiKey || "") : ""
    },
    youtube: {
      defaultMode: CONFIG.youtube.defaultMode || "weather",
      isPremium: !!CONFIG.youtube.isPremium,
      googleAccount: CONFIG.youtube.googleAccount || "",
      adFreeMode: (CONFIG.youtube.adFreeMode !== undefined) ? !!CONFIG.youtube.adFreeMode : true,
      genre: CONFIG.youtube.genre || "all_mix",
      rotationSeconds: CONFIG.youtube.rotationSeconds || 180,
      customVideoIds: CONFIG.youtube.customVideoIds || []
    }
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `signage-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// 音声認識からタイマーコマンドを判別・解析するヘルパー関数
function parseTimerCommand(text) {
  if (!text) return null;
  const raw = text.trim();

  // キャンセル・停止判定
  if (/タイマー.*(止めて|止め|停止|キャンセル|リセット|終了|消して|ストップ)/i.test(raw) || /(止めて|停止|キャンセル|リセット|ストップ).*タイマー/i.test(raw)) {
    return { action: "cancel" };
  }

  // 漢数字・全角数字の正規化
  const kanjiMap = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
  let normalized = raw.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  normalized = normalized.replace(/([一二三四五六七八九])?十([一二三四五六七八九])?/g, (m, p1, p2) => {
    const tens = p1 ? kanjiMap[p1] : 1;
    const ones = p2 ? kanjiMap[p2] : 0;
    return (tens * 10 + ones).toString();
  });
  normalized = normalized.replace(/[一二三四五六七八九]/g, s => kanjiMap[s]);

  let totalSeconds = 0;
  let labelParts = [];

  // 時間
  const hourMatch = normalized.match(/(\d+)\s*時間/);
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    totalSeconds += h * 3600;
    labelParts.push(`${h}時間`);
  }

  // 分半 (例: 1分半 -> 90秒)
  const halfMinMatch = normalized.match(/(\d+)\s*分半/);
  if (halfMinMatch) {
    const m = parseInt(halfMinMatch[1], 10);
    totalSeconds += m * 60 + 30;
    labelParts.push(`${m}分30秒`);
  } else {
    // 通常の分
    const minMatch = normalized.match(/(\d+)\s*分/);
    if (minMatch) {
      const m = parseInt(minMatch[1], 10);
      totalSeconds += m * 60;
      labelParts.push(`${m}分`);
    }
  }

  // 秒
  const secMatch = normalized.match(/(\d+)\s*秒/);
  if (secMatch) {
    const s = parseInt(secMatch[1], 10);
    totalSeconds += s;
    labelParts.push(`${s}秒`);
  }

  if (totalSeconds > 0 && (normalized.includes("タイマー") || normalized.includes("測って") || normalized.includes("計って") || normalized.includes("セット") || normalized.includes("カウント"))) {
    return {
      action: "start",
      seconds: totalSeconds,
      label: labelParts.join("")
    };
  }

  return null;
}
window.parseTimerCommand = parseTimerCommand;

/* =========================================================
   アプリケーション初期化
   ========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  // 0. 端末内(localStorage)に保存された個人設定があれば優先適用
  loadSavedSettings();

  // 1. 時計開始
  initClock();

  // 2. 天気予報 (現在地 & 大崎駅の上下2分割同時取得)
  fetchAllWeather(); // まずデフォルト座標(大崎)で両ペイン即時描画

  // メインバッジおよび各ペインの更新バッジをタップすると警報表示のON/OFFテストが可能
  const mainWeatherBadge = document.getElementById("weather-updated-main");
  if (mainWeatherBadge) {
    mainWeatherBadge.style.cursor = "pointer";
    mainWeatherBadge.title = "タップで警報表示テスト切替";
    mainWeatherBadge.addEventListener("click", () => {
      window.toggleWeatherAlertTest();
    });
  }

  const currentBadge = document.getElementById("weather-updated-current");
  if (currentBadge) {
    currentBadge.style.cursor = "pointer";
    currentBadge.addEventListener("click", () => window.toggleWeatherAlertTest());
  }

  const osakiBadge = document.getElementById("weather-updated-osaki");
  if (osakiBadge) {
    osakiBadge.style.cursor = "pointer";
    osakiBadge.addEventListener("click", () => window.toggleWeatherAlertTest());
  }

  // 端末の現在地を取得(非同期)。取得完了後に「現在地」ペインのみ正確な座標で再フェッチ
  resolveCurrentLocation().then(() => {
    if (CONFIG.weather.locations.current.isResolved) {
      fetchWeatherForLocation("current");
    }
  });

  // 定期更新 (15分ごと)
  setInterval(fetchAllWeather, CONFIG.weather.updateIntervalMinutes * 60 * 1000);

  // 3. 埋め込み (カレンダー・マップ) の初期化
  initEmbeds();

  // 4. ニュース・RSSフィードの読み込みとローテーション開始
  loadFeeds();
  initNewsFeedRotation(); // ニュースパネルの30秒自動ローテーション & 6秒巡回
  setInterval(loadFeeds, CONFIG.news.refreshIntervalMinutes * 60 * 1000);

  // 5. 設定モーダル初期化
  initSettingsModal();
});


