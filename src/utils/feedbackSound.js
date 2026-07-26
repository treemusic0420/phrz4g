let audioContext;

const createAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass();
  }
  return audioContext;
};

const playTone = async ({
  frequency = 440,
  endFrequency = frequency,
  duration = 0.12,
  attack = 0,
  type = 'sine',
  gainValue = 0.05,
}) => {
  const context = createAudioContext();
  if (!context) return;

  try {
    if (context.state === 'suspended') await context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
    gain.gain.setValueAtTime(attack > 0 ? 0.0001 : gainValue, context.currentTime);
    if (attack > 0) {
      gain.gain.linearRampToValueAtTime(gainValue, context.currentTime + attack);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {}
};

export const playDictationWrongKeySound = async () => {
  await playTone({
    frequency: 660,
    endFrequency: 520,
    duration: 0.085,
    attack: 0.004,
    type: 'triangle',
    gainValue: 0.052,
  });
};

export const playDictationCompleteSound = async () => {
  await playTone({
    frequency: 1320,
    endFrequency: 1175,
    duration: 0.13,
    attack: 0.003,
    type: 'sine',
    gainValue: 0.065,
  });
};

export const playCorrectSound = async () => {
  await playTone({ frequency: 880, duration: 0.08, type: 'sine', gainValue: 0.04 });
  await playTone({ frequency: 1174, duration: 0.11, type: 'sine', gainValue: 0.04 });
};

export const playIncorrectSound = async () => {
  await playTone({ frequency: 220, duration: 0.14, type: 'triangle', gainValue: 0.05 });
};
