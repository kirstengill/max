import React, { useState } from 'react';
import { X, Send, Bot, User, Sparkles, HelpCircle, MessageCircle, ExternalLink } from 'lucide-react';
import { ChatMessage } from '../types';
import { WHATSAPP_HELP_URL } from '../constants/links';

interface SupportChatModalProps {
  onClose: () => void;
}

export const SupportChatModal: React.FC<SupportChatModalProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'support',
      text: 'Hello! Welcome to VESTRA — Sovereign Institutional Yields. How can I assist you with yield vault allocations, MTN MoMo / Airtel deposits (0766495353 - ELIX OWOMUZINYA), withdrawals, affiliate commissions, or WhatsApp support today?',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const quickQuestions = [
    'Chat with WhatsApp Concierge',
    'What are the VESTRA yield vaults & daily earnings?',
    'How do I deposit via USSD (0766495353 - ELIX OWOMUZINYA)?',
    'What is the minimum withdrawal & 20% fee?',
    'How does the 20% affiliate commission work?',
    'How do daily yields credit to my wallet?',
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "Our support team is here to assist! You can ask about VESTRA institutional yield vaults (starting from UGX 15,000), MTN MoMo deposits to 0766495353 (min UGX 20,000), withdrawals (min UGX 5,000), or join our official WhatsApp Concierge & Community.";

      const lower = text.toLowerCase();

      if (lower.includes('whatsapp') || lower.includes('chat') || lower.includes('human') || lower.includes('agent') || lower.includes('desk') || lower.includes('group')) {
        reply = "You can contact our live concierge desk and community on WhatsApp anytime!\n\n" +
          "Official WhatsApp Concierge Link:\n" +
          WHATSAPP_HELP_URL + "\n\n" +
          "Tap the 'Join WhatsApp Helpdesk' banner at the top of this modal to open WhatsApp directly.";
      } else if (lower.includes('plan') || lower.includes('tier') || lower.includes('catalog') || lower.includes('vault') || lower.includes('invest') || lower.includes('cost') || lower.includes('price')) {
        reply = "Here is our current VESTRA Institutional Yield Catalog:\n\n" +
          "• VESTRA Liquid Arbitrage Vault: UGX 15,000 → UGX 4,500/day (30 Days)\n" +
          "• VESTRA Horizon Liquid Reserve: UGX 20,000 → UGX 6,200/day (45 Days)\n" +
          "• VESTRA Sovereign AI Cluster: UGX 30,000 → UGX 9,600/day (60 Days)\n" +
          "• VESTRA Quantum Alpha Fund: UGX 60,000 → UGX 20,000/day (90 Days)\n" +
          "• VESTRA Clean Grid Infrastructure: UGX 120,000 → UGX 42,000/day (120 Days)\n" +
          "• VESTRA Apex VIP Syndicate: UGX 300,000 → UGX 110,000/day (180 Days)\n\n" +
          "Each deployed vault generates automated daily yields in UGX directly into your wallet balance!";
      } else if (lower.includes('liquid') || lower.includes('starter') || lower.includes('arbitrage')) {
        reply = "The VESTRA Liquid Arbitrage Vault requires UGX 15,000 and generates UGX 4,500 daily rewards for a 30-day term. Perfect entry point into automated yields!";
      } else if (lower.includes('horizon') || lower.includes('reserve')) {
        reply = "The VESTRA Horizon Liquid Reserve costs UGX 20,000 and produces UGX 6,200 daily rewards across a 45-day operational cycle.";
      } else if (lower.includes('ai') || lower.includes('cluster') || lower.includes('gpu')) {
        reply = "The VESTRA Sovereign AI Cluster allocates UGX 30,000 into enterprise GPU compute, delivering UGX 9,600 daily returns for 60 days.";
      } else if (lower.includes('alpha') || lower.includes('quantum')) {
        reply = "The VESTRA Quantum Alpha Fund costs UGX 60,000 with UGX 20,000 daily yield over 90 days.";
      } else if (lower.includes('clean') || lower.includes('grid') || lower.includes('hydro')) {
        reply = "The VESTRA Clean Grid Infrastructure allocates UGX 120,000, paying UGX 42,000 daily rewards over 120 continuous days.";
      } else if (lower.includes('syndicate') || lower.includes('vip') || lower.includes('apex')) {
        reply = "The VESTRA Apex VIP Syndicate allocates UGX 300,000, paying UGX 110,000 daily rewards over 180 continuous days.";
      } else if (lower.includes('deposit') || lower.includes('mtn') || lower.includes('airtel') || lower.includes('momo') || lower.includes('pay') || lower.includes('phone') || lower.includes('number') || lower.includes('0766495353') || lower.includes('elix') || lower.includes('owomuzinya')) {
        reply = "Step-by-Step Deposit Instructions:\n\n" +
          "1. Minimum Deposit: UGX 20,000.\n" +
          "2. Dial *165# (MTN) or *185# (Airtel) on your phone.\n" +
          "3. Select 1 (Send Money) → 1 (To Mobile User).\n" +
          "4. Enter Recipient Number: 0766495353\n" +
          "5. Enter your Deposit Amount in UGX (min UGX 20,000).\n" +
          "6. Confirm recipient name shows ELIX OWOMUZINYA and enter your PIN.\n" +
          "7. Return to VESTRA and tap 'Confirm Deposit' to submit your request for fast approval!\n\n" +
          "• Quick MTN USSD: *165*1*1*0766495353*[AMOUNT]#\n" +
          "• Quick Airtel USSD: *185*1*1*0766495353*[AMOUNT]#";
      } else if (lower.includes('withdraw') || lower.includes('cash out') || lower.includes('fee') || lower.includes('minimum')) {
        reply = "Withdrawal Guidelines:\n\n" +
          "• Welcome Bonus: UGX 5,000 is restricted from immediate withdrawal until a qualifying deposit (min UGX 20,000) is made. A 30% bonus protection charge applies to bonus withdrawals!\n" +
          "• Minimum Standard Withdrawal: UGX 5,000.\n" +
          "• Standard Withdrawal Fee: 20% normal withdrawal fee.\n" +
          "• Channels: MTN MoMo, Airtel Money, or Stanbic Bank.\n" +
          "• Approvals: Admin reviewed and disbursed directly to your mobile money number or bank account.";
      } else if (lower.includes('referral') || lower.includes('affiliate') || lower.includes('commission') || lower.includes('bonus') || lower.includes('friend')) {
        reply = "VESTRA Affiliate Program & Welcome Bonus:\n\n" +
          "• Welcome Bonus: Every new user receives an automatic UGX 5,000 Welcome Bonus upon account creation, clearly recorded in your wallet!\n" +
          "• Affiliate Commission: You earn 20% commission on every approved deposit made by users registered with your referral link/code!\n" +
          "• Example: If your invited partner deposits UGX 100,000 and it is approved, you receive UGX 20,000 immediately into your wallet.";
      } else if (lower.includes('harvest') || lower.includes('claim') || lower.includes('reward') || lower.includes('yield') || lower.includes('payout')) {
        reply = "Daily yields accumulate continuously in your active VESTRA vaults. Simply tap the 'Harvest' button on any active contract or use 'Claim All Yields' to instantly credit your balance!";
      } else if (lower.includes('bank') || lower.includes('stanbic')) {
        reply = "Bank Transfer Details (Withdrawals):\n• Bank: Stanbic Bank Uganda Limited\n• Account Number: 9030018829104\n• Account Name: VESTRA Capital Uganda Ltd\n• Branch: Forest Mall Lugogo, Kampala\n\nNote: Deposits are processed via MTN MoMo and Airtel Money to 0766495353.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_rep_${Date.now()}`,
          sender: 'support',
          text: reply,
          timestamp: 'Just now',
        },
      ]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md h-[560px] shadow-2xl border border-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight leading-tight flex items-center gap-1.5">
                <span>VESTRA Concierge Desk</span>
              </h3>
              <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                24/7 Algorithmic & WhatsApp Support
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WhatsApp Banner */}
        <a
          href={WHATSAPP_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between hover:bg-emerald-100/50 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-800">
              Live Human Concierge via WhatsApp
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            Chat Live <ExternalLink className="w-3 h-3" />
          </span>
        </a>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs rounded-tl-xs whitespace-pre-line'
                  }`}
                >
                  {msg.text}
                </div>
                {isUser && (
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
          {isTyping && (
            <div className="flex gap-2 items-center text-xs text-slate-400">
              <div className="w-7 h-7 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <span className="italic">VESTRA Concierge is researching...</span>
            </div>
          )}
        </div>

        {/* Quick Questions */}
        <div className="px-3 py-2 border-t border-slate-100 bg-white overflow-x-auto whitespace-nowrap flex gap-1.5 scrollbar-none">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer shrink-0 border border-slate-200/60"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 rounded-b-3xl">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Type your question about VESTRA..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-emerald-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
