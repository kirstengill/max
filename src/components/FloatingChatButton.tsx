import React from 'react';
import { MessageSquareText, Send } from 'lucide-react';
import { TELEGRAM_HELP_URL } from '../constants/links';

interface FloatingChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  onClick,
  unreadCount = 0,
}) => {
  return (
    <div className="absolute right-4 bottom-16 z-30 flex flex-col items-center gap-2.5">
      {/* Floating Telegram Helpline Button */}
      <a
        id="btn-floating-telegram"
        href={TELEGRAM_HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct Telegram Helpline"
        title="Chat on Telegram"
        className="w-11 h-11 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(0,136,204,0.45)] hover:bg-[#179cde] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-sky-300/30"
      >
        <Send className="w-5 h-5 text-white -translate-x-0.5 translate-y-0.5" />
      </a>

      {/* Floating AI Support Button */}
      <button
        id="btn-floating-chat"
        onClick={onClick}
        aria-label="Open Live Support & Assistant"
        title="AI Concierge Support"
        className="w-13 h-13 rounded-full bg-[#1657D9] text-white flex items-center justify-center shadow-[0_8px_20px_-2px_rgba(22,87,217,0.45)] hover:bg-blue-700 active:scale-90 transition-all cursor-pointer"
      >
        <MessageSquareText className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};


