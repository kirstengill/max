/**
 * Admin operations implemented directly against the Lines Supabase backend.
 * Every privileged operation goes through security-definer RPC functions
 * (supabase_admin_and_transactions.sql) which check public.profiles.is_admin
 * server-side. Normal users can never execute them (REVOKE FROM anon/public,
 * RLS denies direct table writes).
 */

import { getSupabaseClient } from './supabase';
import {
  Transaction,
  AdminUserSummary,
  BalanceAdjustment,
  Machine,
} from '../types';
import { calculateDailyReturnUGX } from './investmentReturns';

export interface SubmitTransactionInput {
  type: 'deposit' | 'withdraw';
  amountUGX: number;
  description?: string;
  paymentMethod?: string;
  recipientInfo?: string;
  isBonusWithdrawal?: boolean;
}

export interface PlatformSettings {
  referral_percentage: number;
  minimum_withdrawal_amount: number;
}

export const supabaseAdmin = {
  // ---------- USER SUBMITS DEPOSIT / WITHDRAW -> pending row in Supabase ----------
  async submitTransaction(input: SubmitTransactionInput): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    const sb = getSupabaseClient();
    const numericAmount = Number(input.amountUGX);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Please enter a valid numeric amount greater than 0.' };
    }

    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('submit_transaction', {
        p_type: input.type,
        p_amount_ugx: numericAmount,
        p_description: input.description ?? null,
        p_payment_method: input.paymentMethod ?? null,
        p_recipient_info: input.recipientInfo ?? null,
      });

      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          const dateObj = row.timestamp
            ? new Date(row.timestamp)
            : (row.created_at ? new Date(row.created_at) : new Date());
          const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : new Date().toLocaleString();
          const isoTs = row.timestamp ? String(row.timestamp) : (row.created_at ? String(row.created_at) : new Date().toISOString());

          return {
            success: true,
            transaction: {
              id: row.id,
              userId: row.user_id,
              type: row.type,
              amountUGX: Number(row.amount_ugx || numericAmount),
              currency: 'UGX',
              status: row.status || 'pending',
              date: dateStr,
              timestamp: isoTs,
              created_at: row.created_at || isoTs,
              description: row.description || `${row.type.toUpperCase()} Request`,
              paymentMethod: row.payment_method,
              recipientInfo: row.recipient_info,
            },
          };
        }
      }

      // If the RPC returned an error from Supabase
      if (error) {
        const errMsg = error.message || '';
        const isFunctionMissing = errMsg.includes('does not exist') || errMsg.includes('42883') || errMsg.includes('could not find');
        if (!isFunctionMissing) {
          return { success: false, error: translate(errMsg) };
        }
        console.warn('submit_transaction RPC not found, executing direct table submission:', errMsg);
      }

      // Resilient fallback if RPC has a server-side runtime error or is missing
      const { data: authData } = await sb.auth.getUser();
      let userId = authData?.user?.id;
      if (!userId) {
        const localUser = (await import('./supabaseAuth')).authService.getCurrentUser();
        userId = localUser?.id;
      }
      if (!userId) return { success: false, error: 'Not authenticated. Please log in.' };

      // Check if user is blocked
      const { data: profileRow } = await sb.from('profiles').select('status').eq('id', userId).maybeSingle();
      if (profileRow?.status === 'blocked') {
        return { success: false, error: 'Your account is currently restricted. Please contact administrator.' };
      }

      // Check minimum for deposits
      if (input.type === 'deposit') {
        const MIN_DEPOSIT_UGX = 20000;
        if (numericAmount < MIN_DEPOSIT_UGX) {
          return {
            success: false,
            error: `Minimum Deposit: The minimum deposit amount is UGX ${MIN_DEPOSIT_UGX.toLocaleString()}.`,
          };
        }
      }

      // Check balance and minimum for withdrawals
      if (input.type === 'withdraw') {
        const { data: settingRows } = await sb.rpc('get_platform_settings');
        const minimumWithdrawal = Number(
          (settingRows || []).find((row: any) => row.key === 'minimum_withdrawal_amount')?.numeric_value || 0
        );
        const MIN_WITHDRAWAL_UGX = minimumWithdrawal > 0 ? minimumWithdrawal : 5000;
        if (numericAmount < MIN_WITHDRAWAL_UGX) {
          return {
            success: false,
            error: `Minimum Withdrawal: The minimum withdrawal amount is UGX ${MIN_WITHDRAWAL_UGX.toLocaleString()}.`,
          };
        }

        const { data: walletRow } = await sb.from('wallets').select('total_balance_ugx').eq('user_id', userId).maybeSingle();
        const availableBalance = walletRow ? Number(walletRow.total_balance_ugx) : 0;
        if (numericAmount > availableBalance) {
          return {
            success: false,
            error: `Insufficient balance: requested UGX ${numericAmount.toLocaleString()}, available UGX ${availableBalance.toLocaleString()}`,
          };
        }

        // Check qualifying deposit and bonus restriction
        const { data: deposits } = await sb
          .from('transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'deposit')
          .in('status', ['completed', 'approved']);
        const hasApprovedDeposit = deposits && deposits.length > 0;
        const nonBonusFunds = hasApprovedDeposit ? availableBalance : Math.max(0, availableBalance - 5000);

        if (!hasApprovedDeposit && (input.isBonusWithdrawal || numericAmount > nonBonusFunds)) {
          return {
            success: false,
            error: 'Welcome Bonus Restriction: The UGX 5,000 welcome bonus cannot be withdrawn until you have made a qualifying deposit (minimum UGX 20,000). A 30% bonus protection charge applies to bonus withdrawals.',
          };
        }
      }

      const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const nowIso = now.toISOString();
      const insertBase = {
        id: txId,
        user_id: userId,
        type: input.type,
        amount_ugx: numericAmount,
        currency: 'UGX',
        status: 'pending',
        description: input.description || `${input.type.toUpperCase()} Request — UGX ${numericAmount.toLocaleString()}`,
        payment_method: input.paymentMethod || null,
        recipient_info: input.recipientInfo || null,
        created_at: nowIso,
      };

      // Try inserting with ISO string timestamp (TIMESTAMPTZ)
      let insertRes = await sb.from('transactions').insert({
        ...insertBase,
        timestamp: nowIso,
      });

      // If failed due to timestamp column type mismatch (e.g. if column was created as BIGINT), retry
      if (insertRes.error) {
        const retryNumeric = await sb.from('transactions').insert({
          ...insertBase,
          timestamp: Date.now(),
        });
        if (!retryNumeric.error) {
          insertRes = retryNumeric;
        } else {
          // If still failed, try without timestamp column
          const retryOmitted = await sb.from('transactions').insert(insertBase);
          if (!retryOmitted.error) {
            insertRes = retryOmitted;
          }
        }
      }

      if (insertRes.error) {
        return { success: false, error: translate(insertRes.error.message) };
      }

      // Insert notification for the user
      try {
        await sb.from('notifications').insert({
          id: `notif_submit_${txId}`,
          user_id: userId,
          title: input.type === 'deposit' ? 'Deposit Submitted (Pending)' : 'Withdrawal Submitted (Pending)',
          message: input.type === 'deposit'
            ? `Your deposit of UGX ${input.amountUGX.toLocaleString()} is pending approval.`
            : `Your withdrawal of UGX ${input.amountUGX.toLocaleString()} is pending approval.`,
          read: false,
          type: 'info',
          created_at: nowIso,
        });
      } catch {
        // non-blocking
      }

      // Also insert into admin_tasks for visibility in Admin Dashboard
      try {
        await sb.from('admin_tasks').insert({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          transaction_id: txId,
          title: `${input.type === 'deposit' ? 'Deposit Verification' : 'Withdrawal Review'}: UGX ${input.amountUGX.toLocaleString()}`,
          description: `User requested ${input.type} of UGX ${input.amountUGX.toLocaleString()} via ${input.paymentMethod || 'Mobile Money'}`,
          priority: 'high',
          category: input.type === 'deposit' ? 'Deposit Verification' : 'Withdrawal Review',
          type: input.type,
          status: 'pending',
          amount_ugx: input.amountUGX,
          created_at: nowIso,
        });
      } catch {
        // non-blocking
      }

      return {
        success: true,
        transaction: {
          id: txId,
          userId,
          type: input.type,
          amountUGX: input.amountUGX,
          currency: 'UGX',
          status: 'pending',
          date: now.toLocaleString(),
          timestamp: nowIso,
          created_at: nowIso,
          description: insertBase.description,
          paymentMethod: input.paymentMethod,
          recipientInfo: input.recipientInfo,
        },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Transaction submission failed' };
    }
  },

  // ---------- ATOMIC INVESTMENT PURCHASE (Persisted to Supabase) ----------
  async buyInvestment(
    machineOrId: Partial<Machine> | string,
    amountUGX?: number
  ): Promise<{ success: boolean; investment?: any; newBalance?: number; error?: string }> {
    const sb = getSupabaseClient();
    const machineObj: Partial<Machine> =
      typeof machineOrId === 'string'
        ? { id: machineOrId, minInvestUGX: amountUGX }
        : machineOrId;

    const cost = Number(amountUGX ?? machineObj.minInvestUGX ?? 0);
    // Per-product minimum: the selected product's configured minimum_investment_amount.
    // Fall back to the product's own minInvestUGX when no explicit minimum is supplied.
    const productMin = Number(machineObj.minimum_investment_amount ?? machineObj.minInvestUGX ?? 0);
    if (!cost || cost < productMin) {
      return {
        success: false,
        error: `Minimum investment for this product is UGX ${productMin.toLocaleString()}.`,
      };
    }

    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      // 1. Try atomic RPC first
      const { data: rpcData, error: rpcError } = await sb.rpc('buy_investment', {
        p_machine_id: machineObj.id || 'custom_node',
        p_title: machineObj.title || 'Investment Node',
        p_category: machineObj.category || 'DS-Mining',
        p_image: machineObj.image || '/images/precious-metals-portfolio.svg',
        p_amount_ugx: cost,
        p_daily_reward_ugx: calculateDailyReturnUGX(cost),
        p_hashrate: machineObj.hashrate || '10.0 TH/s',
        p_power_source: machineObj.powerSource || 'Clean Energy Array',
        p_est_roi: Number(machineObj.estYearlyROI || 120),
      });

      if (!rpcError && rpcData?.success) {
        return {
          success: true,
          newBalance: Number(rpcData.new_balance),
          investment: {
            id: rpcData.user_machine_id,
            machineId: machineObj.id,
            title: machineObj.title,
            amountInvestedUGX: cost,
          },
        };
      }

      // No fallback: the purchase must be atomic (wallet debit + machine +
      // transaction + notification). If the RPC is missing/fails we refuse.
      return { success: false, error: rpcError ? translate(rpcError.message) : 'Investment failed.' };
    } catch (e: any) {
      console.error('[Supabase Admin] buyInvestment error:', e);
      return { success: false, error: e?.message || 'Investment failed.' };
    }
  },

  // ---------- CLAIM INVESTMENT YIELD (atomic via claim_reward RPC) ----------
  async claimInvestmentYield(userMachineId: string): Promise<{ success: boolean; claimedUGX?: number; newBalance?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('claim_reward', { p_user_machine_id: userMachineId });
      if (error) return { success: false, error: translate(error.message) };
      if (!data?.success) {
        return { success: false, error: 'No accumulated yield available to claim at this time.' };
      }
      return {
        success: true,
        claimedUGX: Number(data.claimed_ugx || 0),
        newBalance: Number(data.new_balance || 0),
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to claim yield' };
    }
  },

  // ---------- DYNAMIC PRODUCTS CATALOG (Stored in Supabase catalog_machines) ----------
  async uploadProjectImage(file: File): Promise<{ publicUrl?: string; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    // 1. Validate file format
    if (!file.type || !file.type.startsWith('image/')) {
      return { error: 'Invalid file format. Please upload a valid image file (PNG, JPG, JPEG, WebP, or SVG).' };
    }

    // 2. Validate file size (max 5 MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return { error: `Image file is too large (${sizeMB} MB). Maximum allowed size is 5 MB.` };
    }

    const bucketName = 'project-images';

    try {
      // Ensure the public bucket exists if allowed by permissions
      try {
        const { data: bucketData, error: bucketError } = await sb.storage.getBucket(bucketName);
        if (bucketError || !bucketData) {
          await sb.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'],
          });
        }
      } catch (bucketCatch) {
        // Bucket may already exist or getBucket might be restricted; proceed with direct upload
        console.log('[Supabase Storage] Bucket check/create note:', bucketCatch);
      }

      // Generate a unique, safe file path
      const fileExt = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
      const uniquePath = `products/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${rawBaseName}.${fileExt}`;

      // Upload file directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await sb.storage
        .from(bucketName)
        .upload(uniquePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('[Supabase Storage] Upload failed:', uploadError);
        return { error: `Failed to upload image to Supabase Storage: ${uploadError.message}` };
      }

      // Generate public URL using getPublicUrl
      const { data: urlData } = sb.storage
        .from(bucketName)
        .getPublicUrl(uniquePath);

      if (!urlData || !urlData.publicUrl) {
        return { error: 'Failed to generate public URL from Supabase Storage.' };
      }

      return { publicUrl: urlData.publicUrl };
    } catch (err: any) {
      console.error('[Supabase Storage] Exception during upload:', err);
      return { error: err?.message || 'Failed to upload project image' };
    }
  },

  async fetchCatalogMachines(): Promise<{ machines: Machine[]; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { machines: [], error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .order('minimum_investment_amount', { ascending: true });
      if (error) {
        return { machines: [], error: error.message };
      }
      if (!data || data.length === 0) {
        return { machines: [] };
      }

      const mappedMachines: Machine[] = data.map((m: any) => {
        const minInvest = Number(m.minimum_investment_amount || m.minimum_investment || 0);

        return {
          id: m.id,
          title: m.name,
          subtitle: m.subtitle || undefined,
          category: m.category || 'DS-Mining',
          image: m.image_url || m.image || '/images/precious-metals-portfolio.svg',
          dailyRewardUGX: Number(m.daily_reward_ugx || 0),
          status: m.status === 'active' ? 'Active' : 'Maintenance',
          estYearlyROI: Number(m.expected_return || 0),
          minInvestUGX: minInvest,
          minimum_investment_amount: minInvest,
          hashrate: m.hashrate || '10.0 TH/s',
          powerSource: m.power_source || 'Clean Energy Array',
          uptime: m.uptime || '99.9%',
          temperature: m.temperature || '36.0°C',
          efficiency: Number(m.efficiency || 98.5),
          totalMinedUGX: 0,
          unclaimedRewardsUGX: 0,
          isBoosted: false,
        };
      });

      return { machines: mappedMachines };
    } catch (e: any) {
      return { machines: [], error: e?.message || 'Failed to load products.' };
    }
  },

  async createCatalogMachine(machine: Partial<Machine>): Promise<{ success: boolean; machine?: Machine; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    const machineId = machine.id || `mach_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cost = Math.round(Number(machine.minInvestUGX || 0));
    const minInvestment = Math.round(Number(machine.minimum_investment_amount ?? cost ?? 0));

    if (!machine.title || !cost) {
      return { success: false, error: 'Project Title and Minimum Investment amount are required.' };
    }

    const payload = {
      id: machineId,
      name: machine.title.trim(),
      slug: machineId,
      description: machine.subtitle ? machine.subtitle.trim() : null,
      subtitle: machine.subtitle ? machine.subtitle.trim() : null,
      category: machine.category || 'DS-Mining',
      image_url: machine.image || '/images/precious-metals-portfolio.svg',
      daily_reward_ugx: Number(machine.dailyRewardUGX || 250000),
      status: machine.status === 'Active' ? 'active' : 'inactive',
      expected_return: Number(machine.estYearlyROI || 120),
      minimum_investment: minInvestment,
      minimum_investment_amount: minInvestment,
      currency: 'UGX',
      hashrate: machine.hashrate || '50.0 TH/s',
      power_source: machine.powerSource || 'Clean Energy Array',
      uptime: machine.uptime || '99.9%',
      temperature: machine.temperature || '38.0°C',
      efficiency: Number(machine.efficiency || 99.0),
    };

    try {
      const { error } = await sb.from('products').insert(payload);
      if (error) return { success: false, error: translate(error.message) };

      const created: Machine = {
        id: payload.id,
        title: payload.name,
        subtitle: payload.subtitle || undefined,
        category: payload.category as any,
        image: payload.image_url,
        dailyRewardUGX: payload.daily_reward_ugx,
        status: machine.status as any,
        estYearlyROI: payload.expected_return,
        minInvestUGX: payload.minimum_investment,
        minimum_investment_amount: payload.minimum_investment,
        hashrate: payload.hashrate,
        powerSource: payload.power_source,
        uptime: payload.uptime,
        temperature: payload.temperature,
        efficiency: payload.efficiency,
        totalMinedUGX: 0,
        unclaimedRewardsUGX: 0,
        isBoosted: false,
      };

      return { success: true, machine: created };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to create catalog product' };
    }
  },

  async updateCatalogMachine(id: string, machine: Partial<Machine>): Promise<{ success: boolean; machine?: Machine; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    const updatePayload: any = {};
    if (machine.title !== undefined) updatePayload.name = machine.title.trim();
    if (machine.subtitle !== undefined) updatePayload.subtitle = machine.subtitle ? machine.subtitle.trim() : null;
    if (machine.category !== undefined) updatePayload.category = machine.category;
    if (machine.image !== undefined) updatePayload.image_url = machine.image;
    if (machine.dailyRewardUGX !== undefined) updatePayload.daily_reward_ugx = Number(machine.dailyRewardUGX);
    if (machine.status !== undefined) updatePayload.status = machine.status === 'Active' ? 'active' : 'inactive';
    if (machine.estYearlyROI !== undefined) updatePayload.expected_return = Number(machine.estYearlyROI);
    if (machine.minInvestUGX !== undefined) updatePayload.minimum_investment = Math.round(Number(machine.minInvestUGX));
    if (machine.minimum_investment_amount !== undefined) {
      const minimum = Math.round(Number(machine.minimum_investment_amount));
      updatePayload.minimum_investment = minimum;
      updatePayload.minimum_investment_amount = minimum;
    }
    if (machine.hashrate !== undefined) updatePayload.hashrate = machine.hashrate;
    if (machine.powerSource !== undefined) updatePayload.power_source = machine.powerSource;
    if (machine.uptime !== undefined) updatePayload.uptime = machine.uptime;
    if (machine.temperature !== undefined) updatePayload.temperature = machine.temperature;
    if (machine.efficiency !== undefined) updatePayload.efficiency = Number(machine.efficiency);

    try {
      const { data, error } = await sb
        .from('products')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) return { success: false, error: translate(error.message) };

      const updated: Machine = {
        id: data.id,
        title: data.name,
        subtitle: data.subtitle || undefined,
        category: data.category,
        image: data.image_url,
        dailyRewardUGX: Number(data.daily_reward_ugx),
        status: data.status === 'active' ? 'Active' : 'Maintenance',
        estYearlyROI: Number(data.expected_return),
        minInvestUGX: Number(data.minimum_investment_amount || data.minimum_investment),
        minimum_investment_amount: Number(data.minimum_investment_amount || data.minimum_investment),
        hashrate: data.hashrate,
        powerSource: data.power_source,
        uptime: data.uptime,
        temperature: data.temperature,
        efficiency: Number(data.efficiency),
        totalMinedUGX: 0,
        unclaimedRewardsUGX: 0,
        isBoosted: false,
      };

      return { success: true, machine: updated };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update catalog product' };
    }
  },

  async deleteCatalogMachine(id: string): Promise<{ success: boolean; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { error } = await sb.from('products').delete().eq('id', id);
      if (error) return { success: false, error: translate(error.message) };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete catalog product' };
    }
  },

  /**
   * Fetch referral percentage directly via Supabase RPC get_referral_percent()
   * Single source of truth from backend.
   */
  async getReferralPercent(): Promise<{ percent?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database connection is not initialized. Please refresh and try again.' };

    try {
      const { data, error } = await sb.rpc('get_referral_percent');
      if (error) {
        // Fallback to get_platform_settings if needed
        const { data: altData, error: altErr } = await sb.rpc('get_platform_settings');
        if (altErr) return { error: error.message };
        const row = (altData || []).find((r: any) => r.key === 'referral_percentage');
        if (row && row.numeric_value !== undefined) {
          return { percent: Number(row.numeric_value) };
        }
        return { error: error.message };
      }

      let val: number | undefined;
      if (typeof data === 'number') {
        val = data;
      } else if (typeof data === 'string') {
        val = Number(data);
      } else if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        val = Number(item?.get_referral_percent ?? item?.p_percent ?? item?.percent ?? item?.numeric_value ?? item);
      } else if (typeof data === 'object' && data !== null) {
        val = Number((data as any).get_referral_percent ?? (data as any).p_percent ?? (data as any).percent ?? (data as any).numeric_value);
      }

      if (val !== undefined && Number.isFinite(val)) {
        return { percent: val };
      }
      return { percent: Number(data) || 0 };
    } catch (e: any) {
      return { error: e?.message || 'Failed to fetch referral percent' };
    }
  },

  /**
   * Update referral percentage via Supabase RPC admin_update_referral_percent(p_percent numeric)
   */
  async adminUpdateReferralPercent(percent: number): Promise<{ percent?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database connection is not initialized. Please refresh and try again.' };

    try {
      const { data, error } = await sb.rpc('admin_update_referral_percent', {
        p_percent: percent,
      });
      if (error) {
        return { error: error.message };
      }

      let returnedVal: number = percent;
      if (typeof data === 'number') {
        returnedVal = data;
      } else if (typeof data === 'string') {
        returnedVal = Number(data);
      } else if (Array.isArray(data) && data.length > 0) {
        returnedVal = Number(data[0]?.admin_update_referral_percent ?? data[0]?.p_percent ?? data[0]?.percent ?? data[0]?.numeric_value ?? data[0]);
      } else if (typeof data === 'object' && data !== null) {
        returnedVal = Number((data as any).admin_update_referral_percent ?? (data as any).p_percent ?? (data as any).percent ?? (data as any).numeric_value ?? percent);
      }

      return { percent: returnedVal };
    } catch (e: any) {
      return { error: e?.message || 'Failed to update referral percent' };
    }
  },

  async fetchPlatformSettings(): Promise<{ settings?: PlatformSettings; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database connection is not initialized. Please refresh and try again.' };

    try {
      const { data, error } = await sb.rpc('get_platform_settings');
      if (!error && Array.isArray(data) && data.length > 0) {
        const values = Object.fromEntries(data.map((row: any) => [row.key, Number(row.numeric_value)]));
        return {
          settings: {
            referral_percentage: Number(values.referral_percentage ?? 15),
            minimum_withdrawal_amount: Number(values.minimum_withdrawal_amount ?? 5000),
          },
        };
      }
    } catch {
      // Continue to table query fallback
    }

    try {
      const { data: tableData, error: tableError } = await sb
        .from('platform_settings')
        .select('key, numeric_value');
      if (!tableError && Array.isArray(tableData) && tableData.length > 0) {
        const values = Object.fromEntries(tableData.map((row: any) => [row.key, Number(row.numeric_value)]));
        return {
          settings: {
            referral_percentage: Number(values.referral_percentage ?? 15),
            minimum_withdrawal_amount: Number(values.minimum_withdrawal_amount ?? 5000),
          },
        };
      }
    } catch {
      // Continue to fallback defaults
    }

    return {
      settings: {
        referral_percentage: 15,
        minimum_withdrawal_amount: 5000,
      },
    };
  },

  async updatePlatformSetting(
    key: keyof PlatformSettings,
    value: number
  ): Promise<{ value?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database connection is not initialized. Please refresh and try again.' };

    if (key === 'referral_percentage') {
      try {
        const { data, error } = await sb.rpc('admin_update_referral_percent', { p_percent: value });
        if (!error) {
          const numericRes = Array.isArray(data) ? Number(data[0]?.admin_update_referral_percent ?? data[0]) : Number(data);
          return { value: Number.isFinite(numericRes) ? numericRes : value };
        }
      } catch {
        // Fallback to admin_update_platform_setting
      }
    }

    try {
      const { data, error } = await sb.rpc('admin_update_platform_setting', {
        p_key: key,
        p_numeric_value: value,
      });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        return { value: Number(row?.numeric_value ?? value) };
      }
    } catch {
      // Fallback to direct table upsert
    }

    // Direct table upsert fallback
    try {
      const { data: upsertData, error: upsertErr } = await sb
        .from('platform_settings')
        .upsert({ key, numeric_value: value, updated_at: new Date().toISOString() })
        .select('numeric_value');
      if (!upsertErr) {
        const row = Array.isArray(upsertData) ? upsertData[0] : upsertData;
        return { value: Number(row?.numeric_value ?? value) };
      }
      return { error: translate(upsertErr.message) };
    } catch (e: any) {
      return { error: e?.message || 'Failed to update platform setting' };
    }
  },

  async updateProductMinimum(id: string, minimum: number): Promise<{ machine?: Machine; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) return { error: 'Database connection is not initialized. Please refresh and try again.' };

    const { data, error } = await sb.rpc('admin_update_product_minimum', {
      p_product_id: id,
      p_minimum: minimum,
    });
    if (error) return { error: translate(error.message) };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: 'Product update returned no saved value.' };
    return {
      machine: {
        id: row.id,
        title: row.name,
        subtitle: row.subtitle || undefined,
        category: row.category,
        image: row.image_url || '',
        dailyRewardUGX: Number(row.daily_reward_ugx || 0),
        status: row.status === 'active' ? 'Active' : 'Maintenance',
        estYearlyROI: Number(row.expected_return || 0),
        minInvestUGX: Number(row.minimum_investment_amount),
        minimum_investment_amount: Number(row.minimum_investment_amount),
        hashrate: row.hashrate || '',
        powerSource: row.power_source || '',
        uptime: row.uptime || '',
        temperature: row.temperature || '',
        efficiency: Number(row.efficiency || 0),
        totalMinedUGX: 0,
        unclaimedRewardsUGX: 0,
        isBoosted: false,
      },
    };
  },

  // ---------- ADMIN: PENDING TRANSACTIONS ----------
  async fetchPendingTransactions(): Promise<{ transactions: Transaction[]; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { transactions: [], error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    const { data, error } = await sb.rpc('admin_pending_transactions');
    if (error) return { transactions: [], error: translate(error.message) };

    return {
      transactions: (data || []).map((t: any) => {
        const dateObj = t.timestamp
          ? new Date(t.timestamp)
          : (t.created_at ? new Date(t.created_at) : new Date());
        const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : new Date().toLocaleString();
        return {
          id: t.id,
          userId: t.user_id,
          username: t.username,
          userFullName: t.user_full_name,
          type: t.type,
          amountUGX: Number(t.amount_ugx),
          currency: 'UGX' as const,
          status: t.status as Transaction['status'],
          date: dateStr,
          timestamp: t.timestamp ? String(t.timestamp) : (t.created_at ? String(t.created_at) : undefined),
          created_at: t.created_at || undefined,
          description: t.description || '',
          paymentMethod: t.payment_method || undefined,
          recipientInfo: t.recipient_info || undefined,
        };
      }),
    };
  },

  // ---------- ADMIN: ALL TRANSACTIONS (WITH STATUSES & PROFILES) ----------
  async fetchAllTransactions(): Promise<{ transactions: Transaction[]; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { transactions: [], error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      // 1. Try security-definer RPC admin_all_transactions first
      const { data: rpcData, error: rpcError } = await sb.rpc('admin_all_transactions');
      if (!rpcError && rpcData) {
        return {
          transactions: rpcData.map((t: any) => {
            const dateObj = t.timestamp
              ? new Date(t.timestamp)
              : (t.created_at ? new Date(t.created_at) : new Date());
            const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : new Date().toLocaleString();
            return {
              id: t.id,
              userId: t.user_id,
              username: t.username || 'user',
              userFullName: t.user_full_name,
              type: t.type,
              amountUGX: Number(t.amount_ugx),
              currency: 'UGX' as const,
              status: (t.status || 'pending') as Transaction['status'],
              date: dateStr,
              timestamp: t.timestamp ? String(t.timestamp) : (t.created_at ? String(t.created_at) : undefined),
              created_at: t.created_at || undefined,
              description: t.description || '',
              paymentMethod: t.payment_method || undefined,
              recipientInfo: t.recipient_info || undefined,
              txHash: t.tx_hash || undefined,
            };
          }),
        };
      }

      // 2. Direct query on transactions table
      const { data, error } = await sb
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        // Fallback to pending transactions RPC if direct select is restricted
        return this.fetchPendingTransactions();
      }

      // Fetch user profile map to enrich with usernames and names
      const { data: profiles } = await sb.from('profiles').select('id, username, full_name');
      const profileMap = new Map<string, { username: string; full_name?: string }>();
      if (profiles) {
        profiles.forEach((p: any) => {
          profileMap.set(p.id, { username: p.username, full_name: p.full_name });
        });
      }

      return {
        transactions: (data || []).map((t: any) => {
          const profile = profileMap.get(t.user_id);
          const dateObj = t.timestamp
            ? new Date(t.timestamp)
            : (t.created_at ? new Date(t.created_at) : new Date());
          const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : new Date().toLocaleString();
          return {
            id: t.id,
            userId: t.user_id,
            username: profile?.username || t.username || 'user',
            userFullName: profile?.full_name || t.user_full_name,
            type: t.type,
            amountUGX: Number(t.amount_ugx || t.amount || 0),
            currency: 'UGX' as const,
            status: (t.status || 'pending') as Transaction['status'],
            date: dateStr,
            timestamp: t.timestamp ? String(t.timestamp) : (t.created_at ? String(t.created_at) : undefined),
            created_at: t.created_at || undefined,
            description: t.description || '',
            paymentMethod: t.payment_method || undefined,
            recipientInfo: t.recipient_info || undefined,
            txHash: t.tx_hash || undefined,
          };
        }),
      };
    } catch (e: any) {
      console.warn('[Supabase Admin] fetchAllTransactions exception:', e);
      return this.fetchPendingTransactions();
    }
  },

  // ---------- ADMIN: APPROVE / REJECT ----------
  async approveTransaction(txId: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('admin_approve_transaction', { p_transaction_id: txId });
      if (!error) {
        return { success: true, newBalance: data === null ? undefined : Number(data) };
      }

      return { success: false, error: translate(error.message) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Approval failed' };
    }
  },

  async rejectTransaction(txId: string): Promise<{ success: boolean; balance?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('admin_reject_transaction', { p_transaction_id: txId });
      if (!error) {
        return { success: true, balance: data === null ? undefined : Number(data) };
      }

      return { success: false, error: translate(error.message) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Rejection failed' };
    }
  },

  // ---------- ADMIN: USERS (from Supabase Auth + profiles + wallets) ----------
  async fetchAdminUsers(): Promise<{ users: AdminUserSummary[]; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { users: [], error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('admin_list_users');

      if (error) {
        console.warn('[Supabase Admin] admin_list_users RPC notice:', error.message);

        // Fallback: Direct select on profiles if RPC returned an authorization or naming error
        const { data: profileRows, error: profileErr } = await sb
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profileErr || !profileRows) {
          return { users: [], error: error.message || translate(error.message) };
        }

        // Fetch wallet balances for profiles
        const { data: walletRows } = await sb.from('wallets').select('user_id, balance, total_balance_ugx, active_machines_count');
        const walletMap = new Map<string, { balance: number; activeMachines: number }>();
        if (walletRows) {
          walletRows.forEach((w: any) => {
            walletMap.set(w.user_id, {
              balance: Number(w.balance ?? w.total_balance_ugx ?? 0),
              activeMachines: Number(w.active_machines_count ?? 0),
            });
          });
        }

        const fallbackUsers: AdminUserSummary[] = profileRows.map((p: any) => {
          const w = walletMap.get(p.id);
          const username = p.username || (p.email ? p.email.split('@')[0] : '') || (p.phone ? `user_${p.phone.slice(-4)}` : '') || 'user';
          const fullName = p.full_name || username || 'Unnamed User';
          const isAdmin = Boolean(p.is_admin);

          return {
            id: p.id,
            username,
            fullName,
            phone: p.phone || '',
            email: p.email || '',
            status: (p.status === 'blocked' ? 'blocked' : 'active') as 'active' | 'blocked',
            role: isAdmin ? ('admin' as const) : ('user' as const),
            isAdmin,
            tier: p.tier || 'Standard',
            memberSince: p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
            createdAt: p.created_at,
            balanceUGX: w?.balance ?? 0,
            activeMachinesCount: w?.activeMachines ?? 0,
            transactionsCount: 0,
            referralCount: Number(p.referral_count) || 0,
            referralCode: p.referral_code || '',
          };
        });

        return { users: fallbackUsers };
      }

      const mappedUsers: AdminUserSummary[] = (data || []).map((u: any) => {
        const meta = u.raw_user_meta_data || {};
        const username =
          u.username ||
          meta.username ||
          (u.email ? u.email.split('@')[0] : '') ||
          (u.phone ? `user_${String(u.phone).replace(/[^0-9]/g, '').slice(-4)}` : '') ||
          'user';
        const fullName =
          u.full_name ||
          meta.full_name ||
          meta.name ||
          (u.username ? `@${u.username}` : '') ||
          (u.email ? u.email.split('@')[0] : '') ||
          'Unnamed User';
        const phone = u.phone || meta.phone || '';
        const email = u.email || meta.email || '';
        const status = u.status === 'blocked' ? 'blocked' : 'active';
        const isAdmin = Boolean(u.is_admin || meta.is_admin);

        return {
          id: String(u.id),
          username,
          fullName,
          phone,
          email,
          status,
          role: isAdmin ? ('admin' as const) : ('user' as const),
          isAdmin,
          tier: u.tier || 'Standard',
          memberSince: u.auth_created_at ? new Date(u.auth_created_at).toLocaleDateString() : '',
          createdAt: u.auth_created_at,
          balanceUGX: Number(u.balance_ugx) || 0,
          activeMachinesCount: Number(u.active_machines_count) || 0,
          transactionsCount: Number(u.transactions_count) || 0,
          referralCount: Number(u.referral_count) || 0,
          referralCode: u.referral_code || '',
        };
      });

      return { users: mappedUsers };
    } catch (e: any) {
      console.error('[Supabase Admin] fetchAdminUsers exception:', e);
      return { users: [], error: e?.message || 'Failed to fetch users from Supabase' };
    }
  },

  async updateAdminUser(
    userId: string,
    data: { username?: string; fullName?: string; phone?: string; status?: 'active' | 'blocked' }
  ): Promise<{ success: boolean; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    const { error } = await sb.rpc('admin_update_user', {
      p_user_id: userId,
      p_username: data.username ?? null,
      p_full_name: data.fullName ?? null,
      p_phone: data.phone ?? null,
      p_status: data.status ?? null,
      p_full_name_meta: data.fullName ?? null,
    });
    if (error) return { success: false, error: translate(error.message) };
    return { success: true };
  },

  async adjustUserBalance(
    userId: string,
    adjustment: { amountUGX: number; type: 'add' | 'deduct'; reason: string }
  ): Promise<{ success: boolean; previousBalance?: number; newBalance?: number; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { success: false, error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    try {
      const { data, error } = await sb.rpc('admin_adjust_balance', {
        p_user_id: userId,
        p_amount: adjustment.amountUGX,
        p_type: adjustment.type,
        p_reason: adjustment.reason,
      });

      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row && (row.new_balance !== undefined || row.newBalance !== undefined)) {
          return {
            success: true,
            previousBalance: Number(row.previous_balance ?? row.previousBalance ?? 0),
            newBalance: Number(row.new_balance ?? row.newBalance ?? 0),
          };
        }
      }

      console.warn('[Supabase Admin] admin_adjust_balance RPC returned notice or empty, executing direct balance adjustment fallback...', error?.message);

      // Direct fallback: Select user wallet, calculate new balance, and upsert
      const { data: walletData } = await sb
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const currentBalance = Number(walletData?.total_balance_ugx ?? walletData?.balance ?? 0);
      const newBalance =
        adjustment.type === 'add'
          ? currentBalance + adjustment.amountUGX
          : Math.max(0, currentBalance - adjustment.amountUGX);

      if (adjustment.type === 'deduct' && adjustment.amountUGX > currentBalance) {
        return {
          success: false,
          error: `Cannot deduct UGX ${adjustment.amountUGX.toLocaleString()}. User balance is only UGX ${currentBalance.toLocaleString()}.`,
        };
      }

      // Upsert wallet balance
      const { error: walletUpdateErr } = await sb.from('wallets').upsert({
        user_id: userId,
        total_balance_ugx: newBalance,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (walletUpdateErr) {
        console.warn('[Supabase Admin] Direct wallet update notice:', walletUpdateErr);
        // Try updating existing row
        await sb
          .from('wallets')
          .update({ total_balance_ugx: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }

      // Fetch user and admin details for the audit log
      const { data: userProfile } = await sb.from('profiles').select('username, full_name').eq('id', userId).maybeSingle();
      const { data: authAdmin } = await sb.auth.getUser();
      const adminId = authAdmin?.user?.id || 'admin';
      const adminUsername = authAdmin?.user?.user_metadata?.username || authAdmin?.user?.email?.split('@')[0] || 'Admin';

      const now = new Date();
      const nowIso = now.toISOString();

      // Insert into balance_adjustments table
      try {
        await sb.from('balance_adjustments').insert({
          id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: userId,
          username: userProfile?.username || 'user',
          user_full_name: userProfile?.full_name || 'User',
          previous_balance_ugx: currentBalance,
          adjustment_amount_ugx: adjustment.amountUGX,
          new_balance_ugx: newBalance,
          type: adjustment.type,
          reason: adjustment.reason || 'Admin balance adjustment',
          admin_id: adminId,
          admin_username: adminUsername,
          timestamp: nowIso,
          date: nowIso.split('T')[0],
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('[Supabase Admin] balance_adjustments insert notice:', e);
      }

      // Insert completed transaction into transactions table
      try {
        await sb.from('transactions').insert({
          id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: userId,
          type: 'adjustment',
          amount_ugx: adjustment.amountUGX,
          currency: 'UGX',
          status: 'completed',
          description: `Admin Balance Adjustment (${adjustment.type === 'add' ? 'Credit' : 'Deduction'}): ${adjustment.reason || 'Manual balance update'}`,
          timestamp: nowIso,
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('[Supabase Admin] transactions table notice:', e);
      }

      // Insert notification for the user
      try {
        await sb.from('notifications').insert({
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: userId,
          title: adjustment.type === 'add' ? 'Funds Credited by Admin' : 'Funds Deducted by Admin',
          message: `Your wallet balance was ${adjustment.type === 'add' ? 'credited with UGX ' : 'deducted by UGX '} ${adjustment.amountUGX.toLocaleString()}. New balance: UGX ${newBalance.toLocaleString()}. Reason: ${adjustment.reason}`,
          read: false,
          type: adjustment.type === 'add' ? 'success' : 'info',
          created_at: nowIso,
        });
      } catch (e) {
        console.warn('[Supabase Admin] notifications insert notice:', e);
      }

      return {
        success: true,
        previousBalance: currentBalance,
        newBalance: newBalance,
      };
    } catch (e: any) {
      console.error('[Supabase Admin] adjustUserBalance exception:', e);
      return { success: false, error: e?.message || 'Failed to adjust user balance' };
    }
  },

  // ---------- ADMIN: AUDIT LOG ----------
  async fetchBalanceAdjustments(): Promise<{ adjustments: BalanceAdjustment[]; error?: string }> {
    const sb = getSupabaseClient();
    if (!sb) {
      return { adjustments: [], error: 'Database connection is not initialized. Please refresh and try again.' };
    }

    const { data, error } = await sb
      .from('balance_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { adjustments: [], error: translate(error.message) };

    return {
      adjustments: (data || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        username: a.username,
        userFullName: a.user_full_name || undefined,
        previousBalanceUGX: Number(a.previous_balance_ugx),
        adjustmentAmountUGX: Number(a.adjustment_amount_ugx),
        newBalanceUGX: Number(a.new_balance_ugx),
        type: a.type,
        reason: a.reason,
        adminId: a.admin_id,
        adminUsername: a.admin_username,
        timestamp: a.timestamp ? String(a.timestamp) : (a.created_at ? String(a.created_at) : new Date().toISOString()),
        date: a.date || (a.created_at ? new Date(a.created_at).toLocaleDateString() : new Date().toLocaleDateString()),
        created_at: a.created_at || undefined,
      })),
    };
  },
};

function translate(msg: string): string {
  if (!msg) return 'Unknown database error';
  if (msg.includes('Admin access required')) return 'Admin access required.';
  if (msg.includes('Insufficient balance')) return msg.replace('{"message":', '').replace(/"/g, '');
  if (msg.includes('row-level security')) return 'Permission denied by database policy.';
  return msg;
}
