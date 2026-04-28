import { useEffect, useState } from 'react';

export default function LessonImageThumbnail({ imageUrl, title, className = '', fit = 'cover' }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!imageUrl) return null;

  const thumbnailClassName = className ? `training-lesson-thumbnail ${className}` : 'training-lesson-thumbnail';

  return (
    <>
      <button
        type="button"
        className={thumbnailClassName}
        onClick={() => setIsOpen(true)}
        aria-label="Open lesson image"
      >
        <img src={imageUrl} alt={`${title} visual thumbnail`} style={{ objectFit: fit }} />
      </button>
      {isOpen ? (
        <div
          className="lesson-image-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Lesson image preview"
          onClick={() => setIsOpen(false)}
        >
          <div className="lesson-image-modal-content" onClick={(event) => event.stopPropagation()}>
            <img src={imageUrl} alt={`${title} visual`} />
            <button type="button" className="btn ghost lesson-image-modal-close" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
