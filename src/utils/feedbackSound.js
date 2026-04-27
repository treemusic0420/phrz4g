const createAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  return new AudioContextClass();
};

const playTone = async ({ frequency = 440, duration = 0.12, type = 'sine', gainValue = 0.05 }) => {
  if (typeof window === 'undefined') return;
  const context = createAudioContext();
  if (!context) return;

  try {
    if (context.state === 'suspended') await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => {
      context.close();
    };
  } catch (error) {
    context.close();
  }
};

export const playCorrectSound = async () => {
  await playTone({ frequency: 880, duration: 0.08, type: 'sine', gainValue: 0.04 });
  await playTone({ frequency: 1174, duration: 0.11, type: 'sine', gainValue: 0.04 });
};

export const playIncorrectSound = async () => {
  await playTone({ frequency: 220, duration: 0.14, type: 'triangle', gainValue: 0.05 });
};

export const playDictationCompleteSound = async () => {
  await playTone({ frequency: 784, duration: 0.1, type: 'sine', gainValue: 0.02 });
  await playTone({ frequency: 988, duration: 0.12, type: 'sine', gainValue: 0.02 });
};

export const playDictationWrongKeySound = async () => {
  await playTone({ frequency: 196, duration: 0.09, type: 'triangle', gainValue: 0.015 });
};
