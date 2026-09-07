import React from 'react';
import { Send, ExternalLink } from 'lucide-react';
import { TELEGRAM_HELP_URL } from '../constants/links';

export const TelegramHelpCard: React.FC = () => {
  return (
    <div className="px-5 my-3">
      <a
        id="card-telegram-help"
        href={TELEGRAM_HELP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-2xl bg-gradient-to-r from-[#0088cc] via-[#179cde] to-[#229ED9] p-4 text-white shadow-md shadow-sky-900/15 hover:shadow-lg hover:shadow-sky-900/25 transition-all duration-200 active:scale-[0.99] border border-sky-300/30"
      >
        {/* Subtle background glow effect */}
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
        
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-xs shrink-0 group-hover:bg-white/25 transition-colors">
              <Send className="w-5 h-5 text-white -translate-x-0.5 translate-y-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-black tracking-tight text-white flex items-center gap-1">
                  Official Telegram Helpline
                </span>
                <span className="text-[9.5px] font-extrabold uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.2 rounded-full border border-white/25">
                  24/7 Live
                </span>
              </div>
              <p className="text-[11.5px] text-sky-100 font-medium leading-tight mt-0.5">
                Connect directly with support agents on Telegram, verify deposits, & get instant assistance.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white text-sky-700 shadow-xs group-hover:translate-x-0.5 transition-transform">
            <ExternalLink className="w-4 h-4" />
          </div>
        </div>
      </a>
    </div>
  );
};
