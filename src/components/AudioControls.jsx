import { useRef, useState } from 'react';

const SPEEDS = [0.8, 1.0, 1.2];

export default function AudioControls({ audioUrl }) {
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);

  const rewind = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
  };

  const changeSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
  };

  return (
    <div className="audio-box">
      <audio controls ref={audioRef} src={audioUrl} />
      <div className="row gap-sm">
        <button type="button" onClick={rewind}>
          5秒戻る
        </button>
        {SPEEDS.map((item) => (
          <button
            className={speed === item ? 'active-btn' : ''}
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
