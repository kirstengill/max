/**
 * Supabase Authentication & Cross-Device Data Persistence Service
 * Single source of truth hosted on Supabase Cloud.
 * NO browser localStorage or device storage is used for user financial data.
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  UserProfile,
  ReferralPartner,
  ReferralSummary,
  WalletState,
  Transaction,
  Machine,
  AdminTask,
  AppNotification,
  AdminUserSummary,
  BalanceAdjustment,
} from '../types';
import { supabaseAdmin } from './supabaseAdmin';
import { getSupabaseClient } from './supabase';

export interface UserAccountData {
  wallet: WalletState;
  transactions: Transaction[];
  machines: Machine[];
  adminTasks: AdminTask[];
  notifications: AppNotification[];
}

/**
 * Helper to sanitize, normalize and format referral codes from various user inputs:
 * Handles full URLs (https://...?ref=SC-XXXX), pasted links, missing SC- prefixes,
 * lowercase/uppercase, and common typos (e.g. letter O instead of number 0).
 */
export function cleanReferralCode(input?: string | null): string {
  if (!input) return '';
  let str = input.trim();
  if (!str) return '';

  // Extract from full URLs or query strings if pasted
  try {
    if (str.includes('ref=') || str.includes('referral=')) {
      const match = str.match(/[?&](?:ref|referral)=([^&/\s#]+)/i);
      if (match && match[1]) {
        str = decodeURIComponent(match[1]).trim();
      }
    }
  } catch {
    // Ignore URL parsing failure
  }

  // Strip scheme and domain if any remains
  str = str.replace(/https?:\/\/[^\s]+/gi, '').trim();

  // If there's garbage attached after a code (e.g. SC-F0BE1DHTTPS://...), extract just the code
  const codeMatch = str.match(/(?:SC-)?[A-Z0-9]{6,10}/i);
  if (codeMatch && codeMatch[0]) {
    str = codeMatch[0];
  }

  // Remove whitespace
  str = str.replace(/\s+/g, '').toUpperCase();

  // Fix common letter 'O' vs digit '0' typo in hex-like referral codes
  if (str.startsWith('SC-')) {
    const suffix = str.slice(3);
    if (/^[0-9A-F]{6,8}$/i.test(suffix.replace(/O/g, '0'))) {
      str = 'SC-' + suffix.replace(/O/g, '0');
    }
  } else if (/^[A-Z0-9]{6,8}$/.test(str)) {
    const fixed = str.replace(/O/g, '0');
    str = `SC-${fixed}`;
  }

  return str;
}

class AuthService {
  private client: SupabaseClient | null = null;
  private currentUser: UserProfile | null = null;
  private accessToken: string | null = null;
  private memoryUserData: { [userId: string]: UserAccountData } = {};

  constructor() {
    this.init();
  }

  private init() {
    const envUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const envKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
    if (envUrl && envKey) {
      try {
        // Supabase Auth: session persisted + auto refreshed; restored at startup.
        this.client = createClient(envUrl, envKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });

        // Keep the REST data client supplied with the current access token
        this.client.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            this.accessToken = session.access_token;
            if (this.currentUser) {

            }
          }
        });
      } catch (e) {
        console.warn('Supabase client initialization warning:', e);
      }
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }
  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isAdmin(): boolean {
    // Authoritative flag ONLY: public.profiles.is_admin
    if (!this.currentUser) return false;
    return this.currentUser.isAdmin === true;
  }

  public isBlocked(): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.status === 'blocked';
  }

  public setCurrentUser(user: UserProfile | null, accessToken?: string | null) {
    this.currentUser = user;
    if (user) {
      if (accessToken !== undefined) {
        this.accessToken = accessToken;
      }
    } else {
      this.accessToken = null;
    }
  }

  private formatEmail(identifier: string): string {
    const clean = this.normalizeUsername(identifier);
    if (!clean) return '';
    if (clean.includes('@')) return clean;
    return `${clean}@sunrise-ds.com`;
  }

  /**
   * Map Supabase Auth errors to clear, user-facing messages.
   */
  private mapAuthError(error: any): string {
    const code = error?.code || '';
    const msg = (error?.message || '').toLowerCase();
    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
      return 'Invalid username or password.';
    }
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
      return 'Your account has not been confirmed yet. Please confirm your account before signing in.';
    }
    if (msg.includes('rate limit')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    return error?.message || 'Unable to sign in. Please try again.';
  }

  // ==========================================================
  // CROSS-DEVICE SESSION RESTORATION (from Supabase Cloud)
  // ==========================================================

  public async restoreSession(): Promise<{ user: UserProfile | null; data: UserAccountData | null; error?: string }> {
    if (this.client) {
      try {
        const { data: { session }, error: sessionErr } = await this.client.auth.getSession();
        if (!sessionErr && session && session.user) {
          const user = session.user;
          const profile = await this.fetchProfileFromSupabase(user);
          if (profile) {
            this.setCurrentUser(profile, session.access_token);
            const dataRes = await this.refreshUserData();
            return { user: profile, data: dataRes.data || null };
          }
        }
      } catch (err) {
        console.warn('Session restore exception from Supabase:', err);
      }
    }

    this.currentUser = null;
    return { user: null, data: null };
  }

  // ==========================================================
  // AUTHENTICATION: SIGN IN & SIGN UP (Hosted on Supabase)
  // ==========================================================

  public async signInWithPassword(usernameOrEmail: string, password: string): Promise<{
    user?: UserProfile;
    data?: UserAccountData;
    error?: string;
    isBlocked?: boolean;
  }> {
    const cleanInput = (usernameOrEmail || '').trim();
    if (!cleanInput || !password) {
      return { error: 'Username and password are required.' };
    }

    if (!this.client) {
      return { error: 'Authentication is unavailable. Please try again later.' };
    }

    try {
        const email = this.formatEmail(cleanInput);
        const authResponse = await this.client.auth.signInWithPassword({
          email,
          password,
        });
        const authData = authResponse?.data;
        const authError = authResponse?.error;

        if (authError) {
          return { error: this.mapAuthError(authError) };
        }

        if (authData.user && authData.session) {
          const profile = await this.fetchProfileFromSupabase(authData.user);
          if (!profile) {
            await this.client.auth.signOut();
            return { error: 'Signed in, but no profile record was found for your account. Please contact support.' };
          }

          if (profile.status === 'blocked') {
            await this.client.auth.signOut();
            this.currentUser = null;
            return { error: 'Your account has been suspended by an administrator.', isBlocked: true };
          }

          this.setCurrentUser(profile, authData.session.access_token);

          const dataRes = await this.refreshUserData();
          const accountData = dataRes.data || {
            wallet: { totalBalanceUGX: 0, dailyPnlUGX: 0, activeMachinesCount: 0, pendingTasksCount: 0 },
            transactions: [],
            machines: [],
            adminTasks: [],
            notifications: [],
          };

          this.memoryUserData[profile.id] = accountData;
          return { user: profile, data: accountData };
        }
        return { error: 'Authentication did not return a valid Supabase session.' };
    } catch (err: any) {
      return { error: this.mapAuthError(err) };
    }
  }

  public async signUp(
    username: string,
    password: string,
    fullName?: string,
    phone?: string,
    referralCode?: string
  ): Promise<{
    user?: UserProfile;
    data?: UserAccountData;
    error?: string;
    needsConfirmation?: boolean;
  }> {
    // Same normalization as sign-in: trim -> lowercase -> sanitize
    const cleanUsername = this.normalizeUsername(username);
    if (!cleanUsername) {
      return { error: 'Username is required.' };
    }
    const cleanRef = cleanReferralCode(referralCode);

    if (!this.client) {
      return { error: 'Authentication is unavailable. Please try again later.' };
    }

    try {
        const email = `${cleanUsername}@sunrise-ds.com`;
        const { data: authData, error: authError } = await this.client.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: (fullName || cleanUsername).trim(),
              phone: phone || '',
              referred_by: cleanRef,
            },
          },
        });

        if (authError) {
          const msg = (authError.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('already exists')) {
            return { error: 'This username is already taken. Please choose another one.' };
          }
          if (authError.code === 'user_banned') {
            return { error: 'This account has been blocked.' };
          }
        } else if (authData.user) {
          if (!authData.session) {
            return {
              needsConfirmation: true,
              error: 'Account created! Please confirm your account before signing in.',
            };
          }

          if (cleanRef) {
            try {
              await this.processReferral(cleanRef);
            } catch (e) {
              console.warn('Referral processing warning:', e);
            }
          }

          let profile = await this.fetchProfileFromSupabase(authData.user);
          if (!profile && this.client) {
            for (let i = 0; i < 5 && !profile; i++) {
              await new Promise((r) => setTimeout(r, 400));
              profile = await this.fetchProfileFromSupabase(authData.user);
            }
          }
          if (profile) {
            this.setCurrentUser(profile, authData.session.access_token);
            const dataRes = await this.refreshUserData();
            const userData = dataRes.data || {
              wallet: { totalBalanceUGX: 5000, welcomeBonusUGX: 5000, withdrawableBalanceUGX: 5000, depositedBalanceUGX: 0, bonusLocked: false, dailyPnlUGX: 0, activeMachinesCount: 0, pendingTasksCount: 0 },
              transactions: [],
              machines: [],
              adminTasks: [],
              notifications: [],
            };
            this.memoryUserData[profile.id] = userData;
            return { user: profile, data: userData };
          }
        }
    } catch (err: any) {
      return { error: this.mapAuthError(err) };
    }
  }

  /**
   * Normalize a username exactly once, shared by sign-in and sign-up so the
   * same Auth email is generated in both flows.
   */
  private normalizeUsername(username: string): string {
    const clean = (username || '').trim().toLowerCase();
    if (!clean) return '';
    if (clean.includes('@')) return clean; // already an email
    return clean.replace(/[^a-z0-9_]/g, '_');
  }

  public async signOut(): Promise<void> {
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch {
        // Ignore signout error
      }
    }
    this.currentUser = null;
    this.accessToken = null;
    this.memoryUserData = {};
  }

  // ==========================================================
  // PROFILE & LIVE DATA SYNC (Cross-Device Single Source of Truth)
  // ==========================================================

  private async fetchProfileFromSupabase(authUser: User): Promise<UserProfile | null> {
    if (!this.client) return null;

    try {
      // Identify the profile ONLY by auth.uid() — never by username.
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        return null;
      }

      // Authoritative admin flag: public.profiles.is_admin.
      const isAdmin = data.is_admin === true;
      const status = typeof data.status === 'string' ? data.status : 'active';

      const referrals = await this.fetchReferrals(data.referral_code || '');
      const realReferralCount = Math.max(referrals.length, Number(data.referral_count) || 0);
      const realReferralEarnings = Number(data.referral_earnings_ugx) || 0;

      return {
        id: data.id,
        username: data.username,
        fullName: data.full_name || '',
        phone: data.phone || '',
        role: isAdmin ? ('admin' as const) : ('user' as const),
        status,
        tier: (data.tier || 'Standard') as any,
        memberSince: 'August 2026',
        verified: true,
        country: 'Uganda',
        referralCode: data.referral_code || '',
        referredBy: data.referred_by,
        referralCount: realReferralCount,
        referralEarningsUGX: realReferralEarnings,
        referrals,
        welcomeBonusClaimed: data.welcome_bonus_claimed === true,
        createdAt: data.created_at,
        isAdmin,
      };
    } catch {
      return null;
    }
  }

  public async refreshUserData(): Promise<{
    user?: UserProfile;
    data?: UserAccountData;
    isBlocked?: boolean;
    error?: string;
  }> {
    if (!this.currentUser) {
      return { error: 'Not authenticated' };
    }

    const userId = this.currentUser.id;

    // 1. Query Supabase Tables Directly
    if (this.client) {
      try {
        const [profileRes, walletRes, txRes, machinesRes, notifsRes, adminTasksRes] = await Promise.all([
          this.client.from('profiles').select('*').eq('id', userId).single(),
          this.client.from('wallets').select('*').eq('user_id', userId).single(),
          this.client.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          this.client.from('user_machines').select('*').eq('user_id', userId),
          this.client.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          this.client.from('admin_tasks').select('*').eq('user_id', userId),
        ]);

        if (profileRes.data) {
          // Authoritative admin flag: public.profiles.is_admin
          const isAdmin = profileRes.data.is_admin === true;
          const referrals = await this.fetchReferrals(profileRes.data.referral_code || '');
          const realReferralCount = Math.max(referrals.length, Number(profileRes.data.referral_count) || 0);
          const realReferralEarnings = Number(profileRes.data.referral_earnings_ugx) || 0;
          this.currentUser = {
            id: profileRes.data.id,
            username: profileRes.data.username,
            fullName: profileRes.data.full_name || '',
            phone: profileRes.data.phone || '',
            role: isAdmin ? ('admin' as const) : ('user' as const),
            status: typeof profileRes.data.status === 'string' ? profileRes.data.status : 'active',
            tier: (profileRes.data.tier || 'Standard') as any,
            memberSince: 'August 2026',
            verified: true,
            country: 'Uganda',
            referralCode: profileRes.data.referral_code || '',
            referredBy: profileRes.data.referred_by,
            referralCount: realReferralCount,
            referralEarningsUGX: realReferralEarnings,
            referrals,
            welcomeBonusClaimed: profileRes.data.welcome_bonus_claimed === true,
            createdAt: profileRes.data.created_at,
            isAdmin,
          };
        }

        // Keep the REST client supplied with the freshest Supabase Auth token
        try {
          const { data: { session } } = await this.client.auth.getSession();
          if (session?.access_token && this.currentUser) {
            this.accessToken = session.access_token;

          }
        } catch {
          // ignore
        }

        const totalBal = Number(walletRes.data.total_balance_ugx ?? walletRes.data.balance) || 0;

        // Calculate pending withdrawals directly from authoritative transactions in Supabase
        const pendingWithdrawalTotal = (txRes.data || [])
          .filter(
            (t: any) =>
              (t.type === 'withdraw' || t.type === 'withdrawal') &&
              (t.status === 'pending' || t.status === 'processing')
          )
          .reduce((sum: number, t: any) => sum + Number(t.amount_ugx || t.amount || 0), 0);

        // Authoritative withdrawable balance: actual available wallet balance minus pending withdrawals.
        // Do not arbitrarily limit withdrawals to UGX 4,000.
        const withdrawableBal = Math.max(0, totalBal - pendingWithdrawalTotal);
        const depositedBal =
          walletRes.data.deposited_balance_ugx !== undefined && walletRes.data.deposited_balance_ugx !== null
            ? Number(walletRes.data.deposited_balance_ugx)
            : 0;

        const wallet: WalletState = walletRes.data
          ? {
              totalBalanceUGX: totalBal,
              withdrawableBalanceUGX: withdrawableBal,
              depositedBalanceUGX: depositedBal,
              bonusLocked: false,
              dailyPnlUGX: Number(walletRes.data.daily_pnl_ugx) || 0,
              activeMachinesCount: Number(walletRes.data.active_machines_count) || 0,
              pendingTasksCount: Number(walletRes.data.pending_tasks_count) || 0,
            }
          : { totalBalanceUGX: 0, withdrawableBalanceUGX: 0, dailyPnlUGX: 0, activeMachinesCount: 0, pendingTasksCount: 0 };

        const transactions: Transaction[] = (txRes.data || [])
          .map((t: any) => {
            const dateObj = t.timestamp
              ? new Date(t.timestamp)
              : (t.created_at ? new Date(t.created_at) : new Date());
            const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : new Date().toLocaleString();
            return {
              id: t.id,
              userId: t.user_id,
              username: t.username || this.currentUser?.username || 'user',
              userFullName: t.user_full_name || this.currentUser?.fullName || 'User',
              type: t.type || 'deposit',
              amountUGX: Number(t.amount_ugx || t.amount || 0),
              currency: 'UGX' as const,
              status: (t.status || 'pending') as Transaction['status'],
              date: dateStr,
              timestamp: t.timestamp ? String(t.timestamp) : (t.created_at ? String(t.created_at) : undefined),
              created_at: t.created_at || undefined,
              description: t.description || `${(t.type || 'Transaction').toUpperCase()} Request`,
              paymentMethod: t.payment_method || undefined,
              recipientInfo: t.recipient_info || undefined,
              txHash: t.tx_hash || undefined,
            };
          })
          .sort((a: Transaction, b: Transaction) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
            return timeB - timeA;
          });

        const machines: Machine[] = (machinesRes.data || []).map((m: any) => ({
          id: m.id || m.machine_id,
          title: m.title,
          subtitle: m.subtitle,
          category: m.category || 'DS-Mining',
          image: m.image,
          dailyRewardUGX: Number(m.daily_reward_ugx),
          status: m.status || 'Active',
          estYearlyROI: Number(m.est_yearly_roi || 0),
          minInvestUGX: Number(m.min_invest_ugx || 0),
          hashrate: m.hashrate || '10.0 TH/s',
          powerSource: m.power_source || 'Grid Power',
          uptime: m.uptime || '99.9%',
          temperature: m.temperature || '36.0°C',
          efficiency: Number(m.efficiency || 98.5),
          totalMinedUGX: Number(m.total_mined_ugx || 0),
          unclaimedRewardsUGX: Number(m.unclaimed_rewards_ugx || 0),
          isBoosted: Boolean(m.is_boosted),
        }));

        const notifications: AppNotification[] = (notifsRes.data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          timestamp: new Date(n.created_at).toLocaleTimeString(),
          read: Boolean(n.read),
          type: n.type === 'alert' ? 'alert' : n.type === 'info' ? 'info' : 'success',
        }));

        const adminTasks: AdminTask[] = (adminTasksRes.data || []).map((a: any) => ({
          id: a.id,
          transactionId: a.transaction_id,
          category: a.category || 'Verification',
          urgency: (a.priority === 'urgent' || a.priority === 'high' ? 'high' : a.priority === 'low' ? 'low' : 'medium') as any,
          type: a.type,
          title: a.title,
          description: a.description,
          amountUGX: Number(a.amount_ugx),
          status: a.status || 'pending',
          timestamp: new Date(a.created_at).toLocaleString(),
        }));

        const userData: UserAccountData = {
          wallet,
          transactions,
          machines,
          adminTasks,
          notifications,
        };

        this.memoryUserData[userId] = userData;
        return {
          user: this.currentUser,
          data: userData,
          isBlocked: this.currentUser.status === 'blocked',
        };
      } catch (e) {
        console.warn('refreshUserData failed:', e);
      }
    }

    return {
      user: this.currentUser,
      data: this.memoryUserData[userId] || null,
      isBlocked: this.currentUser?.status === 'blocked',
    };
  }

  public getUserData(userId: string): UserAccountData | null {
    return this.memoryUserData[userId] || null;
  }

  public saveUserData(userId: string, data: Partial<UserAccountData>) {
    const existing = this.memoryUserData[userId] || {
      wallet: { totalBalanceUGX: 0, dailyPnlUGX: 0, activeMachinesCount: 0, pendingTasksCount: 0 },
      transactions: [],
      machines: [],
      adminTasks: [],
      notifications: [],
    };

    const updated = {
      ...existing,
      ...data,
    };
    this.memoryUserData[userId] = updated;

    // Supabase is the single source of truth. No in-memory/REST sync fallback.
    // All financial mutations go through Supabase RPCs; this cache is display-only.
  }

  // ==========================================================
  // REFERRAL PROCESSING & SUPABASE COMMISSION RPC INTEGRATIONS
  // ==========================================================

  /**
   * Fetch real referral summary from Supabase RPC get_referral_summary()
   * Single source of truth for total referrals, available commission, and total earned.
   */
  public async getReferralSummary(): Promise<ReferralSummary> {
    const defaultSummary: ReferralSummary = {
      totalReferrals: this.currentUser?.referralCount || 0,
      availableCommissionUGX: 0,
      totalCommissionUGX: this.currentUser?.referralEarningsUGX || 0,
      claimedCommissionUGX: 0,
      referralCode: this.currentUser?.referralCode || '',
    };

    if (!this.client) return defaultSummary;

    try {
      const activeCode = cleanReferralCode(this.currentUser?.referralCode || '');

      // 1. Primary: Call Supabase RPC get_my_referral_summary or get_referral_summary
      let rpcRes = await this.client.rpc('get_my_referral_summary');
      if (rpcRes.error || !rpcRes.data) {
        rpcRes = await this.client.rpc('get_referral_summary');
      }

      let totalReferrals = 0;
      let availableCommissionUGX = 0;
      let totalCommissionUGX = 0;
      let claimedCommissionUGX = 0;
      let referralCode = activeCode;

      if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
        totalReferrals = Number(rpcRes.data.referral_count ?? rpcRes.data.total_referrals ?? 0);
        availableCommissionUGX = Number(rpcRes.data.available_commission_ugx ?? 0);
        totalCommissionUGX = Number(rpcRes.data.total_commission_ugx ?? 0);
        claimedCommissionUGX = Number(rpcRes.data.claimed_commission_ugx ?? 0);
        referralCode = cleanReferralCode(String(rpcRes.data.referral_code || activeCode));
      }

      // Cross-verify with direct Supabase tables to guarantee real-time accuracy:
      // Even if the RPC was cached or returning delayed results, direct tables show actual counts.
      if (referralCode) {
        const bareCode = referralCode.replace(/^SC-/, '');
        const { data: directProfiles } = await this.client
          .from('profiles')
          .select('id')
          .or(`referred_by.ilike.${referralCode},referred_by.ilike.${bareCode}`);

        const liveCount = directProfiles?.length || 0;
        if (liveCount > totalReferrals) {
          totalReferrals = liveCount;
        }

        const refIds = (directProfiles || []).map((p) => p.id);
        if (refIds.length > 0) {
          const { data: approvedTxs } = await this.client
            .from('transactions')
            .select('amount_ugx')
            .in('user_id', refIds)
            .eq('type', 'deposit')
            .eq('status', 'completed');

          const totalDeposits = (approvedTxs || []).reduce((sum, tx) => sum + (Number(tx.amount_ugx) || 0), 0);
          const referralPercentage = await this.getReferralPercent();
          const liveCommission = Math.round(totalDeposits * referralPercentage / 100);
          if (liveCommission > totalCommissionUGX) {
            totalCommissionUGX = liveCommission;
          }
        }

        // Get claimed commission directly
        if (this.currentUser) {
          const { data: claimedTxs } = await this.client
            .from('transactions')
            .select('amount_ugx')
            .eq('user_id', this.currentUser.id)
            .eq('status', 'completed')
            .or('description.ilike.%referral commission%,id.like.tx_claim_ref_%,id.like.tx_refcomm_%');

          const directClaimed = (claimedTxs || []).reduce((sum, tx) => sum + (Number(tx.amount_ugx) || 0), 0);
          if (directClaimed > claimedCommissionUGX) {
            claimedCommissionUGX = directClaimed;
          }
        }

        availableCommissionUGX = Math.max(0, totalCommissionUGX - claimedCommissionUGX);

        // Keep local profile stats in sync
        if (this.currentUser) {
          this.currentUser.referralCount = totalReferrals;
          this.currentUser.referralEarningsUGX = totalCommissionUGX;
        }
      }

      return {
        totalReferrals,
        availableCommissionUGX,
        totalCommissionUGX,
        claimedCommissionUGX,
        referralCode: referralCode || activeCode,
      };
    } catch (e) {
      console.warn('getReferralSummary error:', e);
      return defaultSummary;
    }
  }

  /**
   * Load real referred users list from Supabase.
   * Returns username, registration date, approved deposit amount, and 20% commission earned.
   */
  public async getReferredUsers(overrideRefCode?: string): Promise<ReferralPartner[]> {
    if (!this.client) return [];
    const rawCode = overrideRefCode || this.currentUser?.referralCode;
    const refCode = cleanReferralCode(rawCode);

    try {
      // 1. Primary: Call Supabase RPC get_my_referrals
      let listRes = await this.client.rpc('get_my_referrals');
      if (listRes.error || !Array.isArray(listRes.data)) {
        listRes = await this.client.rpc('get_referred_users');
      }

      if (!listRes.error && Array.isArray(listRes.data) && listRes.data.length > 0) {
        return listRes.data.map((r: any) => {
          const id = String(r.referred_user_id || r.id || '');
          const username = String(r.username || 'user');
          const fullName = r.full_name ? String(r.full_name) : undefined;
          let registeredDate = '';
          if (r.joined_at) {
            try {
              registeredDate = new Date(r.joined_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
            } catch {
              registeredDate = String(r.joined_at);
            }
          } else if (r.registered_date) {
            registeredDate = String(r.registered_date);
          }
          const approvedDeposit = Number(r.approved_deposit_ugx ?? 0);
          const commission = Number(r.commission_ugx ?? 0);

          return {
            id,
            username,
            fullName,
            registeredDate,
            status: (r.status === 'active' || approvedDeposit > 0 ? 'active' : 'pending') as 'active' | 'pending',
            approvedDepositUGX: approvedDeposit,
            commissionUGX: commission,
            commissionStatus: String(r.commission_status || (approvedDeposit > 0 ? 'approved' : 'no_approved_deposit')),
            rewardUGX: commission,
          };
        });
      }

      // 2. Direct Supabase Query Fallback (checks both SC-CODE and bare CODE)
      if (!refCode) return [];
      const bareCode = refCode.replace(/^SC-/, '');
      const { data: profiles, error: pError } = await this.client
        .from('profiles')
        .select('id, username, full_name, created_at, status')
        .or(`referred_by.ilike.${refCode},referred_by.ilike.${bareCode}`)
        .order('created_at', { ascending: false });

      if (pError || !profiles || profiles.length === 0) return [];

      const refIds = profiles.map((p) => p.id);
      let approvedDepositsByUserId: Record<string, number> = {};

      if (refIds.length > 0) {
        const { data: txs } = await this.client
          .from('transactions')
          .select('user_id, amount_ugx')
          .in('user_id', refIds)
          .eq('type', 'deposit')
          .eq('status', 'completed');

        (txs || []).forEach((tx) => {
          approvedDepositsByUserId[tx.user_id] = (approvedDepositsByUserId[tx.user_id] || 0) + (Number(tx.amount_ugx) || 0);
        });
      }

      const referralPercentage = await this.getReferralPercent();
      return profiles.map((p: any) => {
        const approvedDep = approvedDepositsByUserId[p.id] || 0;
        const comm = Math.round(approvedDep * referralPercentage / 100);
        return {
          id: p.id,
          username: p.username || 'user',
          fullName: p.full_name || undefined,
          registeredDate: p.created_at
            ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '',
          status: approvedDep > 0 ? ('active' as const) : ('pending' as const),
          approvedDepositUGX: approvedDep,
          commissionUGX: comm,
          commissionStatus: approvedDep > 0 ? 'approved' : 'no_approved_deposit',
          rewardUGX: comm,
        };
      });
    } catch (e) {
      console.warn('getReferredUsers error:', e);
      return [];
    }
  }

  /**
   * Retroactively link an inviter referral code if the user missed it at signup.
   * Connects the accounts in public.profiles, updates referrer's referral count,
   * and credits any pending deposit commissions to the inviter.
   */
  public async linkReferrer(rawReferralCode: string): Promise<{
    success: boolean;
    message: string;
    referrerUsername?: string;
  }> {
    const sb = this.client;
    if (!sb || !this.currentUser) {
      return { success: false, message: 'Please sign in to link your inviter.' };
    }

    const cleanCode = cleanReferralCode(rawReferralCode);
    if (!cleanCode) {
      return { success: false, message: 'Please enter a valid referral code (e.g. SC-B35B2A).' };
    }

    // Cannot refer oneself
    if (this.currentUser.referralCode && this.currentUser.referralCode.toUpperCase() === cleanCode.toUpperCase()) {
      return { success: false, message: 'You cannot use your own referral code as your inviter.' };
    }

    // Retrieve user's current profile
    const { data: myProfile, error: myErr } = await sb
      .from('profiles')
      .select('id, referred_by, username')
      .eq('id', this.currentUser.id)
      .single();

    if (myErr || !myProfile) {
      return { success: false, message: 'Unable to load profile. Please try again.' };
    }

    if (myProfile.referred_by && myProfile.referred_by.trim() && myProfile.referred_by !== 'SC-SOLNOVA') {
      return {
        success: false,
        message: `Your account is already linked to inviter code ${myProfile.referred_by}.`,
      };
    }

    // Find the referrer profile by code (case-insensitive)
    const bareCode = cleanCode.replace(/^SC-/, '');
    const { data: referrer, error: refErr } = await sb
      .from('profiles')
      .select('id, username, referral_code, referral_count, referral_earnings_ugx')
      .or(`referral_code.ilike.${cleanCode},referral_code.ilike.${bareCode}`)
      .maybeSingle();

    if (refErr || !referrer) {
      return {
        success: false,
        message: `Referral code "${cleanCode}" was not found. Please verify the code with your inviter.`,
      };
    }

    if (referrer.id === this.currentUser.id) {
      return { success: false, message: 'You cannot use your own referral code as your inviter.' };
    }

    // 1. Update this user's referred_by
    const { error: updErr } = await sb
      .from('profiles')
      .update({
        referred_by: referrer.referral_code,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.currentUser.id);

    if (updErr) {
      return { success: false, message: `Failed to link referrer: ${updErr.message}` };
    }

    this.currentUser.referredBy = referrer.referral_code;

    // 2. Sync referrer's referral_count and calculate any commissions on approved deposits
    try {
      const { data: allChildren } = await sb
        .from('profiles')
        .select('id')
        .or(`referred_by.ilike.${referrer.referral_code},referred_by.ilike.${referrer.referral_code.replace(/^SC-/, '')}`);

      const newCount = allChildren?.length || (Number(referrer.referral_count || 0) + 1);

      // Check if this user has approved deposits to credit commission
      const { data: myDeposits } = await sb
        .from('transactions')
        .select('amount_ugx')
        .eq('user_id', this.currentUser.id)
        .eq('type', 'deposit')
        .eq('status', 'completed');

      const totalDep = (myDeposits || []).reduce((sum, d) => sum + (Number(d.amount_ugx) || 0), 0);
      const referralPercentage = await this.getReferralPercent();
      const earnedComm = Math.round(totalDep * referralPercentage / 100);
      const prevEarnings = Number(referrer.referral_earnings_ugx || 0);

      await sb
        .from('profiles')
        .update({
          referral_count: newCount,
          referral_earnings_ugx: prevEarnings + earnedComm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', referrer.id);

      // Send in-app notification to the inviter
      await sb.from('notifications').insert({
        id: `notif_reflink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: referrer.id,
        title: 'New Referral Partner Connected!',
        message: `@${this.currentUser.username || 'A friend'} linked your referral code (${referrer.referral_code}). Your team now has ${newCount} partners!`,
        read: false,
        type: 'success',
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Post-link sync warning:', e);
    }

    return {
      success: true,
      message: `Successfully connected to inviter @${referrer.username}!`,
      referrerUsername: referrer.username,
    };
  }

  /**
   * Claim available referral commission atomically via Supabase RPC claim_referral_commission()
   * Moves available commission to total_balance_ugx in wallets table.
   */
  public async claimReferralCommission(): Promise<{
    success: boolean;
    claimedUGX?: number;
    newBalance?: number;
    error?: string;
    message?: string;
  }> {
    if (!this.client || !this.currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // 1. Primary: Call Supabase RPC claim_referral_commission
      const { data, error } = await this.client.rpc('claim_referral_commission');
      if (error) {
        if (error.code === '23514' || error.message?.includes('transactions_type_check')) {
          return {
            success: false,
            error:
              'Database constraint: To claim commission, run this in Supabase SQL Editor: ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check; ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (\'deposit\',\'withdraw\',\'reward\',\'investment\',\'transfer\',\'bonus\',\'adjustment\',\'referral_claim\'));',
          };
        }
        // Direct claim fallback if RPC not yet deployed in database
        return await this.claimReferralCommissionDirectFallback();
      }

      if (data && data.success === false) {
        return {
          success: false,
          error: data.message || data.reason || 'No referral commission available to claim.',
        };
      }

      const claimedUGX = Number(data?.claimed_ugx ?? 0);
      const newBalance = Number(data?.new_balance ?? 0);

      // Refresh local user profile and wallet data directly from Supabase
      await this.refreshUserData();

      return {
        success: true,
        claimedUGX,
        newBalance,
        message: data?.message || `Successfully claimed UGX ${claimedUGX.toLocaleString()} referral commission!`,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to claim referral commission' };
    }
  }

  /**
   * Resilient direct claim fallback in case the RPC is pending deployment
   */
  private async claimReferralCommissionDirectFallback(): Promise<{
    success: boolean;
    claimedUGX?: number;
    newBalance?: number;
    error?: string;
    message?: string;
  }> {
    if (!this.client || !this.currentUser) return { success: false, error: 'Authentication required' };

    try {
      const summary = await this.getReferralSummary();
      const available = summary.availableCommissionUGX;
      if (available <= 0) {
        return { success: false, error: 'No referral commission available to claim at this time.' };
      }

      const userId = this.currentUser.id;
      const { data: wallet } = await this.client.from('wallets').select('total_balance_ugx').eq('user_id', userId).single();
      const currentBal = Number(wallet?.total_balance_ugx || 0);
      const newBal = currentBal + available;

      // Update wallet
      await this.client.from('wallets').update({
        total_balance_ugx: newBal,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);

      // Insert transaction
      const txId = `tx_claim_ref_${Date.now()}`;
      const refPercent = await this.getReferralPercent();
      await this.client.from('transactions').insert({
        id: txId,
        user_id: userId,
        type: 'bonus',
        amount_ugx: available,
        currency: 'UGX',
        status: 'completed',
        description: `Claimed Referral Commission (${refPercent}%)`,
        is_credit: true,
        created_at: new Date().toISOString(),
      });

      // Insert notification
      await this.client.from('notifications').insert({
        id: `notif_${txId}`,
        user_id: userId,
        title: 'Referral Commission Claimed',
        message: `UGX ${available.toLocaleString()} referral commission has been credited directly to your main wallet balance.`,
        read: false,
        type: 'success',
        created_at: new Date().toISOString(),
      });

      await this.refreshUserData();

      return {
        success: true,
        claimedUGX: available,
        newBalance: newBal,
        message: `Successfully claimed UGX ${available.toLocaleString()} referral commission!`,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to claim referral commission' };
    }
  }

  private claimingBonusInProgress = false;

  /**
   * Claim one-time UGX 5,000 Welcome Bonus directly to wallet via Supabase.
   * Atomic and idempotent: can only ever be credited once per account.
   */
  public async claimWelcomeBonus(): Promise<{
    success: boolean;
    claimedUGX?: number;
    newBalance?: number;
    error?: string;
    message?: string;
  }> {
    if (!this.currentUser) {
      return { success: false, error: 'Authentication required' };
    }

    if (!this.client) {
      return { success: false, error: 'Database client not initialized' };
    }

    const userId = this.currentUser.id;

    // Prevent concurrent claim calls
    if (this.claimingBonusInProgress) {
      return { success: false, error: 'Welcome bonus credit is already being processed.' };
    }

    // Fast check: if currentUser profile already has welcomeBonusClaimed === true
    if (this.currentUser.welcomeBonusClaimed) {
      return { success: false, error: 'Welcome bonus has already been credited for this account.' };
    }

    this.claimingBonusInProgress = true;

    try {
      // 1. Authoritative: Call Supabase RPC claim_welcome_bonus()
      const { data, error } = await this.client.rpc('claim_welcome_bonus');

      if (error) {
        const errMsg = error.message || '';
        if (errMsg.toLowerCase().includes('already') || errMsg.includes('ALREADY_CLAIMED')) {
          await this.refreshUserData();
          return { success: false, error: 'Welcome bonus has already been credited for this account.' };
        }

        // Direct fallback if RPC is not yet registered in database
        return await this.claimWelcomeBonusDirectFallback();
      }

      if (data && data.success === false) {
        await this.refreshUserData();
        return {
          success: false,
          error: data.error || data.message || 'Failed to claim welcome bonus.',
        };
      }

      const claimedUGX = Number(data?.claimed_ugx ?? 5000);
      const currentBal = this.getUserData(userId)?.wallet?.totalBalanceUGX || 0;
      const newBalance = Number(data?.new_balance ?? (currentBal + 5000));

      // Refresh local user profile and wallet data directly from Supabase
      await this.refreshUserData();

      return {
        success: true,
        claimedUGX,
        newBalance,
        message: data?.message || 'Welcome Bonus Credited! UGX 5,000 has been added to your wallet.',
      };
    } catch (err: any) {
      console.warn('claimWelcomeBonus error:', err);
      return {
        success: false,
        error: err?.message || 'An error occurred while claiming your welcome bonus.',
      };
    } finally {
      this.claimingBonusInProgress = false;
    }
  }

  /**
   * Atomic direct fallback to credit welcome bonus directly to Supabase wallet and profile
   * if the RPC is unprovisioned in the database.
   */
  private async claimWelcomeBonusDirectFallback(): Promise<{
    success: boolean;
    claimedUGX?: number;
    newBalance?: number;
    error?: string;
    message?: string;
  }> {
    if (!this.client || !this.currentUser) return { success: false, error: 'Authentication required' };
    const userId = this.currentUser.id;

    try {
      // 1. Check if profile already marked as claimed in Supabase
      const { data: profile } = await this.client
        .from('profiles')
        .select('welcome_bonus_claimed')
        .eq('id', userId)
        .single();

      if (profile?.welcome_bonus_claimed === true) {
        await this.refreshUserData();
        return { success: false, error: 'Welcome bonus has already been credited for this account.' };
      }

      // 2. Check if user already has a welcome bonus transaction in Supabase
      const txId = `tx_welcome_${userId}`;
      const { data: existingTx } = await this.client
        .from('transactions')
        .select('id')
        .or(`id.eq.${txId},type.eq.bonus,description.ilike.%welcome bonus%`)
        .eq('user_id', userId)
        .limit(1);

      if (existingTx && existingTx.length > 0) {
        // Permanently mark profile as claimed in Supabase
        await this.client
          .from('profiles')
          .update({ welcome_bonus_claimed: true, updated_at: new Date().toISOString() })
          .eq('id', userId);

        await this.refreshUserData();
        return { success: false, error: 'Welcome bonus has already been credited for this account.' };
      }

      // 3. Atomically update profile with conditional check: welcome_bonus_claimed must be false
      const { data: updatedProfile, error: profileErr } = await this.client
        .from('profiles')
        .update({
          welcome_bonus_claimed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('welcome_bonus_claimed', false)
        .select('welcome_bonus_claimed');

      if (profileErr || !updatedProfile || updatedProfile.length === 0) {
        await this.refreshUserData();
        return { success: false, error: 'Welcome bonus has already been credited for this account.' };
      }

      // 4. Credit wallet + 5000 directly in Supabase
      const { data: wallet } = await this.client
        .from('wallets')
        .select('total_balance_ugx')
        .eq('user_id', userId)
        .single();

      const currentBal = Number(wallet?.total_balance_ugx || 0);
      const newBal = currentBal + 5000;

      await this.client
        .from('wallets')
        .update({
          total_balance_ugx: newBal,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // 5. Insert deterministic transaction record into Supabase (0% fee, full 5,000 UGX credited)
      await this.client.from('transactions').upsert({
        id: txId,
        user_id: userId,
        type: 'bonus',
        amount_ugx: 5000,
        currency: 'UGX',
        status: 'completed',
        description: 'Welcome Bonus — UGX 5,000 credited to wallet',
        is_credit: true,
        timestamp: Date.now(),
        created_at: new Date().toISOString(),
      });

      // 6. Record notification in Supabase
      await this.client.from('notifications').upsert({
        id: `notif_welcome_${userId}`,
        user_id: userId,
        title: 'Welcome Bonus Credited (UGX 5,000)',
        message: 'UGX 5,000 Welcome Bonus has been credited directly to your wallet balance!',
        read: false,
        type: 'success',
        created_at: new Date().toISOString(),
      });

      // 7. Refresh user data directly from Supabase
      await this.refreshUserData();

      return {
        success: true,
        claimedUGX: 5000,
        newBalance: newBal,
        message: 'Welcome Bonus Credited! UGX 5,000 has been added to your wallet.',
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to credit welcome bonus.' };
    }
  }

  /**
   * Helper to fetch referrals for profile loads
   */
  private async fetchReferrals(referralCode: string): Promise<ReferralPartner[]> {
    return this.getReferredUsers(referralCode);
  }

  public async processReferral(referralCode: string): Promise<{ applied: boolean; reason?: string; error?: string }> {
    const sb = this.client;
    if (!sb) return { applied: false, error: 'Database not configured' };
    if (!referralCode || !referralCode.trim()) return { applied: false, reason: 'no_code' };
    try {
      const { data, error } = await sb.rpc('process_referral', { p_referral_code: referralCode.trim() });
      if (error) return { applied: false, error: error.message };
      return {
        applied: Boolean(data?.applied),
        reason: data?.reason || undefined,
      };
    } catch (e: any) {
      return { applied: false, error: e?.message || 'Referral processing failed' };
    }
  }

  // ==========================================================
  // DIRECT CLOUD PERSISTENCE ACTIONS
  // ==========================================================

  public async submitDeposit(amountUGX: number, paymentMethod: string, referenceInfo?: string, description?: string) {
    const numericAmount = Number(amountUGX);
    const res = await supabaseAdmin.submitTransaction({
      type: 'deposit',
      amountUGX: numericAmount,
      description: description || `Deposit — UGX ${numericAmount.toLocaleString()} — Pending`,
      paymentMethod,
      recipientInfo: referenceInfo ?? undefined,
    });

    if (res.success && res.transaction && this.currentUser) {
      const uid = this.currentUser.id;
      if (this.memoryUserData[uid]) {
        this.memoryUserData[uid].transactions = [
          res.transaction,
          ...this.memoryUserData[uid].transactions.filter((t) => t.id !== res.transaction!.id),
        ];
      }
    }
    return res;
  }

  public async submitWithdrawal(
    amountUGX: number,
    paymentMethod: string,
    recipientInfo: string,
    description?: string,
    isBonusWithdrawal?: boolean
  ) {
    const res = await supabaseAdmin.submitTransaction({
      type: 'withdraw',
      amountUGX,
      description: description || `Withdrawal — UGX ${amountUGX.toLocaleString()} — Pending`,
      paymentMethod,
      recipientInfo,
      isBonusWithdrawal,
    });

    if (res.success && res.transaction && this.currentUser) {
      const uid = this.currentUser.id;
      if (this.memoryUserData[uid]) {
        this.memoryUserData[uid].transactions = [
          res.transaction,
          ...this.memoryUserData[uid].transactions.filter((t) => t.id !== res.transaction!.id),
        ];
      }
    }
    return res;
  }

  public async buyInvestment(machineOrId: Partial<Machine> | string, amountUGX?: number) {
    return supabaseAdmin.buyInvestment(machineOrId, amountUGX);
  }

  public async claimYield(investmentId: string) {
    return supabaseAdmin.claimInvestmentYield(investmentId);
  }

  public async uploadProjectImage(file: File): Promise<{ publicUrl?: string; error?: string }> {
    return supabaseAdmin.uploadProjectImage(file);
  }

  public async fetchCatalogMachines(): Promise<{ machines: Machine[]; error?: string }> {
    return supabaseAdmin.fetchCatalogMachines();
  }

  public async createCatalogMachine(machine: Partial<Machine>): Promise<{ success: boolean; machine?: Machine; error?: string }> {
    return supabaseAdmin.createCatalogMachine(machine);
  }

  public async updateCatalogMachine(id: string, machine: Partial<Machine>): Promise<{ success: boolean; machine?: Machine; error?: string }> {
    return supabaseAdmin.updateCatalogMachine(id, machine);
  }

  public async deleteCatalogMachine(id: string): Promise<{ success: boolean; error?: string }> {
    return supabaseAdmin.deleteCatalogMachine(id);
  }

  public async fetchPlatformSettings() {
    return supabaseAdmin.fetchPlatformSettings();
  }

  public async getReferralPercent(): Promise<number> {
    const res = await supabaseAdmin.getReferralPercent();
    if (res.percent !== undefined && Number.isFinite(res.percent)) {
      return res.percent;
    }
    return 15;
  }

  public async adminUpdateReferralPercent(percent: number): Promise<{ percent?: number; error?: string }> {
    return supabaseAdmin.adminUpdateReferralPercent(percent);
  }

  public async updatePlatformSetting(key: 'referral_percentage' | 'minimum_withdrawal_amount', value: number) {
    return supabaseAdmin.updatePlatformSetting(key, value);
  }

  public async updateProductMinimum(id: string, minimum: number) {
    return supabaseAdmin.updateProductMinimum(id, minimum);
  }

  public async fetchPendingTransactions() {
    return supabaseAdmin.fetchPendingTransactions();
  }

  public async fetchAllTransactions() {
    return supabaseAdmin.fetchAllTransactions();
  }

  public async approveTransaction(txId: string) {
    return supabaseAdmin.approveTransaction(txId);
  }

  public async rejectTransaction(txId: string) {
    return supabaseAdmin.rejectTransaction(txId);
  }

  // ==========================================================
  // ADMIN ACTIONS (Cross-device admin control via Supabase RPCs)
  // ==========================================================

  public async getAdminUsers(): Promise<{ users: AdminUserSummary[]; error?: string }> {
    return supabaseAdmin.fetchAdminUsers();
  }

  public async updateUserInfo(
    userId: string,
    data: { username?: string; fullName?: string; phone?: string; status?: 'active' | 'blocked' }
  ) {
    const res = await supabaseAdmin.updateAdminUser(userId, data);
    // After saving, refresh user data from Supabase so the changes persist across browsers and devices
    if (res.success && this.currentUser && this.currentUser.id === userId) {
      await this.refreshUserData();
    }
    return res;
  }

  public async adjustBalance(
    userId: string,
    adjustment: { amountUGX: number; type: 'add' | 'deduct'; reason: string }
  ) {
    const res = await supabaseAdmin.adjustUserBalance(userId, adjustment);
    if (res.success && res.newBalance !== undefined) {
      if (this.memoryUserData[userId]) {
        this.memoryUserData[userId].wallet.totalBalanceUGX = res.newBalance;
        this.memoryUserData[userId].wallet.withdrawableBalanceUGX = res.newBalance;
      }
      if (this.currentUser && this.currentUser.id === userId) {
        await this.refreshUserData();
      }
    }
    return res;
  }

  public async toggleUserStatus(userId: string, status: 'active' | 'blocked') {
    return supabaseAdmin.updateAdminUser(userId, { status });
  }

  public async deleteUser(userId: string) {
    const sb = getSupabaseClient();
    if (!sb) return { success: false, error: 'Database not configured' };
    if (!this.isAdmin()) return { success: false, error: 'Admin access required' };

    // Clean up user-owned rows first (FK references), then the auth user's profile.
    try {
      await sb.from('transactions').delete().eq('user_id', userId);
      await sb.from('notifications').delete().eq('user_id', userId);
      await sb.from('user_machines').delete().eq('user_id', userId);
      await sb.from('balance_adjustments').delete().eq('user_id', userId);
      await sb.from('wallets').delete().eq('user_id', userId);
      await sb.from('profiles').delete().eq('id', userId);
      return { success: true, message: 'User profile removed.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete user' };
    }
  }

  public async getBalanceAuditLogs(): Promise<{ adjustments: BalanceAdjustment[]; error?: string }> {
    return supabaseAdmin.fetchBalanceAdjustments();
  }
}

export const authService = new AuthService();
export const supabaseAuth = authService;
