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

  // 3. Googleマップ (位置情報共有: 妻 & 娘の上下2分割) 設定
  map: {
    wifeEmbedUrl: "",     // 妻のGoogleマップ位置情報URL
    daughterEmbedUrl: ""  // 娘のGoogleマップ位置情報URL
  },

  // 4. YouTubeタイル設定 (3分自動ローテーション・お好み動画)
  youtube: {
    isPremium: true,       // YouTube Premium契約 (広告・CM非表示モード)
    googleAccount: "",     // Premium契約のGoogleアカウント (任意: user@gmail.com)
    adFreeMode: true,      // 広告・CM完全排除モード
    genre: "all_mix",      // デフォルト: 総合ミックス (ニュース・ウェザーニュース・アキバ・テック)
    customVideoIds: [],    // ユーザー指定のカスタム動画ID配列
    rotationSeconds: 180,  // 表示時間: 3分 (180秒)
    autoplay: 1,           // 自動再生 (1: 有効)
    mute: 1                // 消音 (1: ミュート ※iOS/Safari自動再生ポリシー対策)
  },

  // 5. ニュース & アキバ特価情報設定
  news: {
    rotationSeconds: 30, // 切り替え間隔(秒)
    // 高速・CORS完全対応の RSS to JSON API
    rssApiBase: "https://api.rss2json.com/v1/api.json?rss_url=",
    // IT・ガジェット・最新テクノロジー (全記事に図・高画質写真付属: ギズモード・ジャパン)
    yahooRssUrl: "https://www.gizmodo.jp/index.xml",
    // アキバ・自作PC・セール特価・ガジェット情報 (全記事に図・写真付属: ASCII.jp)
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
        resolve();
      },
      (err) => {
        console.warn("現在地取得スキップ(許可なし/タイムアウト)。大崎駅をデフォルトにします:", err.message);
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

// 妻 / 娘のマップペイン表示制御 (iframe描画 または リアルタイム位置連携カード表示)
function setupPersonMapPane(personKey, rawUrl) {
  const iframe = document.getElementById(`map-iframe-${personKey}`);
  const placeholder = document.getElementById(`map-placeholder-${personKey}`);
  const liveCard = document.getElementById(`map-live-card-${personKey}`);
  const openLink = document.getElementById(`map-open-link-${personKey}`);

  const personLabel = (personKey === "wife") ? "妻" : "娘";
  const personEmoji = (personKey === "wife") ? "👩" : "👧";

  if (!rawUrl || rawUrl.trim() === "") {
    if (iframe) {
      iframe.src = "about:blank";
      iframe.style.display = "block";
    }
    if (placeholder) placeholder.classList.remove("hidden");
    if (liveCard) liveCard.classList.add("hidden");
    if (openLink) openLink.style.display = "none";
    return;
  }

  const url = extractUrlOrClean(rawUrl);
  if (openLink) {
    openLink.href = url;
    openLink.style.display = "inline-flex";
  }

  const embedUrl = getEmbeddableMapUrl(url);
  if (embedUrl) {
    // 埋め込み可能 (住所・座標・embed URL)
    if (iframe) {
      iframe.src = embedUrl;
      iframe.style.display = "block";
    }
    if (placeholder) placeholder.classList.add("hidden");
    if (liveCard) liveCard.classList.add("hidden");
  } else {
    // Google現在地共有リンク (maps.app.goo.gl 等: iframeブロック対策として専用連携カードを表示)
    if (iframe) {
      iframe.src = "about:blank";
      iframe.style.display = "none";
    }
    if (placeholder) placeholder.classList.add("hidden");
    if (liveCard) {
      liveCard.classList.remove("hidden");
      const btnLaunch = liveCard.querySelector(".btn-map-launch");
      if (btnLaunch) {
        btnLaunch.href = url;
        btnLaunch.textContent = `🗺️ ${personEmoji} ${personLabel}の現在地をGoogleマップで確認 ↗`;
      }
      const noteEl = liveCard.querySelector(".map-live-note");
      if (noteEl) {
        noteEl.textContent = `タップするとGoogleマップアプリまたはSafariでリアルタイム位置を確認できます`;
      }
    }
  }
}

function initEmbeds() {
  // 1. カレンダー
  const calIframe = document.getElementById("calendar-iframe");
  const calPlaceholder = document.getElementById("calendar-placeholder");
  const btnCalExt = document.getElementById("btn-calendar-external");
  const rawCalUrl = CONFIG.calendar.embedUrl;

  if (rawCalUrl && rawCalUrl.trim() !== "") {
    const cleanCalUrl = extractUrlOrClean(rawCalUrl);
    if (calIframe) calIframe.src = cleanCalUrl;
    if (calPlaceholder) calPlaceholder.classList.add("hidden");
    if (btnCalExt) {
      btnCalExt.href = cleanCalUrl.includes("calendar.google.com") ? cleanCalUrl : "https://calendar.google.com";
    }
  }

  // 2. マップ (妻 & 娘の上下2分割)
  setupPersonMapPane("wife", CONFIG.map.wifeEmbedUrl);
  setupPersonMapPane("daughter", CONFIG.map.daughterEmbedUrl);
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
      "WO-T3EPxTwQ", // ウェザーニュースLiVE (24h生放送)
      "coYw-eVU0Ks", // テレ朝NEWS24 (24h最新ニュース)
      "CmQi-BxdnSA", // TBS NEWS DIG (24h最新ニュース)
      "jfKfPfyJRdk", // Lofi Girl (Study beats)
      "rUxyKA_-grg"  // Lofi Girl (Chill beats)
    ]
  },
  news_weather: {
    label: "テレビニュース & 天気Live",
    videos: [
      "WO-T3EPxTwQ", // ウェザーニュースLiVE
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
      "WO-T3EPxTwQ"  // ウェザーニュース
    ]
  },
  latest_tech: {
    label: "最新テック・ニュース",
    videos: [
      "coYw-eVU0Ks", // テレ朝NEWS24
      "CmQi-BxdnSA", // TBS NEWS DIG
      "WO-T3EPxTwQ"  // ウェザーニュース
    ]
  },
  desk_setup: {
    label: "作業用環境・Lo-Fi",
    videos: [
      "jfKfPfyJRdk",
      "rUxyKA_-grg",
      "WO-T3EPxTwQ"
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
  if (CONFIG.youtube.customVideoIds && CONFIG.youtube.customVideoIds.length > 0) {
    badge.textContent = `カスタムリスト`;
  } else {
    const genre = CONFIG.youtube.genre || "all_mix";
    const poolObj = YT_GENRE_POOLS[genre] || YT_GENRE_POOLS.all_mix;
    badge.textContent = `${poolObj.label}`;
  }
}

// 3分タイマーの更新と次の動画への切り替え
function startYtRotationTimer() {
  if (ytTimerInterval) clearInterval(ytTimerInterval);
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
window.onYouTubeIframeAPIReady = function() {
  ytCurrentPool = getYtActivePool();
  const initialVideoId = ytCurrentPool[0] || "jfKfPfyJRdk";
  updateYtGenreBadge();

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
        startYtRotationTimer();
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


/* =========================================================
   6. Yahoo!ニュース & アキバ特価情報 (RSSフェッチ + 30秒ローテーション)
   ========================================================= */
let currentNewsPane = "yahoo"; // "yahoo" または "akiba"

// rss2json APIを利用してCORS制限なく高速・確実にJSON取得する関数 (図・画像抽出対応)
async function fetchRssFeed(rssUrl, fallbackType = "tech") {
  const apiUrl = `${CONFIG.news.rssApiBase}${encodeURIComponent(rssUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (data.status !== "ok" || !data.items) {
    throw new Error(data.message || "RSS取得失敗");
  }

  return data.items.slice(0, 4).map((item, idx) => {
    let rawTitle = item.title || "タイトルなし";
    let source = "";

    // 「タイトル - 発信元」の形式から発信元を抽出
    const lastHyphenIndex = rawTitle.lastIndexOf(" - ");
    if (lastHyphenIndex !== -1) {
      source = rawTitle.substring(lastHyphenIndex + 3).trim();
      rawTitle = rawTitle.substring(0, lastHyphenIndex).trim();
    }

    // 日時フォーマット (時:分)
    let formattedTime = "";
    if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!isNaN(d.getTime())) {
        formattedTime = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
    }

    // リンク先の図・画像 (enclosure / thumbnail / description / content 内のimgタグ) を多層抽出
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

    // 万一RSS側に画像が一切なかった場合の高品質デフォルト図 (科技・ガジェット / 自作PC・アキバ)
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

    // 記事要約 (HTMLタグや余分な空白を除去し、3〜5行分を確実に確保)
    let rawSummary = item.description || item.content || "";
    rawSummary = rawSummary.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (rawSummary.length > 280) rawSummary = rawSummary.substring(0, 280) + "...";

    return {
      title: rawTitle,
      source: source || item.author || (fallbackType === "tech" ? "GIZMODO" : "ASCII"),
      link: item.link || "#",
      time: formattedTime,
      thumbUrl: thumbUrl,
      summary: rawSummary || "タップして記事全文を読むことができます。"
    };
  });
}

// ニュースデータキャッシュとローテーション管理
const newsFeedsData = { yahoo: [], akiba: [] };
const featuredIndices = { yahoo: 0, akiba: 0 };
let featuredRotateTimer = null;

// ニュース一覧＆注目記事ボックスをDOMに描画 (3つの記事表示 ＋ 空いている領域に記事要約＋大きな図)
function renderNewsChannel(listElementId, featuredElementId, items, channelType) {
  const listEl = document.getElementById(listElementId);
  if (!listEl) return;

  newsFeedsData[channelType] = items || [];

  if (!items || items.length === 0) {
    listEl.innerHTML = `<li class="news-loading">現在表示できる情報がありません</li>`;
    const featuredEl = document.getElementById(featuredElementId);
    if (featuredEl) featuredEl.innerHTML = "";
    return;
  }

  // 1. 左側: 5つの最新記事リスト (右側にコンパクトなサムネイル)
  const listItems = items.slice(0, 5);
  listEl.innerHTML = listItems.map((item, idx) => {
    const url = item.link && item.link !== "#" ? escapeHtml(item.link) : "https://www.gizmodo.jp/";
    return `
      <li class="news-item ${idx === featuredIndices[channelType] ? "featured-active" : ""}" id="${channelType}-item-${idx}">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="news-item-link" title="タップしてブラウザで記事を読む" onclick="onNewsItemClick('${channelType}', ${idx}, event)">
          <div class="news-item-content">
            <div class="news-item-title">${escapeHtml(item.title)}</div>
            <div class="news-item-meta">
              ${item.source ? `<span class="news-source-tag">${escapeHtml(item.source)}</span>` : ""}
              ${item.time ? `<span class="news-item-time">${item.time}</span>` : ""}
              <span class="news-open-icon">記事 ↗</span>
            </div>
          </div>
          ${item.thumbUrl ? `
            <div class="news-item-thumb-wrap">
              <img src="${escapeHtml(item.thumbUrl)}" class="news-item-thumb" alt="図" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80';">
            </div>
          ` : ""}
        </a>
      </li>
    `;
  }).join("");

  // 2. 右側領域: 現在選択中の記事の大きな図＋要約サマリーを表示
  updateFeaturedDisplay(channelType, featuredIndices[channelType]);
}

// 右側注目ボックスの要約・大きな図の更新と、左側リストのアクティブ同期
function updateFeaturedDisplay(channelType, index) {
  const items = newsFeedsData[channelType];
  if (!items || items.length === 0) return;

  const maxCount = Math.min(5, items.length);
  const validIndex = index % maxCount;
  featuredIndices[channelType] = validIndex;
  const featuredItem = items[validIndex];

  // 左側リストのアクティブハイライト更新 (最大5件)
  for (let i = 0; i < maxCount; i++) {
    const itemEl = document.getElementById(`${channelType}-item-${i}`);
    if (itemEl) {
      if (i === validIndex) {
        itemEl.classList.add("featured-active");
      } else {
        itemEl.classList.remove("featured-active");
      }
    }
  }

  // 右側ボックスの更新
  const featuredEl = document.getElementById(`${channelType}-featured-box`);
  if (!featuredEl || !featuredItem) return;

  const fUrl = featuredItem.link && featuredItem.link !== "#" ? escapeHtml(featuredItem.link) : "https://www.gizmodo.jp/";
  featuredEl.innerHTML = `
    <a href="${fUrl}" target="_blank" rel="noopener noreferrer" class="news-featured-link" title="タップして記事全文を読む">
      <div class="news-featured-content">
        <div class="news-featured-title">${escapeHtml(featuredItem.title)}</div>
        <p class="news-featured-summary">${escapeHtml(featuredItem.summary)}</p>
        <div class="news-featured-meta-row">
          ${featuredItem.source ? `<span class="news-source-tag">${escapeHtml(featuredItem.source)}</span>` : ""}
          ${featuredItem.time ? `<span class="news-item-time">${featuredItem.time}</span>` : ""}
          <span class="news-featured-more">全文を読む ↗</span>
        </div>
      </div>
      <div class="news-featured-thumb-wrap">
        <img src="${escapeHtml(featuredItem.thumbUrl)}" class="news-featured-thumb" alt="注目図" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?w=240&auto=format&fit=crop&q=80';">
        <span class="featured-badge">注目・要約 #${validIndex + 1}</span>
      </div>
    </a>
  `;
}

// ユーザーが左側リストの記事をクリックした時の処理 (要約切り替え)
window.onNewsItemClick = function(channelType, index, event) {
  // リンク先への遷移も許可しつつ、右側の要約も即時その記事に切り替える
  updateFeaturedDisplay(channelType, index);
};

// 右側要約＋大きな図の自動ローテーション (6秒ごとに5つの記事を順番に巡回)
function initFeaturedRotation() {
  if (featuredRotateTimer) clearInterval(featuredRotateTimer);

  featuredRotateTimer = setInterval(() => {
    const items = newsFeedsData[currentNewsPane];
    if (items && items.length > 0) {
      const maxCount = Math.min(5, items.length);
      const nextIdx = (featuredIndices[currentNewsPane] + 1) % maxCount;
      updateFeaturedDisplay(currentNewsPane, nextIdx);
    }
  }, 6000); // 6秒ごとに次の記事へローテーション
}

// 全フィードの最新データ取得
async function loadFeeds() {
  // 1. 最新IT・ガジェットニュース (GIZMODO Japan)
  try {
    const yahooItems = await fetchRssFeed(CONFIG.news.yahooRssUrl, "tech");
    renderNewsChannel("yahoo-news-list", "yahoo-featured-box", yahooItems, "yahoo");
  } catch (err) {
    console.warn("ニュース取得リトライ/フォールバック:", err);
    renderNewsChannel("yahoo-news-list", "yahoo-featured-box", [
      { 
        title: "iPhone / Galaxy / Pixelの最新カメラスペック徹底比較レビュー", 
        source: "GIZMODO", 
        link: "https://www.gizmodo.jp/", 
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=240&auto=format&fit=crop&q=80",
        summary: "iPhone 17 Pro Max、Galaxy S25 Ultra、Pixel 10 Pro XLの動画性能やカメラ機能を徹底比較。各フラッグシップの強みが一目でわかります。"
      },
      { 
        title: "「Wi-Fi 7 / 8」対応の超高速次世代ルーターが早くもアキバに登場", 
        source: "テクノロジー", 
        link: "https://www.gizmodo.jp/", 
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=240&auto=format&fit=crop&q=80",
        summary: "最新規格Wi-Fi 7に対応した超高速ゲーミングルーターが秋葉原の各パーツショップに登場。実効スループットや通信安定性を検証。"
      },
      { 
        title: "新型スマートウォッチ、睡眠計測＆AI音声認識機能が大幅アップデート", 
        source: "ガジェット", 
        link: "https://www.gizmodo.jp/", 
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1510017803434-a899398421b3?w=240&auto=format&fit=crop&q=80",
        summary: "バッテリー持ちが向上し、生体センサーの精度が大幅に高まった最新スマートウォッチの実機レビューをお届けします。"
      },
      { 
        title: "Google AIと最新スマートホームデバイスが連携、生活が劇的に便利に", 
        source: "AI/テック", 
        link: "https://www.gizmodo.jp/", 
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=240&auto=format&fit=crop&q=80",
        summary: "Googleの最新生成AIとスマート家電が直接連携。音声による複雑な自動化ルーティンが自然な会話で実現します。"
      },
      { 
        title: "超薄型OLED採用の次世代スマートポータブルディスプレイが発表", 
        source: "新製品", 
        link: "https://www.gizmodo.jp/", 
        time: "最新",
        thumbUrl: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=240&auto=format&fit=crop&q=80",
        summary: "高コントラストで省電力な有機ELパネルを搭載した最新モバイルモニター。iPadやPCのサブディスプレイとして極めて高い実用性を誇ります。"
      }
    ], "yahoo");
  }

  // 2. アキバ・自作PC特価情報 (ASCII.jp)
  try {
    const akibaItems = await fetchRssFeed(CONFIG.news.akibaRssUrl, "akiba");
    renderNewsChannel("akiba-news-list", "akiba-featured-box", akibaItems, "akiba");
  } catch (err) {
    console.warn("アキバ特価情報リトライ/フォールバック:", err);
    renderNewsChannel("akiba-news-list", "akiba-featured-box", [
      { 
        title: "大容量20TB HDD/高速4TB NVMe SSDが週末限定セールで大幅値下げ", 
        source: "ASCII.jp", 
        link: "https://ascii.jp/", 
        time: "特価",
        thumbUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=240&auto=format&fit=crop&q=80",
        summary: "秋葉原各店にて大容量ストレージが週末限定特価。高速PCIe Gen4/Gen5対応の4TB SSDやNAS向けHDDが大幅値下げ中です。"
      },
      { 
        title: "人気ゲーミングコントローラーや周辺機器が最大30％オフのアキバ特価", 
        source: "アキバ市況", 
        link: "https://ascii.jp/", 
        time: "セール",
        thumbUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=240&auto=format&fit=crop&q=80",
        summary: "「グランツーリスモ7」に最適な人気ハンコンや各社ゲーミングデバイスがセール中。数量限定の掘り出し物が多数入荷しています。"
      },
      { 
        title: "最新RTXグラフィックボード＆Mini-ITXケースが店頭展示・販売開始", 
        source: "パーツ速報", 
        link: "https://ascii.jp/", 
        time: "新入荷",
        thumbUrl: "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=240&auto=format&fit=crop&q=80",
        summary: "コンパクトな自作PCに最適な省スペース設計のMini-ITXケースと高効率クーラー搭載ビデオカードがアキバ各店で販売開始。"
      },
      { 
        title: "秋葉原各ショップ、今週末の数量限定ジャンク＆掘り出し物まとめ", 
        source: "ASCII.jp", 
        link: "https://ascii.jp/", 
        time: "注目",
        thumbUrl: "https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=240&auto=format&fit=crop&q=80",
        summary: "中古スマホ、液晶モニター、掘り出し物ジャンクPCパーツのセール情報を一挙紹介。秋葉原巡りの前に要チェックです。"
      },
      { 
        title: "自作PC用高速DDR5メモリ＆水冷CPUクーラーの店頭タイムセール", 
        source: "パーツ特価", 
        link: "https://ascii.jp/", 
        time: "タイムセール",
        thumbUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=240&auto=format&fit=crop&q=80",
        summary: "冷却性能抜群の360mm簡易水冷キットとRGBライティング対応DDR5メモリが限定数特価で登場。週末の自作アップグレードに最適です。"
      }
    ], "akiba");
  }
}

// 30秒ごとのフェードイン・フェードアウト切り替え機能
function initFeedRotation() {
  const tabYahoo = document.getElementById("news-tab-yahoo");
  const tabAkiba = document.getElementById("news-tab-akiba");
  const paneYahoo = document.getElementById("pane-yahoo");
  const paneAkiba = document.getElementById("pane-akiba");
  const timerBar = document.getElementById("feed-timer-bar");

  const totalDuration = CONFIG.news.rotationSeconds; // 30秒

  function switchPane(target) {
    currentNewsPane = target;
    if (target === "yahoo") {
      paneYahoo.classList.add("active");
      paneAkiba.classList.remove("active");
      tabYahoo.classList.add("active");
      tabAkiba.classList.remove("active");
    } else {
      paneAkiba.classList.add("active");
      paneYahoo.classList.remove("active");
      tabAkiba.classList.add("active");
      tabYahoo.classList.remove("active");
    }
    // タブ切り替え時にそのチャンネルの現在の注目記事を表示
    updateFeaturedDisplay(target, featuredIndices[target]);
  }

  // プログレスバーと切り替えループ
  const tickIntervalMs = 200;
  let progressMs = 0;

  setInterval(() => {
    progressMs += tickIntervalMs;
    const percent = Math.min((progressMs / (totalDuration * 1000)) * 100, 100);
    if (timerBar) timerBar.style.width = `${percent}%`;

    if (progressMs >= totalDuration * 1000) {
      progressMs = 0;
      switchPane(currentNewsPane === "yahoo" ? "akiba" : "yahoo");
    }
  }, tickIntervalMs);
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
      if (saved.calendarUrl) CONFIG.calendar.embedUrl = extractUrlOrClean(saved.calendarUrl);
      // 妻 & 娘のGoogleマップURL
      if (saved.mapWifeUrl) CONFIG.map.wifeEmbedUrl = extractUrlOrClean(saved.mapWifeUrl);
      else if (saved.mapUrl) CONFIG.map.wifeEmbedUrl = extractUrlOrClean(saved.mapUrl); // 互換性
      if (saved.mapDaughterUrl) CONFIG.map.daughterEmbedUrl = extractUrlOrClean(saved.mapDaughterUrl);

      // YouTube & Premium
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
  const inputMapWife = document.getElementById("cfg-map-wife-url");
  const inputMapDaughter = document.getElementById("cfg-map-daughter-url");
  const checkYtPremium = document.getElementById("cfg-youtube-premium");
  const inputGoogleAccount = document.getElementById("cfg-google-account");
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
    if (inputMapWife) inputMapWife.value = CONFIG.map.wifeEmbedUrl || "";
    if (inputMapDaughter) inputMapDaughter.value = CONFIG.map.daughterEmbedUrl || "";
    if (checkYtPremium) checkYtPremium.checked = !!CONFIG.youtube.isPremium;
    if (inputGoogleAccount) inputGoogleAccount.value = CONFIG.youtube.googleAccount || "";
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
        calendarUrl: inputCal ? extractUrlOrClean(inputCal.value) : "",
        mapWifeUrl: inputMapWife ? extractUrlOrClean(inputMapWife.value) : "",
        mapDaughterUrl: inputMapDaughter ? extractUrlOrClean(inputMapDaughter.value) : "",
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

  // 1. カレンダー (様々なキー名やiframeタグ貼り付けに対応)
  let calVal = "";
  if (parsed.calendar && typeof parsed.calendar === "object") {
    calVal = parsed.calendar.embedUrl || parsed.calendar.url || parsed.calendar.src || "";
  } else if (typeof parsed.calendar === "string") {
    calVal = parsed.calendar;
  }
  if (!calVal) {
    calVal = parsed.calendarUrl || parsed.calendar_url || parsed.calendarEmbedUrl || "";
  }
  if (calVal) currentSettings.calendarUrl = extractUrlOrClean(calVal);

  // 2. マップ / 家族の位置情報 (妻 & 娘の柔軟なキー名対応)
  let wifeVal = "";
  let daughterVal = "";

  if (parsed.map && typeof parsed.map === "object") {
    wifeVal = parsed.map.wifeEmbedUrl || parsed.map.wifeUrl || parsed.map.wife || parsed.map.wife_embed_url || parsed.map.wife_url || parsed.map.wifeLocation || "";
    daughterVal = parsed.map.daughterEmbedUrl || parsed.map.daughterUrl || parsed.map.daughter || parsed.map.daughter_embed_url || parsed.map.daughter_url || parsed.map.daughterLocation || "";
  }
  if (!wifeVal) {
    wifeVal = parsed.mapWifeUrl || parsed.mapWife || parsed.wifeEmbedUrl || parsed.wifeUrl || parsed.wife || "";
  }
  if (!daughterVal) {
    daughterVal = parsed.mapDaughterUrl || parsed.mapDaughter || parsed.daughterEmbedUrl || parsed.daughterUrl || parsed.daughter || "";
  }

  // family または location キーでの記述にもフォールバック対応
  if (parsed.family && typeof parsed.family === "object") {
    if (!wifeVal) wifeVal = parsed.family.wifeUrl || parsed.family.wife || parsed.family.wifeEmbedUrl || "";
    if (!daughterVal) daughterVal = parsed.family.daughterUrl || parsed.family.daughter || parsed.family.daughterEmbedUrl || "";
  }
  if (parsed.location && typeof parsed.location === "object") {
    if (!wifeVal) wifeVal = parsed.location.wifeUrl || parsed.location.wife || parsed.location.wifeEmbedUrl || "";
    if (!daughterVal) daughterVal = parsed.location.daughterUrl || parsed.location.daughter || parsed.location.daughterEmbedUrl || "";
  }

  if (wifeVal) currentSettings.mapWifeUrl = extractUrlOrClean(wifeVal);
  if (daughterVal) currentSettings.mapDaughterUrl = extractUrlOrClean(daughterVal);

  // 3. YouTube & Premium
  if (parsed.youtube && typeof parsed.youtube === "object") {
    if (typeof parsed.youtube.isPremium === "boolean") currentSettings.youtubeIsPremium = parsed.youtube.isPremium;
    if (parsed.youtube.googleAccount) currentSettings.googleAccount = parsed.youtube.googleAccount.trim();
    if (parsed.youtube.email) currentSettings.googleAccount = parsed.youtube.email.trim();
    if (typeof parsed.youtube.adFreeMode === "boolean") currentSettings.adFreeMode = parsed.youtube.adFreeMode;
    if (parsed.youtube.genre) currentSettings.youtubeGenre = parsed.youtube.genre;
    if (Array.isArray(parsed.youtube.customVideoIds)) currentSettings.youtubeCustomIds = parsed.youtube.customVideoIds;
  }
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
  if (parsed.openWeatherApiKey) currentSettings.openWeatherApiKey = parsed.openWeatherApiKey;

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
      wifeEmbedUrl: CONFIG.map.wifeEmbedUrl || "",
      daughterEmbedUrl: CONFIG.map.daughterEmbedUrl || ""
    },
    weather: {
      currentLocationName: CONFIG.weather.currentLocationName || "",
      provider: CONFIG.weather.provider || "open-meteo",
      openWeatherApiKey: (CONFIG.weather.openWeatherApiKey !== "YOUR_OPENWEATHER_API_KEY") ? (CONFIG.weather.openWeatherApiKey || "") : ""
    },
    youtube: {
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
  initFeedRotation();
  initFeaturedRotation(); // 注目記事(大きな図+要約)の6秒自動ローテーション
  setInterval(loadFeeds, CONFIG.news.refreshIntervalMinutes * 60 * 1000);

  // 5. 設定モーダル初期化
  initSettingsModal();
});


