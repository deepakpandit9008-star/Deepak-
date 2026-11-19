import { Plus } from 'lucide-react';
import type { AuthUser, StoryGroup } from '../types';
import { Avatar } from './MediaFrame';

interface StoryBarProps {
  storyGroups: StoryGroup[];
  currentUser: AuthUser | null;
  onSelectGroup: (index: number) => void;
  onCreateStory: () => void;
}

export function StoryBar({
  storyGroups,
  currentUser,
  onSelectGroup,
  onCreateStory,
}: StoryBarProps) {
  return (
    <section
      aria-label="24-hour stories"
      className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-2 px-1"
    >
      {/* Add story button */}
      <button
        type="button"
        onClick={onCreateStory}
        className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px] group"
      >
        <div className="relative w-16 h-16 rounded-full bg-[#121216] border border-white/15 flex items-center justify-center group-hover:border-amber-400/70 transition-colors">
          {currentUser ? (
            <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="lg" />
          ) : (
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400">
              <Plus className="w-6 h-6" />
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-amber-500 text-zinc-950 border-2 border-[#09090B] flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 stroke-[2.75]" />
          </span>
        </div>
        <span className="text-xs text-zinc-300 max-w-[70px] truncate">Your story</span>
      </button>

      {/* Active 24h story rings */}
      {storyGroups.map((group, idx) => (
        <button
          key={group.author.id}
          type="button"
          onClick={() => onSelectGroup(idx)}
          className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px] group"
        >
          <Avatar
            src={group.author.avatarUrl}
            name={group.author.displayName}
            size="lg"
            ring={group.hasUnviewed ? 'unviewed' : 'viewed'}
            className="group-active:scale-95 transition-transform"
          />
          <span className="text-xs text-zinc-200 max-w-[72px] truncate">
            {group.author.id === currentUser?.id ? 'You' : group.author.username}
          </span>
        </button>
      ))}
    </section>
  );
}
