// Konum bazlı hava durumu: tarayıcı Geolocation API + Open-Meteo (ücretsiz, anahtarsız).

const COMPASS_DIRS = ["K", "KKD", "KD", "DKD", "D", "DGD", "GD", "GGD", "G", "GGB", "GB", "BGB", "B", "BKB", "KB", "KKB"];

function degToCompass(deg) {
  const idx = Math.round(deg / 22.5) % 16;
  return COMPASS_DIRS[idx];
}

function formatDegree(deg) {
  return deg.toFixed(1).replace(".", ",");
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Bu cihaz/tarayıcı konum servisini desteklemiyor."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Konumdan güncel hava durumunu okunabilir tek satır Türkçe metin olarak döndürür.
export async function fetchWeatherDescription() {
  let position;
  try {
    position = await getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  } catch (err) {
    if (err && err.code === 1) {
      throw new Error("Konum izni reddedildi. Tarayıcı/site ayarlarından izin verip tekrar deneyin.");
    }
    if (err && err.code === 3) {
      throw new Error("Konum alma zaman aşımına uğradı. Tekrar deneyin.");
    }
    throw new Error("Konum alınamadı.");
  }

  const { latitude, longitude } = position.coords;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
    `&wind_speed_unit=ms&timezone=auto`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error("Hava durumu servisine ulaşılamadı. İnternet bağlantınızı kontrol edin.");
  }
  if (!response.ok) {
    throw new Error(`Hava durumu servisi hata döndürdü (${response.status}).`);
  }

  const data = await response.json();
  const c = data && data.current;
  if (!c) {
    throw new Error("Hava durumu verisi alınamadı.");
  }

  const temp = Math.round(c.temperature_2m);
  const wind = c.wind_speed_10m.toFixed(1);
  const gust = c.wind_gusts_10m.toFixed(1);
  const windDir = degToCompass(c.wind_direction_10m);
  const windDeg = formatDegree(c.wind_direction_10m);

  return `${temp}°C - ${wind} m/s (${gust} m/s) - ${windDir}(${windDeg}°)`;
}
