import { useEffect, useRef, useState } from 'react';

const SPEEDS = [0.8, 1.0, 1.2];

export default function AudioControls({
  audioUrl,
  audioContentType = 'audio/mpeg',
  onStatusChange,
  onErrorMessage,
  shouldAutoPlay = false,
  autoPlayToken = 0,
  onAutoPlayBlocked,
}) {
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!audioUrl) {
      setLocalError('Audio URL is missing.');
      onStatusChange?.('idle');
      onErrorMessage?.('Audio URL is missing.');
      return;
    }
    setLocalError('');
    onStatusChange?.('loading');
    onErrorMessage?.('');
  }, [audioUrl, onErrorMessage, onStatusChange]);

  useEffect(() => {
    if (!audioUrl || !shouldAutoPlay) return undefined;
    const audio = audioRef.current;
    if (!audio) return undefined;

    let canceled = false;
    let rafId = 0;

    const tryPlay = () => {
      if (canceled) return;
      audio.playbackRate = speed;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (!canceled) onAutoPlayBlocked?.('Tap play to start the audio.');
        });
      }
    };

    if (audio.readyState >= 2) {
      rafId = window.requestAnimationFrame(tryPlay);
      return () => {
        canceled = true;
        window.cancelAnimationFrame(rafId);
      };
    }

    const handleCanPlay = () => {
      audio.removeEventListener('canplay', handleCanPlay);
      tryPlay();
    };
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      canceled = true;
      audio.removeEventListener('canplay', handleCanPlay);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [audioUrl, autoPlayToken, onAutoPlayBlocked, shouldAutoPlay, speed]);

  const rewind = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
  };

  const changeSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
  };

  const handleAudioError = () => {
    const mediaError = audioRef.current?.error;
    const codeMap = {
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
    };
    const detail = mediaError?.code ? `${codeMap[mediaError.code] || 'UNKNOWN'}(${mediaError.code})` : 'unknown';
    const message = `Failed to load audio: ${detail}`;
    setLocalError(message);
    onStatusChange?.('error');
    onErrorMessage?.(message);
  };

  return (
    <div className="audio-box">
      {audioUrl ? (
        <audio
          controls
          ref={audioRef}
          onLoadStart={() => {
            onStatusChange?.('loading');
            onErrorMessage?.('');
          }}
          onLoadedMetadata={() => onStatusChange?.('loadedmetadata')}
          onCanPlay={() => onStatusChange?.('canplay')}
          onPlay={() => onAutoPlayBlocked?.('')}
          onError={handleAudioError}
        >
          <source src={audioUrl} type={audioContentType || 'audio/mpeg'} />
        </audio>
      ) : null}
      {localError ? <p className="audio-debug">{localError}</p> : null}
      <div className="row gap-sm wrap">
        <button type="button" onClick={rewind}>
          Back 5s
        </button>
        {SPEEDS.map((item) => (
          <button
            className={speed === item ? 'active-btn' : 'btn ghost'}
            key={item}
            onClick={() => changeSpeed(item)}
            type="button"
          >
            {item.toFixed(1)}x
          </button>
        ))}
      </div>
    </div>
  );
}
