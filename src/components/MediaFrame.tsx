import { useState } from 'react';
import { Film, Image as ImageIcon, User } from 'lucide-react';
import { getFilterById } from '../lib/filters';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: 'unviewed' | 'viewed' | 'none';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20 sm:w-24 sm:h-24',
};

export function Avatar({ src, name, size = 'md', ring = 'none', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const ringWrapper =
    ring === 'unviewed'
      ? 'p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-300 rounded-full'
      : ring === 'viewed'
        ? 'p-[2px] bg-zinc-700 rounded-full'
        : '';

  return (
    <div className={`inline-flex shrink-0 ${ringWrapper} ${className}`}>
      <div
        className={`${SIZE_CLASSES[size]} rounded-full overflow-hidden bg-zinc-800 border border-zinc-950 flex items-center justify-center`}
      >
        {src && !failed ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-1/2 h-1/2 text-zinc-400" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

interface MediaFrameProps {
  src: string;
  alt: string;
  isVideo?: boolean;
  isAnimatedPhoto?: boolean;
  filterId?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function MediaFrame({
  src,
  alt,
  isVideo = false,
  isAnimatedPhoto = false,
  filterId = 'original',
  className = '',
  autoPlay = true,
  muted = true,
  loop = true,
  controls = false,
  onClick,
  onDoubleClick,
}: MediaFrameProps) {
  const [failed, setFailed] = useState(false);
  const filter = getFilterById(filterId);

  if (failed || !src) {
    return (
      <div
        onClick={onClick}
        className={`w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-500 ${className}`}
      >
        {isVideo ? <Film className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
        <span className="text-xs text-zinc-400 px-4 text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  const isActualVideoFile =
    isVideo &&
    (src.endsWith('.mp4') ||
      src.endsWith('.webm') ||
      src.endsWith('.mov') ||
      src.startsWith('data:video/') ||
      src.startsWith('blob:'));

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative w-full h-full overflow-hidden bg-zinc-950 ${className}`}
    >
      {isActualVideoFile ? (
        <video
          src={src}
          playsInline
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          controls={controls}
          onError={() => setFailed(true)}
          style={{ filter: filter.cssFilter }}
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ filter: filter.cssFilter }}
          className={`w-full h-full object-cover ${isAnimatedPhoto ? 'animate-reel-motion' : ''}`}
        />
      )}
      {filter.overlayClass && (
        <div className={`pointer-events-none absolute inset-0 ${filter.overlayClass}`} />
      )}
    </div>
  );
}
