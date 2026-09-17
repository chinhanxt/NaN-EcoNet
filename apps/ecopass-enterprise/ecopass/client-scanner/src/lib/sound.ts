// Web Audio API Synthesizer for Zero-Dependency Sound Effects
// Works offline on all modern mobile & desktop browsers (iOS Safari, Android Chrome)

export const playScanBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  } catch (err) {
    // ignore audio block
  }
};

export const playLockSuccess = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    // Two rapid crisp confirmation beeps: B5 (987.77 Hz) -> E6 (1318.51 Hz)
    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.24);
    });
  } catch (err) {
    // ignore
  }
};

export const playVoucherTing = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // 1. Golden Reward Chime Arpeggio: C6 -> E6 -> G6 -> C7
    const notes = [1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const startTime = ctx.currentTime + idx * 0.07;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.9);
    });

    // 2. High-frequency Shimmer Bell (E7 - 2637 Hz) for the sparkling finish
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = "triangle";
    const shimmerTime = ctx.currentTime + 0.22;
    shimmer.frequency.setValueAtTime(2637.02, shimmerTime);

    shimmerGain.gain.setValueAtTime(0.2, shimmerTime);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, shimmerTime + 1.2);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    shimmer.start(shimmerTime);
    shimmer.stop(shimmerTime + 1.25);
  } catch (err) {
    console.log("AudioContext play error:", err);
  }
};

export const playErrorBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (err) {
    // ignore
  }
};

// Tạo xung rung vật lý qua màng loa điện thoại (hoạt động 100% trên cả iPhone và Android)
const playAcousticHapticThump = (durationMs = 80, freq = 65) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Xung sub-bass cực mạnh để tạo độ giật cơ học trong lòng bàn tay người cầm máy
    gain.gain.setValueAtTime(0.98, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (durationMs / 1000) + 0.04);
  } catch (err) {
    // ignore
  }
};

// Kích hoạt Taptic Engine của iPhone trên Safari qua thủ thuật native switch
const triggerIosSafariHaptic = () => {
  try {
    if (typeof document === "undefined") return;
    let label = document.getElementById("ecopass-ios-haptic-lbl") as HTMLLabelElement | null;
    let input = document.getElementById("ecopass-ios-haptic-input") as HTMLInputElement | null;

    if (!input || !label) {
      input = document.createElement("input");
      input.id = "ecopass-ios-haptic-input";
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      input.style.zIndex = "-999";
      input.style.top = "-9999px";

      label = document.createElement("label") as HTMLLabelElement;
      label.id = "ecopass-ios-haptic-lbl";
      label.htmlFor = "ecopass-ios-haptic-input";
      label.style.position = "fixed";
      label.style.top = "-9999px";

      document.body.appendChild(input);
      document.body.appendChild(label);
    }

    label.click();
  } catch (e) {
    // ignore
  }
};

// Hàm rung đa nền tảng: Hỗ trợ Android (Vibration API), iPhone (Taptic Hack + Loa rung Sub-bass)
export const vibrateDevice = (pattern: number | number[] = 70) => {
  try {
    // 1. Chuẩn Android / Chrome
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }

    // 2. iOS Safari Taptic Engine
    triggerIosSafariHaptic();

    // 3. Xung rung vật lý qua loa điện thoại
    const duration = Array.isArray(pattern) ? (pattern[0] || 80) : pattern;
    playAcousticHapticThump(duration, 60);

    // Nếu là mẫu rung lỗi nhiều nhịp
    if (Array.isArray(pattern) && pattern.length > 1) {
      setTimeout(() => {
        triggerIosSafariHaptic();
        playAcousticHapticThump(pattern[2] || 80, 50);
      }, (pattern[0] || 80) + (pattern[1] || 80));
    }
  } catch (err) {
    // ignore
  }
};


