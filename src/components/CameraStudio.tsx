import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Film,
  ImagePlus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { CAMERA_FILTERS, getFilterById } from '../lib/filters';
import type { AuthUser, UserSummary } from '../types';
import { Avatar } from './MediaFrame';

type PublishMode = 'post' | 'story' | 'reel' | 'snap';

interface CameraStudioProps {
  currentUser: AuthUser | null;
  suggestedUsers: UserSummary[];
  initialMode?: PublishMode;
  onRequireAuth: (reason: string) => void;
  onPublished: (mode: PublishMode) => void;
}

const STUDIO_CANVAS_BACKDROPS = [
  {
    label: 'Tokyo Rain',
    src: '/src/assets/images/post_tokyo_rain_1795026376614.jpg',
  },
  {
    label: 'Rooftop Dusk',
    src: '/src/assets/images/story_rooftop_dusk_1795026377393.jpg',
  },
  {
    label: 'Vinyl Studio',
    src: '/src/assets/images/post_vinyl_studio_1795026377323.jpg',
  },
];

export function CameraStudio({
  currentUser,
  suggestedUsers,
  initialMode = 'post',
  onRequireAuth,
  onPublished,
}: CameraStudioProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [publishMode, setPublishMode] = useState<PublishMode>(initialMode);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'starting' | 'live' | 'unavailable'>('starting');
  const [selectedFilter, setSelectedFilter] = useState('original');
  const [capturedMedia, setCapturedMedia] = useState<{
    dataUrl: string;
    type: 'image' | 'video';
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [snapRecipientId, setSnapRecipientId] = useState(suggestedUsers[0]?.id || '');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPublishMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!snapRecipientId && suggestedUsers[0]?.id) {
      setSnapRecipientId(suggestedUsers[0].id);
    }
  }, [suggestedUsers, snapRecipientId]);

  useEffect(() => {
    if (capturedMedia) {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [facingMode, capturedMedia]);

  useEffect(() => {
    if (!isRecording) {
      setRecordSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }
    setCameraState('starting');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraState('live');
    } catch {
      setCameraState('unavailable');
    }
  }

  function handleCapturePhoto() {
    if (!videoRef.current || cameraState !== 'live') return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activeFilter = getFilterById(selectedFilter);
    ctx.filter = activeFilter.cssFilter === 'none' ? 'none' : activeFilter.cssFilter;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedMedia({ dataUrl, type: 'image' });
  }

  function handleToggleRecordVideo() {
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (!streamRef.current || typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser. You can upload a video clip instead.');
      return;
    }
    try {
      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setCapturedMedia({ dataUrl: reader.result, type: 'video' });
          }
        };
        reader.readAsDataURL(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Could not start video recording. Try uploading a video file.');
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 14 * 1024 * 1024) {
      setError('Selected file must be under 14 MB.');
      return;
    }
    setError(null);
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setCapturedMedia({ dataUrl: reader.result, type: isVideo ? 'video' : 'image' });
        if (isVideo && publishMode === 'post') {
          setPublishMode('reel');
        }
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSelectStudioPreset(url: string) {
    setError(null);
    setCapturedMedia({ dataUrl: url, type: 'image' });
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth('Sign in to publish posts, 24-hour stories, reels, or send snaps.');
      return;
    }
    if (!capturedMedia) {
      setError('Capture a photo/video or upload media first.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      if (publishMode === 'story') {
        await api.createStory({
          mediaDataUrl: capturedMedia.dataUrl,
          filterId: selectedFilter,
          captionOverlay: caption.trim(),
        });
      } else if (publishMode === 'snap') {
        if (!snapRecipientId) {
          throw new Error('Select a friend to send your Snap.');
        }
        await api.sendMessage(snapRecipientId, {
          text: caption.trim() || 'Sent a Snap',
          mediaDataUrl: capturedMedia.dataUrl,
          isEphemeralSnap: true,
        });
      } else {
        await api.createPost({
          mediaDataUrl: capturedMedia.dataUrl,
          kind: publishMode === 'reel' ? 'reel' : capturedMedia.type === 'video' ? 'video' : 'photo',
          filterId: selectedFilter,
          caption: caption.trim(),
          location: location.trim(),
        });
      }
      setCapturedMedia(null);
      setCaption('');
      setLocation('');
      onPublished(publishMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  }

  const activeFilter = getFilterById(selectedFilter);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Camera Studio</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Capture live frames, apply color grades, or upload from your camera roll
          </p>
        </div>

        {/* Publish destination tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#121216] border border-white/[0.08] rounded-xl">
          {(
            [
              { id: 'post', label: 'Post' },
              { id: 'story', label: '24h Story' },
              { id: 'reel', label: 'Reel' },
              { id: 'snap', label: 'Snap DM' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPublishMode(tab.id)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                publishMode === tab.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Viewfinder / Preview Stage */}
        <div className="lg:col-span-7 bg-[#121216] border border-white/[0.08] rounded-3xl overflow-hidden">
          <div className="relative aspect-[3/4] bg-zinc-950 flex items-center justify-center overflow-hidden">
            {capturedMedia ? (
              <>
                {capturedMedia.type === 'video' ? (
                  <video
                    src={capturedMedia.dataUrl}
                    playsInline
                    autoPlay
                    loop
                    muted
                    controls
                    style={{ filter: activeFilter.cssFilter }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={capturedMedia.dataUrl}
                    alt="Captured preview"
                    style={{ filter: activeFilter.cssFilter }}
                    className="w-full h-full object-cover"
                  />
                )}
                {activeFilter.overlayClass && (
                  <div className={`pointer-events-none absolute inset-0 ${activeFilter.overlayClass}`} />
                )}
                {publishMode === 'story' && caption.trim() && (
                  <div className="pointer-events-none absolute inset-x-6 bottom-12 text-center">
                    <span className="inline-block px-3.5 py-2 rounded-xl bg-black/65 backdrop-blur-md text-sm font-medium text-white">
                      {caption}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCapturedMedia(null)}
                  aria-label="Retake or clear media"
                  className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/15 hover:bg-black"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : cameraState === 'live' ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{
                    filter: activeFilter.cssFilter,
                    transform: facingMode === 'user' ? 'scaleX(-1)' : undefined,
                  }}
                  className="w-full h-full object-cover"
                />
                {activeFilter.overlayClass && (
                  <div className={`pointer-events-none absolute inset-0 ${activeFilter.overlayClass}`} />
                )}

                {isRecording && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold tabular-nums flex items-center gap-2">
                    <span>REC</span>
                    <span>00:{String(recordSeconds).padStart(2, '0')}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
                  aria-label="Switch front or rear camera"
                  className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-full bg-black/65 backdrop-blur-md text-white flex items-center justify-center border border-white/15"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="p-6 text-center max-w-sm space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {cameraState === 'starting' ? 'Connecting camera...' : 'Studio Upload Ready'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Upload a photo or video from your device, or pick a curated studio frame below to test filters and publishing.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-11 px-4 rounded-xl bg-white text-zinc-950 font-semibold text-xs flex items-center gap-2 hover:bg-zinc-200"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photo / Video
                  </button>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="h-11 px-4 rounded-xl bg-zinc-800 text-white font-medium text-xs hover:bg-zinc-700"
                  >
                    Retry Camera
                  </button>
                </div>

                <div className="pt-2">
                  <div className="text-xs text-zinc-500 mb-2">Or test with a studio frame</div>
                  <div className="grid grid-cols-3 gap-2">
                    {STUDIO_CANVAS_BACKDROPS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleSelectStudioPreset(item.src)}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-amber-400 transition-colors"
                      >
                        <img
                          src={item.src}
                          alt={item.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 text-[10px] text-white py-1 px-1 truncate">
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Shutter / Controls Bar when camera is live */}
            {!capturedMedia && cameraState === 'live' && (
              <div className="absolute inset-x-0 bottom-4 px-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload from device"
                  className="min-w-[48px] min-h-[48px] rounded-2xl bg-black/65 backdrop-blur-md border border-white/15 text-white flex items-center justify-center"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  aria-label="Take photo"
                  className="w-16 h-16 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="w-full h-full rounded-full bg-white block" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleRecordVideo}
                  aria-label={isRecording ? 'Stop recording' : 'Record video'}
                  className={`min-w-[48px] min-h-[48px] rounded-2xl backdrop-blur-md border flex items-center justify-center ${
                    isRecording
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-black/65 border-white/15 text-white'
                  }`}
                >
                  {isRecording ? <Square className="w-4 h-4 fill-white" /> : <Video className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>

          {/* Filter Strip */}
          <div className="p-3.5 border-t border-white/[0.07]">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Color Grade &amp; Filter</span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {CAMERA_FILTERS.map((filter) => {
                const active = selectedFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`flex flex-col items-center gap-1.5 shrink-0 px-2.5 py-2 rounded-xl border transition-colors ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-zinc-900/70 border-white/[0.06] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full border border-white/20"
                      style={{ backgroundColor: filter.swatchColor }}
                    />
                    <span className="text-[11px] font-medium whitespace-nowrap">{filter.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Publish Form */}
        <form
          onSubmit={handlePublish}
          className="lg:col-span-5 bg-[#121216] border border-white/[0.08] rounded-3xl p-5 space-y-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelected}
            className="hidden"
          />

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              {publishMode === 'story'
                ? 'Share to 24h Story'
                : publishMode === 'reel'
                  ? 'Publish Vertical Reel'
                  : publishMode === 'snap'
                    ? 'Send Ephemeral Snap'
                    : 'Create Feed Post'}
            </h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Choose file
            </button>
          </div>

          {publishMode === 'snap' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Send Snap to</label>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {suggestedUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSnapRecipientId(u.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-colors ${
                      snapRecipientId === u.id
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-zinc-900 border-white/[0.07] text-zinc-400'
                    }`}
                  >
                    <Avatar src={u.avatarUrl} name={u.displayName} size="xs" />
                    <span className="text-xs font-medium">{u.username}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              {publishMode === 'story' ? 'Story overlay text' : 'Caption & hashtags'}
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                publishMode === 'story'
                  ? 'Add a quick note over your 24h story...'
                  : 'Write a caption... use #street #nightfilm'
              }
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-white/[0.09] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {(publishMode === 'post' || publishMode === 'reel') && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Tokyo, London, New York..."
                className="w-full h-11 px-3.5 bg-zinc-950 border border-white/[0.09] rounded-xl text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div className="pt-1 flex items-center gap-3">
            <button
              type="submit"
              disabled={publishing || !capturedMedia}
              className="flex-1 h-12 rounded-xl bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-40"
            >
              {publishMode === 'snap' ? (
                <Send className="w-4 h-4" />
              ) : publishMode === 'reel' ? (
                <Film className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {publishing
                  ? 'Publishing...'
                  : publishMode === 'story'
                    ? 'Share to Story (24h)'
                    : publishMode === 'snap'
                      ? 'Send Ephemeral Snap'
                      : publishMode === 'reel'
                        ? 'Publish Reel'
                        : 'Publish Post'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
