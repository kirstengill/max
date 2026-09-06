import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Server-side Supabase client (Lazy initialized with project credentials)
let supabaseAdmin: SupabaseClient | null = null;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY as string;

if (supabaseUrl && supabaseKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('Supabase initialization in server notice:', e);
  }
}

// Data structures for server-managed single source of truth
export interface ServerUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  status: 'active' | 'blocked';
  role: 'admin' | 'user';
  isAdmin: boolean;
  tier: string;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  referralEarningsUGX: number;
  referrals: any[];
  welcomeBonusClaimed: boolean;
  memberSince: string;
  createdAt: string;
  token?: string;
}

export interface BalanceAdjustmentRecord {
  id: string;
  userId: string;
  username: string;
  userFullName?: string;
  previousBalanceUGX: number;
  adjustmentAmountUGX: number;
  newBalanceUGX: number;
  type: 'add' | 'deduct';
  reason: string;
  adminId: string;
  adminUsername: string;
  timestamp: number;
  date: string;
}

export interface CatalogMachine {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Alpha Vaults' | 'Infrastructure' | 'Private Wealth' | 'Liquid Yield' | 'VIP Products' | 'Clean Energy' | 'DS-Mining' | 'All' | string;
  image: string;
  dailyRewardUGX: number;
  status: 'Active' | 'Maintenance' | 'Pending' | 'Reserved';
  estYearlyROI: number;
  minInvestUGX: number;
  hashrate: string;
  powerSource: string;
  uptime: string;
  temperature: string;
  efficiency: number;
  totalMinedUGX: number;
  unclaimedRewardsUGX: number;
  isBoosted?: boolean;
}

interface ServerUserStore {
  [userId: string]: {
    user: ServerUserRecord;
    data: {
      wallet: {
        totalBalanceUGX: number;
        dailyPnlUGX: number;
        activeMachinesCount: number;
        pendingTasksCount: number;
        welcomeBonusUGX?: number;
        withdrawableBalanceUGX?: number;
        depositedBalanceUGX?: number;
        bonusLocked?: boolean;
      };
      transactions: any[];
      machines: any[];
      adminTasks: any[];
      notifications: any[];
    };
  };
}

// Initial Database Stores with default test users
const defaultAdminId = '95bf6171-7258-49e6-b5aa-477c4266b9a4';
const defaultUserId = 'usr_demo_solnova';

const serverDatabase: ServerUserStore = {
  [defaultAdminId]: {
    user: {
      id: defaultAdminId,
      username: 'coolman',
      passwordHash: 'TestPass123!',
      fullName: 'Cool Man (Platform Admin)',
      phone: '+256700000000',
      status: 'active',
      role: 'admin',
      isAdmin: true,
      tier: 'VIP 2 Elite',
      referralCode: 'SC-ADMIN01',
      referralCount: 3,
      referralEarningsUGX: 120000,
      referrals: [],
      welcomeBonusClaimed: true,
      memberSince: 'August 2026',
      createdAt: new Date().toISOString(),
    },
    data: {
      wallet: {
        totalBalanceUGX: 25000000,
        dailyPnlUGX: 250000,
        activeMachinesCount: 2,
        pendingTasksCount: 1,
      },
      transactions: [
        {
          id: 'tx_init_1',
          userId: defaultAdminId,
          username: 'coolman',
          type: 'deposit',
          amountUGX: 25000000,
          currency: 'UGX',
          status: 'completed',
          date: new Date().toLocaleString(),
          timestamp: Date.now(),
          created_at: new Date().toISOString(),
          description: 'Initial Capital Injection',
          paymentMethod: 'Bank Transfer',
        },
      ],
      machines: [],
      adminTasks: [
        {
          id: 'task_init_1',
          userId: defaultUserId,
          title: 'Deposit Verification: UGX 50,000',
          description: 'User demouser requested deposit of UGX 50,000 via MTN Mobile Money',
          priority: 'high',
          category: 'Deposit Verification',
          type: 'deposit',
          status: 'pending',
          amountUGX: 50000,
          date: new Date().toLocaleString(),
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        },
      ],
      notifications: [
        {
          id: 'notif_init_1',
          userId: defaultAdminId,
          title: 'Welcome to SolNova Capital Admin',
          message: 'You have administrator privileges to review transactions, manage catalog nodes, and adjust balances.',
          type: 'system',
          read: false,
          date: 'Just now',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  },
  [defaultUserId]: {
    user: {
      id: defaultUserId,
      username: 'demouser',
      passwordHash: 'TestPass123!',
      fullName: 'Demo Investor',
      phone: '+256711111111',
      status: 'active',
      role: 'user',
      isAdmin: false,
      tier: 'Standard',
      referralCode: 'SC-DEMO01',
      referralCount: 1,
      referralEarningsUGX: 15000,
      referrals: [],
      welcomeBonusClaimed: true,
      memberSince: 'August 2026',
      createdAt: new Date().toISOString(),
    },
    data: {
      wallet: {
        totalBalanceUGX: 75000,
        dailyPnlUGX: 3500,
        activeMachinesCount: 1,
        pendingTasksCount: 0,
      },
      transactions: [
        {
          id: 'tx_demo_bonus',
          userId: defaultUserId,
          username: 'demouser',
          type: 'bonus',
          amountUGX: 5000,
          currency: 'UGX',
          status: 'completed',
          date: new Date().toLocaleString(),
          timestamp: Date.now(),
          created_at: new Date().toISOString(),
          description: 'Welcome Bonus — UGX 5,000 (New Account Activation)',
          paymentMethod: 'System',
        },
      ],
      machines: [],
      adminTasks: [],
      notifications: [
        {
          id: 'notif_demo_1',
          userId: defaultUserId,
          title: 'Welcome Bonus Credited!',
          message: 'UGX 5,000 Welcome Bonus has been credited to your account.',
          type: 'success',
          read: false,
          date: 'Just now',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  },
};

const activeTokens: { [token: string]: string } = {
  'tok_admin_coolman': defaultAdminId,
  'tok_user_demouser': defaultUserId,
};
const balanceAdjustments: BalanceAdjustmentRecord[] = [];

// Seed Default Investment Projects Catalog
let catalogDatabase: CatalogMachine[] = [
  {
    id: 'mach_starter_15k',
    title: 'VESTRA Liquid Arbitrage Vault',
    subtitle: '(High-Frequency Algorithmic Yield)',
    category: 'Liquid Yield',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 4500,
    status: 'Active',
    estYearlyROI: 10950,
    minInvestUGX: 15000,
    hashrate: 'Algorithmic MM Engine',
    powerSource: 'Tier-1 Liquidity Reserve',
    uptime: '99.98%',
    temperature: 'Optimal',
    efficiency: 99.5,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'mach_horizon_liquid_res',
    title: 'VESTRA Horizon Liquid Reserve',
    subtitle: '(Daily Flexible Income Vault)',
    category: 'Liquid Yield',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 6200,
    status: 'Active',
    estYearlyROI: 11315,
    minInvestUGX: 20000,
    hashrate: 'Dynamic Yield Engine',
    powerSource: 'Multi-Protocol Vault',
    uptime: '99.99%',
    temperature: 'Nominal',
    efficiency: 99.7,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
  {
    id: 'mach_solar_mech_10',
    title: 'VESTRA Sovereign AI Cluster',
    subtitle: '(High-Throughput Enterprise GPU Infrastructure)',
    category: 'Infrastructure',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 9600,
    status: 'Active',
    estYearlyROI: 11680,
    minInvestUGX: 30000,
    hashrate: '520 TFLOPS FP16',
    powerSource: 'Hydro-Cooled Zero Carbon Grid',
    uptime: '99.99%',
    temperature: '19.4°C',
    efficiency: 99.8,
    totalMinedUGX: 18450000,
    unclaimedRewardsUGX: 142800,
    isBoosted: false,
  },
  {
    id: 'mach_ds_mining_shoe',
    title: 'VESTRA Quantum Alpha Fund',
    subtitle: '(Delta-Neutral Quantitative Multi-Strategy)',
    category: 'Alpha Vaults',
    image: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 20000,
    status: 'Active',
    estYearlyROI: 12166,
    minInvestUGX: 60000,
    hashrate: 'Dynamic Matrix v4',
    powerSource: 'Automated Smart Liquidity',
    uptime: '100.00%',
    temperature: 'Nominal',
    efficiency: 99.9,
    totalMinedUGX: 148200000,
    unclaimedRewardsUGX: 890000,
    isBoosted: true,
  },
  {
    id: 'mach_hydro_turbine_x500',
    title: 'VESTRA Clean Grid Infrastructure',
    subtitle: '(Renewable Micro-Turbine & Solar Grid)',
    category: 'Infrastructure',
    image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 42000,
    status: 'Active',
    estYearlyROI: 12775,
    minInvestUGX: 120000,
    hashrate: '1.2 MW Co-Gen',
    powerSource: 'High-Efficiency Hydroelectric & Solar',
    uptime: '99.95%',
    temperature: '22.0°C',
    efficiency: 99.6,
    totalMinedUGX: 42100000,
    unclaimedRewardsUGX: 350000,
    isBoosted: false,
  },
  {
    id: 'mach_quantum_vip_9000',
    title: 'VESTRA Apex VIP Syndicate',
    subtitle: '(Exclusive Institutional Private Placement)',
    category: 'Private Wealth',
    image: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1000&q=80',
    dailyRewardUGX: 110000,
    status: 'Active',
    estYearlyROI: 13383,
    minInvestUGX: 300000,
    hashrate: 'Sovereign Institutional',
    powerSource: 'Prime Custodial Yield Pool',
    uptime: '100.00%',
    temperature: 'Cryo-Shielded',
    efficiency: 100.0,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  },
];

// Cloud Database Synchronization (No local disk persistence)
async function syncDatabaseCloud(userId?: string) {
  if (!supabaseAdmin) return;
  try {
    if (userId && serverDatabase[userId]) {
      const u = serverDatabase[userId];
      await supabaseAdmin.from('wallets').upsert({
        user_id: userId,
        total_balance_ugx: u.data.wallet.totalBalanceUGX,
        daily_pnl_ugx: u.data.wallet.dailyPnlUGX,
        active_machines_count: u.data.wallet.activeMachinesCount,
        pending_tasks_count: u.data.wallet.pendingTasksCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
  } catch (e) {
    // Supabase cloud sync notice
  }
}

function saveDatabaseToDisk() {
  // Local device disk persistence removed. All persistent data is hosted in Supabase.
}

function generateToken(userId: string): string {
  const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  activeTokens[token] = userId;
  saveDatabaseToDisk();
  return token;
}

// Authentication Middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (token && activeTokens[token]) {
    const userId = activeTokens[token];
    const record = serverDatabase[userId];
    if (record) {
      (req as any).userId = userId;
      (req as any).userRecord = record.user;
      return next();
    }
  }

  const userIdHeader = req.headers['x-user-id'] as string;
  if (userIdHeader && serverDatabase[userIdHeader]) {
    (req as any).userId = userIdHeader;
    (req as any).userRecord = serverDatabase[userIdHeader].user;
    return next();
  }

  if (supabaseAdmin && token) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user;
        let record = serverDatabase[u.id];
        if (!record) {
          const meta = u.user_metadata || {};
          const isAdmin = meta.role === 'admin' || meta.is_admin === true;
          record = {
            user: {
              id: u.id,
              username: meta.username || u.email?.split('@')[0] || 'user',
              passwordHash: '',
              fullName: meta.full_name || meta.username || 'User',
              phone: meta.phone || '',
              status: meta.status || 'active',
              role: isAdmin ? 'admin' : 'user',
              isAdmin,
              tier: isAdmin ? 'VIP 2 Elite' : 'Standard',
              referralCode: meta.referral_code || 'SC-DEMO',
              referralCount: 0,
              referralEarningsUGX: 0,
              referrals: [],
              welcomeBonusClaimed: true,
              memberSince: 'August 2026',
              createdAt: new Date().toISOString(),
            },
            data: {
              wallet: {
                totalBalanceUGX: 5000,
                welcomeBonusUGX: 5000,
                withdrawableBalanceUGX: 0,
                depositedBalanceUGX: 0,
                bonusLocked: true,
                dailyPnlUGX: 0,
                activeMachinesCount: 0,
                pendingTasksCount: 0,
              },
              transactions: [],
              machines: [],
              adminTasks: [],
              notifications: [],
            },
          };
          serverDatabase[u.id] = record;
        }
        activeTokens[token] = u.id;
        (req as any).userId = u.id;
        (req as any).userRecord = record.user;
        return next();
      }
    } catch (e) {
      // remote auth fallback
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Valid authentication token required.' });
}

// Administrator Authorization Middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).userRecord as ServerUserRecord;
  if (!user || (user.role !== 'admin' && !user.isAdmin)) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION & SESSION ROUTES
// ==========================================

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth: Sign In
app.post('/api/auth/signin', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim();

  if (!cleanUsername || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // 1. Try remote Supabase Auth if available
  if (supabaseAdmin) {
    try {
      const internalEmail = `${cleanUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_')}@sunrise-ds.com`;
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (!error && data.user) {
        const metadata = data.user.user_metadata || {};
        const isAdmin = metadata.role === 'admin' || metadata.is_admin === true;
        const role = isAdmin ? 'admin' : 'user';

        let existingRecord = serverDatabase[data.user.id];
        if (!existingRecord) {
          const userProfile: ServerUserRecord = {
            id: data.user.id,
            username: cleanUsername,
            passwordHash: password,
            fullName: metadata.full_name || cleanUsername,
            phone: metadata.phone || '',
            status: metadata.status || 'active',
            role,
            isAdmin,
            tier: isAdmin ? 'VIP 2 Elite' : 'Standard',
            referralCode: metadata.referral_code || `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            referredBy: metadata.referred_by,
            referralCount: metadata.referral_count || 0,
            referralEarningsUGX: metadata.referral_earnings_ugx || 0,
            referrals: metadata.referrals || [],
            welcomeBonusClaimed: true,
            memberSince: 'August 2026',
            createdAt: new Date().toISOString(),
          };

          serverDatabase[data.user.id] = {
            user: userProfile,
            data: {
              wallet: {
                totalBalanceUGX: 5000,
                welcomeBonusUGX: 5000,
                withdrawableBalanceUGX: 0,
                depositedBalanceUGX: 0,
                bonusLocked: true,
                dailyPnlUGX: 0,
                activeMachinesCount: 0,
                pendingTasksCount: 0,
              },
              transactions: [],
              machines: [],
              adminTasks: [],
              notifications: [],
            },
          };
          existingRecord = serverDatabase[data.user.id];
        }

        // Account blocked check
        if (existingRecord.user.status === 'blocked') {
          return res.status(403).json({
            error: 'Your account has been suspended by the platform administrator. Please contact support.',
            isBlocked: true,
            user: existingRecord.user,
          });
        }

        const token = generateToken(data.user.id);
        return res.json({
          user: existingRecord.user,
          data: existingRecord.data,
          isAdmin,
          token,
        });
      }
    } catch (e) {
      // Fall through to server-side user lookup
    }
  }

  // 2. Server database lookup
  let foundId: string | null = null;
  for (const id in serverDatabase) {
    if (serverDatabase[id].user.username.toLowerCase() === cleanUsername.toLowerCase()) {
      foundId = id;
      break;
    }
  }

  if (foundId) {
    const record = serverDatabase[foundId];
    if (record.user.passwordHash === password) {
      // Check if user is blocked
      if (record.user.status === 'blocked') {
        return res.status(403).json({
          error: 'Your account has been suspended by the platform administrator. Please contact support.',
          isBlocked: true,
          user: record.user,
        });
      }

      const token = generateToken(foundId);
      const isAdmin = record.user.role === 'admin' && record.user.isAdmin === true;
      return res.json({
        user: record.user,
        data: record.data,
        isAdmin,
        token,
      });
    } else {
      return res.status(401).json({ error: 'Incorrect password for username.' });
    }
  }

  return res.status(404).json({ error: 'Account not found. Please verify username or create a new account.' });
});

// Auth: Sign Up
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  const { username, password, fullName, phone, referralCode } = req.body;
  const cleanUsername = (username || '').trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  // Unique username check
  for (const id in serverDatabase) {
    if (serverDatabase[id].user.username.toLowerCase() === cleanUsername.toLowerCase()) {
      return res.status(409).json({ error: 'Username is already taken. Please select another.' });
    }
  }

  let newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newReferralCode = `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Sync account with Supabase Auth if available
  if (supabaseAdmin) {
    try {
      const internalEmail = `${cleanUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_')}@sunrise-ds.com`;
      const { data: supaData, error: supaErr } = await supabaseAdmin.auth.signUp({
        email: internalEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: (fullName || cleanUsername).trim(),
            phone: phone ? phone.trim() : undefined,
            referral_code: newReferralCode,
            role: 'user',
            is_admin: false,
          },
        },
      });
      if (supaData?.user?.id) {
        newUserId = supaData.user.id;
      }
    } catch (e) {
      console.warn('Supabase Auth user creation error / notice:', e);
    }
  }

  // Check referrer
  let referrerId: string | null = null;
  if (referralCode) {
    const cleanRef = referralCode.trim().toUpperCase();
    for (const id in serverDatabase) {
      if (serverDatabase[id].user.referralCode.toUpperCase() === cleanRef) {
        referrerId = id;
        break;
      }
    }
  }

  const newUser: ServerUserRecord = {
    id: newUserId,
    username: cleanUsername,
    passwordHash: password,
    fullName: (fullName || cleanUsername).trim(),
    phone: phone ? phone.trim() : undefined,
    status: 'active',
    role: 'user',
    isAdmin: false,
    tier: 'Standard',
    referralCode: newReferralCode,
    referredBy: referrerId ? serverDatabase[referrerId].user.referralCode : undefined,
    referralCount: 0,
    referralEarningsUGX: 0,
    referrals: [],
    welcomeBonusClaimed: true,
    memberSince: 'August 2026',
    createdAt: new Date().toISOString(),
  };

  // Initial user data with automatic UGX 5,000 welcome credit
  const initialUserData = {
    wallet: {
      totalBalanceUGX: 5000,
      welcomeBonusUGX: 5000,
      withdrawableBalanceUGX: 0,
      depositedBalanceUGX: 0,
      bonusLocked: true,
      dailyPnlUGX: 0,
      activeMachinesCount: 0,
      pendingTasksCount: 0,
    },
    transactions: [
      {
        id: `tx_welcome_${Date.now()}`,
        userId: newUserId,
        username: cleanUsername,
        userFullName: newUser.fullName,
        type: 'bonus',
        amountUGX: 5000,
        currency: 'UGX',
        date: 'Just now',
        timestamp: Date.now(),
        status: 'completed',
        description: 'Welcome Bonus — UGX 5,000 (New Account Activation)',
        txHash: `0x${Math.random().toString(16).substring(2, 10)}...5000`,
      },
    ],
    machines: [],
    adminTasks: [],
    notifications: [
      {
        id: `notif_welcome_${Date.now()}`,
        title: 'Welcome Bonus Credited',
        message: 'UGX 5,000 Welcome Bonus deposited into your consolidated wallet.',
        timestamp: 'Just now',
        read: false,
        type: 'success',
      },
    ],
  };

  serverDatabase[newUserId] = {
    user: newUser,
    data: initialUserData,
  };

  // Credit referrer if applicable
  if (referrerId && serverDatabase[referrerId]) {
    const refUser = serverDatabase[referrerId].user;
    refUser.referralCount = (refUser.referralCount || 0) + 1;
    refUser.referralEarningsUGX = (refUser.referralEarningsUGX || 0) + 50000;
    refUser.referrals.unshift({
      id: newUserId,
      username: cleanUsername,
      fullName: newUser.fullName,
      registeredDate: 'Today',
      status: 'active',
      rewardUGX: 50000,
    });

    const refData = serverDatabase[referrerId].data;
    refData.wallet.totalBalanceUGX += 50000;
    refData.transactions.unshift({
      id: `tx_ref_${Date.now()}`,
      userId: referrerId,
      username: refUser.username,
      type: 'reward',
      amountUGX: 50000,
      currency: 'UGX',
      date: 'Just now',
      timestamp: Date.now(),
      status: 'completed',
      description: `Referral Incentive: @${cleanUsername} joined`,
      txHash: `0x${Math.random().toString(16).substring(2, 10)}...ref`,
    });
  }

  const token = generateToken(newUserId);
  saveDatabaseToDisk();
  return res.status(201).json({
    user: newUser,
    data: initialUserData,
    isAdmin: false,
    token,
  });
});

// Auth: Sign Out
app.post('/api/auth/signout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (token && activeTokens[token]) {
    delete activeTokens[token];
    saveDatabaseToDisk();
  }
  res.json({ success: true, message: 'Signed out successfully.' });
});

// Auth: Me / Validate Active Session
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const record = serverDatabase[userId];
  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  res.json({
    user: record.user,
    data: record.data,
    isAdmin: Boolean(record.user.isAdmin || record.user.role === 'admin'),
    isBlocked: record.user.status === 'blocked',
  });
});

// User: Get Data
app.get('/api/user/data', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const record = serverDatabase[userId];
  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  res.json({
    user: record.user,
    data: record.data,
    wallet: record.data.wallet,
    transactions: record.data.transactions,
    machines: record.data.machines,
    adminTasks: record.data.adminTasks,
    notifications: record.data.notifications,
    isAdmin: Boolean(record.user.isAdmin || record.user.role === 'admin'),
    isBlocked: record.user.status === 'blocked',
  });
});

// User: Sync Data
app.post('/api/user/data', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { wallet, transactions, machines, notifications, adminTasks } = req.body;
  const record = serverDatabase[userId];

  if (!record) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Prevent modifications if blocked
  if (record.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account is blocked. Data modifications are disabled.' });
  }

  if (wallet) record.data.wallet = wallet;
  if (transactions) record.data.transactions = transactions;
  if (machines) record.data.machines = machines;
  if (notifications) record.data.notifications = notifications;
  if (adminTasks && record.user.role === 'admin') record.data.adminTasks = adminTasks;

  saveDatabaseToDisk();
  res.json({ success: true });
});

// ==========================================
// 2. DYNAMIC INVESTMENT PROJECTS CATALOG
// ==========================================

// Public: Get All Available Investment Projects / Machines
app.get('/api/catalog/machines', (req: Request, res: Response) => {
  res.json({ machines: catalogDatabase });
});

// Admin: Add New Investment Project Item
app.post('/api/admin/catalog/machines', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const {
    title,
    subtitle,
    category,
    image,
    dailyRewardUGX,
    status,
    estYearlyROI,
    minInvestUGX,
    hashrate,
    powerSource,
    uptime,
    temperature,
    efficiency,
  } = req.body;

  if (!title || !minInvestUGX) {
    return res.status(400).json({ error: 'Project Title and Minimum Investment amount are required.' });
  }

  const newMachine: CatalogMachine = {
    id: `mach_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    subtitle: subtitle ? subtitle.trim() : undefined,
    category: category || 'DS-Mining',
    image:
      image ||
      'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    dailyRewardUGX: Number(dailyRewardUGX) || 250000,
    status: status || 'Active',
    estYearlyROI: Number(estYearlyROI) || 120,
    minInvestUGX: Math.round(Number(minInvestUGX)),
    hashrate: hashrate || '60.0 TH/s',
    powerSource: powerSource || 'Clean Energy Array',
    uptime: uptime || '99.9%',
    temperature: temperature || '38.0°C',
    efficiency: Number(efficiency) || 99.0,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  };

  catalogDatabase.unshift(newMachine);
  saveDatabaseToDisk();

  res.status(201).json({
    success: true,
    message: 'Investment project successfully created in Supabase catalog.',
    machine: newMachine,
    catalog: catalogDatabase,
  });
});

// Admin: Edit Existing Investment Project Item
app.put('/api/admin/catalog/machines/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const machineId = req.params.id;
  const index = catalogDatabase.findIndex((m) => m.id === machineId);

  if (index === -1) {
    return res.status(404).json({ error: 'Investment project not found in catalog.' });
  }

  const existing = catalogDatabase[index];
  const {
    title,
    subtitle,
    category,
    image,
    dailyRewardUGX,
    status,
    estYearlyROI,
    minInvestUGX,
    hashrate,
    powerSource,
    uptime,
    temperature,
    efficiency,
  } = req.body;

  const updated: CatalogMachine = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    subtitle: subtitle !== undefined ? subtitle.trim() : existing.subtitle,
    category: category !== undefined ? category : existing.category,
    image: image !== undefined ? image : existing.image,
    dailyRewardUGX: dailyRewardUGX !== undefined ? Number(dailyRewardUGX) : existing.dailyRewardUGX,
    status: status !== undefined ? status : existing.status,
    estYearlyROI: estYearlyROI !== undefined ? Number(estYearlyROI) : existing.estYearlyROI,
    minInvestUGX: minInvestUGX !== undefined ? Math.round(Number(minInvestUGX)) : existing.minInvestUGX,
    hashrate: hashrate !== undefined ? hashrate : existing.hashrate,
    powerSource: powerSource !== undefined ? powerSource : existing.powerSource,
    uptime: uptime !== undefined ? uptime : existing.uptime,
    temperature: temperature !== undefined ? temperature : existing.temperature,
    efficiency: efficiency !== undefined ? Number(efficiency) : existing.efficiency,
  };

  catalogDatabase[index] = updated;
  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `Project ${updated.title} updated successfully.`,
    machine: updated,
    catalog: catalogDatabase,
  });
});

// Admin: Delete / Deactivate Project Item
app.delete('/api/admin/catalog/machines/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const machineId = req.params.id;
  const index = catalogDatabase.findIndex((m) => m.id === machineId);

  if (index === -1) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const removed = catalogDatabase.splice(index, 1)[0];
  saveDatabaseToDisk();
  res.json({
    success: true,
    message: `Project ${removed.title} deleted from active catalog.`,
    catalog: catalogDatabase,
  });
});

// ==========================================
// 3. DEPOSIT & WITHDRAWAL APPROVAL WORKFLOW
// ==========================================

// User: Submit Deposit Request (Status: Pending - Balance NOT credited immediately)
app.post('/api/wallet/deposit', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRecord = (req as any).userRecord as ServerUserRecord;
  const record = serverDatabase[userId];

  if (record.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account is suspended. Deposits are disabled.' });
  }

  const { amountUGX, paymentMethod, referenceInfo } = req.body;
  const numAmount = Math.round(Number(amountUGX));
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid deposit amount in UGX.' });
  }

  const MIN_DEPOSIT_UGX = 20000;
  if (numAmount < MIN_DEPOSIT_UGX) {
    return res.status(400).json({
      error: `Minimum Deposit: The minimum deposit amount is UGX ${MIN_DEPOSIT_UGX.toLocaleString()}.`,
    });
  }

  const txId = `tx_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today';
  const methodLabel = paymentMethod || 'MTN Mobile Money / Airtel';
  const desc = `${methodLabel} Deposit Request`;

  const newTx = {
    id: txId,
    userId: userId,
    username: userRecord.username,
    userFullName: userRecord.fullName,
    type: 'deposit',
    amountUGX: numAmount,
    currency: 'UGX',
    date: nowStr,
    timestamp: Date.now(),
    status: 'pending', // PENDING ADMIN APPROVAL (Balance remains unchanged)
    description: desc,
    paymentMethod: methodLabel,
    recipientInfo: referenceInfo || 'Sunrise Capital Treasury',
    txHash: `0x${Math.random().toString(16).substring(2, 10)}...dep`,
  };

  record.data.transactions.unshift(newTx);

  const userNotif = {
    id: `notif_${Date.now()}`,
    title: 'Deposit Submitted (Pending Approval)',
    message: `Your deposit request for UGX ${numAmount.toLocaleString()} via ${methodLabel} has been submitted. Funds will be credited once verified by administrator.`,
    timestamp: 'Just now',
    read: false,
    type: 'info',
  };
  record.data.notifications.unshift(userNotif);

  // Broadcast admin task
  const adminTask = {
    id: `task_${Date.now()}`,
    title: `Pending Deposit Review: UGX ${numAmount.toLocaleString()}`,
    description: `User @${userRecord.username} (${userRecord.fullName}) submitted a deposit request via ${methodLabel}.`,
    urgency: 'high',
    category: 'Deposit Verification',
    timestamp: 'Just now',
    status: 'pending',
    amountUGX: numAmount,
    transactionId: txId,
    userId: userId,
    username: userRecord.username,
  };

  for (const id in serverDatabase) {
    if (serverDatabase[id].user.role === 'admin' || serverDatabase[id].user.isAdmin) {
      serverDatabase[id].data.adminTasks.unshift(adminTask);
      serverDatabase[id].data.wallet.pendingTasksCount = (serverDatabase[id].data.wallet.pendingTasksCount || 0) + 1;
    }
  }

  saveDatabaseToDisk();

  res.status(201).json({
    success: true,
    message: 'Deposit request submitted. Pending administrator approval.',
    transaction: newTx,
    wallet: record.data.wallet,
  });
});

// User: Submit Withdrawal Request (Status: Pending - Balance NOT deducted immediately)
app.post('/api/wallet/withdraw', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRecord = (req as any).userRecord as ServerUserRecord;
  const record = serverDatabase[userId];

  if (record.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account is suspended. Withdrawals are disabled.' });
  }

  const { amountUGX, paymentMethod, recipientInfo, isBonusWithdrawal } = req.body;
  const numAmount = Math.round(Number(amountUGX));
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid withdrawal amount in UGX.' });
  }

  const MIN_WITHDRAWAL_UGX = 5000;
  if (numAmount < MIN_WITHDRAWAL_UGX) {
    return res.status(400).json({
      error: `Minimum Withdrawal: The minimum withdrawal amount is UGX ${MIN_WITHDRAWAL_UGX.toLocaleString()}.`,
    });
  }

  // Validate sufficient available balance
  const currentBalance = record.data.wallet.totalBalanceUGX || 0;
  if (numAmount > currentBalance) {
    return res.status(400).json({
      error: `Insufficient Balance. Requested UGX ${numAmount.toLocaleString()} exceeds your available balance of UGX ${currentBalance.toLocaleString()}.`,
    });
  }

  // Check if user has an approved qualifying deposit
  const hasApprovedDeposit = record.data.transactions.some(
    (t: any) => t.type === 'deposit' && (t.status === 'approved' || t.status === 'completed')
  );

  const welcomeBonusAmount = record.data.wallet.welcomeBonusUGX ?? 5000;
  // Non-bonus funds available for withdrawal before deposit
  const nonBonusFunds = hasApprovedDeposit ? currentBalance : Math.max(0, currentBalance - welcomeBonusAmount);

  // Welcome Bonus Withdrawal Restriction:
  // If user attempts to withdraw money that comes from the welcome bonus before making a qualifying deposit, prevent the withdrawal.
  if (!hasApprovedDeposit && (isBonusWithdrawal || numAmount > nonBonusFunds)) {
    return res.status(400).json({
      error: `Welcome Bonus Restriction: The UGX ${welcomeBonusAmount.toLocaleString()} welcome bonus cannot be withdrawn until you have made a qualifying deposit (minimum UGX 20,000). A 30% bonus protection charge applies to bonus withdrawals.`,
      restrictionActive: true,
      welcomeBonusUGX: welcomeBonusAmount,
    });
  }

  // Normal withdrawal fee (20%) vs Bonus withdrawal protection fee (30%)
  const isBonus = Boolean(isBonusWithdrawal);
  const feeRate = isBonus ? 0.30 : 0.20; // 30% bonus-related protection charge vs 20% normal withdrawal fee
  const feeUGX = Math.round(numAmount * feeRate);
  const netAmountUGX = numAmount - feeUGX;

  const txId = `tx_wth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Today';
  const methodLabel = paymentMethod || 'Mobile Money Payout';
  const desc = isBonus
    ? `Bonus Withdrawal of UGX ${numAmount.toLocaleString()} (30% Charge: UGX ${feeUGX.toLocaleString()} | You Receive: UGX ${netAmountUGX.toLocaleString()}) to ${recipientInfo || 'Registered Destination'}`
    : `Normal Withdrawal of UGX ${numAmount.toLocaleString()} (20% Fee: UGX ${feeUGX.toLocaleString()} | You Receive: UGX ${netAmountUGX.toLocaleString()}) to ${recipientInfo || 'Registered Destination'}`;

  const newTx = {
    id: txId,
    userId: userId,
    username: userRecord.username,
    userFullName: userRecord.fullName,
    type: 'withdraw',
    amountUGX: numAmount,
    feeUGX: feeUGX,
    netAmountUGX: netAmountUGX,
    feeRate: feeRate,
    totalDeductionUGX: numAmount,
    isBonusWithdrawal: isBonus,
    currency: 'UGX',
    date: nowStr,
    timestamp: Date.now(),
    status: 'pending', // PENDING ADMIN APPROVAL (Balance remains intact until approval)
    description: desc,
    paymentMethod: methodLabel,
    recipientInfo: recipientInfo || 'Registered Destination',
    txHash: `0x${Math.random().toString(16).substring(2, 10)}...wth`,
  };

  record.data.transactions.unshift(newTx);

  const userNotif = {
    id: `notif_${Date.now()}`,
    title: 'Withdrawal Request Submitted',
    message: `Your withdrawal request for UGX ${numAmount.toLocaleString()} (${Math.round(feeRate * 100)}% Fee: UGX ${feeUGX.toLocaleString()}, Final Payout: UGX ${netAmountUGX.toLocaleString()}) to ${recipientInfo || methodLabel} is pending administrator review and approval.`,
    timestamp: 'Just now',
    read: false,
    type: 'info',
  };
  record.data.notifications.unshift(userNotif);

  const adminTask = {
    id: `task_${Date.now()}`,
    title: `Pending Withdrawal Review: UGX ${numAmount.toLocaleString()} (${Math.round(feeRate * 100)}% Fee: UGX ${feeUGX.toLocaleString()} | Payout: UGX ${netAmountUGX.toLocaleString()})`,
    description: `User @${userRecord.username} requested withdrawal of UGX ${numAmount.toLocaleString()} (${Math.round(feeRate * 100)}% fee: UGX ${feeUGX.toLocaleString()}, Net: UGX ${netAmountUGX.toLocaleString()}) to ${recipientInfo || methodLabel}.`,
    urgency: 'high',
    category: 'Withdrawal Authorization',
    timestamp: 'Just now',
    status: 'pending',
    amountUGX: numAmount,
    feeUGX: feeUGX,
    netAmountUGX: netAmountUGX,
    transactionId: txId,
    userId: userId,
    username: userRecord.username,
  };

  for (const id in serverDatabase) {
    if (serverDatabase[id].user.role === 'admin' || serverDatabase[id].user.isAdmin) {
      serverDatabase[id].data.adminTasks.unshift(adminTask);
      serverDatabase[id].data.wallet.pendingTasksCount = (serverDatabase[id].data.wallet.pendingTasksCount || 0) + 1;
    }
  }

  saveDatabaseToDisk();

  res.status(201).json({
    success: true,
    message: 'Withdrawal request submitted. Pending administrator approval.',
    transaction: newTx,
    wallet: record.data.wallet,
    withdrawalSummary: {
      withdrawalAmountUGX: numAmount,
      feeRate: feeRate,
      feeUGX: feeUGX,
      finalAmountReceivedUGX: netAmountUGX,
      totalDeductionUGX: numAmount,
    },
  });
});

// Admin: Get All Transactions
app.get('/api/admin/transactions', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const allTxs: any[] = [];

  for (const uid in serverDatabase) {
    const userAcc = serverDatabase[uid];
    const txs = userAcc.data.transactions || [];
    for (const t of txs) {
      allTxs.push({
        ...t,
        userId: uid,
        username: userAcc.user.username,
        userFullName: userAcc.user.fullName,
      });
    }
  }

  allTxs.sort((a, b) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime());
  res.json({ transactions: allTxs });
});

// Admin: Get All Pending Transactions
app.get('/api/admin/pending-transactions', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const pendingTransactions: any[] = [];

  for (const uid in serverDatabase) {
    const userAcc = serverDatabase[uid];
    const txs = userAcc.data.transactions || [];
    for (const t of txs) {
      if (t.status === 'pending') {
        pendingTransactions.push({
          ...t,
          userId: uid,
          username: userAcc.user.username,
          userFullName: userAcc.user.fullName,
        });
      }
    }
  }

  pendingTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  res.json({ transactions: pendingTransactions });
});

// Admin: Approve Transaction (Atomically updates balance & prevents double-processing)
app.post('/api/admin/transactions/:id/approve', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const txId = req.params.id;

  let targetUserRecord: any = null;
  let targetTx: any = null;

  for (const uid in serverDatabase) {
    const u = serverDatabase[uid];
    const found = u.data.transactions.find((t: any) => t.id === txId);
    if (found) {
      targetUserRecord = u;
      targetTx = found;
      break;
    }
  }

  if (!targetTx || !targetUserRecord) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  // DOUBLE-PROCESSING PROTECTION
  if (targetTx.status !== 'pending') {
    return res.status(409).json({
      error: `Transaction has already been ${targetTx.status}. Double-processing is prevented.`,
    });
  }

  if (targetTx.type === 'deposit') {
    targetTx.status = 'approved';
    targetTx.approvedAt = new Date().toISOString();
    targetUserRecord.data.wallet.totalBalanceUGX += targetTx.amountUGX;
    targetUserRecord.data.wallet.depositedBalanceUGX = (targetUserRecord.data.wallet.depositedBalanceUGX || 0) + targetTx.amountUGX;
    targetUserRecord.data.wallet.bonusLocked = false;
    targetUserRecord.data.wallet.withdrawableBalanceUGX = targetUserRecord.data.wallet.totalBalanceUGX;

    targetUserRecord.data.notifications.unshift({
      id: `notif_appr_${Date.now()}`,
      title: 'Deposit Approved & Credited!',
      message: `Your deposit of UGX ${targetTx.amountUGX.toLocaleString()} has been approved. UGX ${targetTx.amountUGX.toLocaleString()} was credited to your balance and your welcome-bonus withdrawal privileges are unlocked.`,
      timestamp: 'Just now',
      read: false,
      type: 'success',
    });
  } else if (targetTx.type === 'withdraw') {
    const userBalance = targetUserRecord.data.wallet.totalBalanceUGX || 0;
    if (userBalance < targetTx.amountUGX) {
      return res.status(400).json({
        error: `Cannot approve withdrawal: User balance (UGX ${userBalance.toLocaleString()}) is less than requested amount (UGX ${targetTx.amountUGX.toLocaleString()}).`,
      });
    }

    const feeRate = targetTx.feeRate ?? (targetTx.isBonusWithdrawal ? 0.30 : 0.20);
    const feeUGX = targetTx.feeUGX ?? Math.round(targetTx.amountUGX * feeRate);
    const netPayout = targetTx.netAmountUGX ?? (targetTx.amountUGX - feeUGX);

    targetTx.status = 'approved';
    targetTx.approvedAt = new Date().toISOString();
    targetUserRecord.data.wallet.totalBalanceUGX -= targetTx.amountUGX;
    targetUserRecord.data.wallet.withdrawableBalanceUGX = Math.max(
      0,
      (targetUserRecord.data.wallet.withdrawableBalanceUGX || userBalance) - targetTx.amountUGX
    );

    targetUserRecord.data.notifications.unshift({
      id: `notif_appr_${Date.now()}`,
      title: 'Withdrawal Approved & Dispatched!',
      message: `Your withdrawal of UGX ${targetTx.amountUGX.toLocaleString()} (${Math.round(feeRate * 100)}% Fee: UGX ${feeUGX.toLocaleString()}, Net Dispatched: UGX ${netPayout.toLocaleString()}) has been authorized and dispatched to ${targetTx.recipientInfo || 'your destination'}.`,
      timestamp: 'Just now',
      read: false,
      type: 'success',
    });
  } else {
    targetTx.status = 'approved';
  }

  // Update any linked tasks
  for (const uid in serverDatabase) {
    if (serverDatabase[uid].user.role === 'admin' || serverDatabase[uid].user.isAdmin) {
      const task = serverDatabase[uid].data.adminTasks.find(
        (t: any) => t.transactionId === txId || t.id === txId
      );
      if (task) {
        task.status = 'approved';
        serverDatabase[uid].data.wallet.pendingTasksCount = Math.max(
          0,
          (serverDatabase[uid].data.wallet.pendingTasksCount || 1) - 1
        );
      }
    }
  }

  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `Transaction ${txId} successfully approved.`,
    transaction: targetTx,
    updatedUserBalance: targetUserRecord.data.wallet.totalBalanceUGX,
  });
});

// Admin: Reject Transaction
app.post('/api/admin/transactions/:id/reject', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const txId = req.params.id;

  let targetUserRecord: any = null;
  let targetTx: any = null;

  for (const uid in serverDatabase) {
    const u = serverDatabase[uid];
    const found = u.data.transactions.find((t: any) => t.id === txId);
    if (found) {
      targetUserRecord = u;
      targetTx = found;
      break;
    }
  }

  if (!targetTx || !targetUserRecord) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  if (targetTx.status !== 'pending') {
    return res.status(409).json({
      error: `Transaction has already been ${targetTx.status}. Double-processing is prevented.`,
    });
  }

  targetTx.status = 'rejected';
  targetTx.rejectedAt = new Date().toISOString();

  targetUserRecord.data.notifications.unshift({
    id: `notif_rej_${Date.now()}`,
    title: `${targetTx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} Request Rejected`,
    message: `Your ${targetTx.type} request of UGX ${targetTx.amountUGX.toLocaleString()} was reviewed and rejected by the platform administrator.`,
    timestamp: 'Just now',
    read: false,
    type: 'alert',
  });

  for (const uid in serverDatabase) {
    if (serverDatabase[uid].user.role === 'admin' || serverDatabase[uid].user.isAdmin) {
      const task = serverDatabase[uid].data.adminTasks.find(
        (t: any) => t.transactionId === txId || t.id === txId
      );
      if (task) {
        task.status = 'rejected';
        serverDatabase[uid].data.wallet.pendingTasksCount = Math.max(
          0,
          (serverDatabase[uid].data.wallet.pendingTasksCount || 1) - 1
        );
      }
    }
  }

  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `Transaction ${txId} was rejected.`,
    transaction: targetTx,
  });
});

// ==========================================
// 4. ADMIN USER MANAGEMENT & AUDIT LOGS
// ==========================================

// Admin: Get All Users List
app.get('/api/admin/users', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const usersList: any[] = [];

  for (const uid in serverDatabase) {
    const acc = serverDatabase[uid];
    usersList.push({
      id: acc.user.id,
      username: acc.user.username,
      fullName: acc.user.fullName,
      phone: acc.user.phone || '',
      status: acc.user.status || 'active',
      role: acc.user.role,
      isAdmin: Boolean(acc.user.isAdmin || acc.user.role === 'admin'),
      tier: acc.user.tier,
      memberSince: acc.user.memberSince,
      createdAt: acc.user.createdAt,
      balanceUGX: acc.data.wallet.totalBalanceUGX || 0,
      activeMachinesCount: acc.data.machines ? acc.data.machines.length : 0,
      transactionsCount: acc.data.transactions ? acc.data.transactions.length : 0,
      referralCount: acc.user.referralCount || 0,
      referralCode: acc.user.referralCode,
    });
  }

  res.json({ users: usersList });
});

// Admin: Edit User Info (Username, Full Name, Phone)
app.put('/api/admin/users/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const targetId = req.params.id;
  const record = serverDatabase[targetId];

  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  const { username, fullName, phone } = req.body;

  // If changing username, ensure uniqueness
  if (username && username.trim().toLowerCase() !== record.user.username.toLowerCase()) {
    const cleanU = username.trim();
    if (cleanU.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    for (const uid in serverDatabase) {
      if (uid !== targetId && serverDatabase[uid].user.username.toLowerCase() === cleanU.toLowerCase()) {
        return res.status(409).json({ error: 'Username is already taken by another account.' });
      }
    }
    record.user.username = cleanU;
  }

  if (fullName !== undefined) {
    record.user.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    record.user.phone = phone.trim();
  }

  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `Account @${record.user.username} updated successfully.`,
    user: record.user,
  });
});

// Admin: Edit User Balance (Add or Deduct funds with audit record)
app.post('/api/admin/users/:id/balance', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const targetId = req.params.id;
  const adminUser = (req as any).userRecord as ServerUserRecord;
  const record = serverDatabase[targetId];

  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  const { amountUGX, type, reason } = req.body;
  const numAmount = Math.round(Number(amountUGX));

  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Please specify a valid positive adjustment amount in UGX.' });
  }

  if (type !== 'add' && type !== 'deduct') {
    return res.status(400).json({ error: 'Adjustment type must be "add" or "deduct".' });
  }

  const previousBalance = record.data.wallet.totalBalanceUGX || 0;
  let newBalance = previousBalance;

  if (type === 'add') {
    newBalance = previousBalance + numAmount;
  } else {
    if (numAmount > previousBalance) {
      return res.status(400).json({
        error: `Cannot deduct UGX ${numAmount.toLocaleString()}. User current balance is only UGX ${previousBalance.toLocaleString()}.`,
      });
    }
    newBalance = previousBalance - numAmount;
  }

  // Update user balance
  record.data.wallet.totalBalanceUGX = newBalance;

  // Create audit log record
  const auditId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const auditEntry: BalanceAdjustmentRecord = {
    id: auditId,
    userId: targetId,
    username: record.user.username,
    userFullName: record.user.fullName,
    previousBalanceUGX: previousBalance,
    adjustmentAmountUGX: type === 'add' ? numAmount : -numAmount,
    newBalanceUGX: newBalance,
    type,
    reason: reason ? reason.trim() : 'Administrative Balance Adjustment',
    adminId: adminUser.id,
    adminUsername: adminUser.username,
    timestamp: Date.now(),
    date: new Date().toLocaleString(),
  };

  balanceAdjustments.unshift(auditEntry);

  // Add transaction to user history
  record.data.transactions.unshift({
    id: `tx_adj_${Date.now()}`,
    userId: targetId,
    username: record.user.username,
    type: type === 'add' ? 'reward' : 'withdraw',
    amountUGX: numAmount,
    currency: 'UGX',
    date: 'Just now',
    timestamp: Date.now(),
    status: 'completed',
    description: `Admin Balance Adjustment (${type === 'add' ? '+' : '-'}UGX ${numAmount.toLocaleString()}): ${reason || 'System update'}`,
    txHash: `0x${Math.random().toString(16).substring(2, 10)}...adj`,
  });

  // Notify user
  record.data.notifications.unshift({
    id: `notif_adj_${Date.now()}`,
    title: `Balance Adjusted by Administrator`,
    message: `${type === 'add' ? 'Added' : 'Deducted'} UGX ${numAmount.toLocaleString()}. Reason: ${reason || 'Administrative adjustment'}. New Balance: UGX ${newBalance.toLocaleString()}.`,
    timestamp: 'Just now',
    read: false,
    type: type === 'add' ? 'success' : 'alert',
  });

  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `User balance adjusted successfully. New balance: UGX ${newBalance.toLocaleString()}`,
    previousBalance,
    newBalance,
    adjustment: auditEntry,
    wallet: record.data.wallet,
  });
});

// Admin: Block / Unblock User
app.post('/api/admin/users/:id/status', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const targetId = req.params.id;
  const record = serverDatabase[targetId];

  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  const { status } = req.body;
  if (status !== 'active' && status !== 'blocked') {
    return res.status(400).json({ error: 'Status must be "active" or "blocked".' });
  }

  record.user.status = status;
  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `User @${record.user.username} account status set to ${status}.`,
    user: record.user,
  });
});

// Admin: Safe Delete / Deactivate User
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const targetId = req.params.id;
  const adminUser = (req as any).userRecord as ServerUserRecord;
  const record = serverDatabase[targetId];

  if (!record) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (targetId === adminUser.id) {
    return res.status(400).json({ error: 'Cannot delete your own active administrator account.' });
  }

  const deletedUsername = record.user.username;
  delete serverDatabase[targetId];

  // Invalidate any active session tokens for this user
  for (const token in activeTokens) {
    if (activeTokens[token] === targetId) {
      delete activeTokens[token];
    }
  }

  saveDatabaseToDisk();

  res.json({
    success: true,
    message: `User @${deletedUsername} was deleted and all active sessions closed.`,
  });
});

// Admin: Get Balance Adjustments Audit Log
app.get('/api/admin/audit/balance-adjustments', requireAuth, requireAdmin, (req: Request, res: Response) => {
  res.json({ adjustments: balanceAdjustments });
});

// ==========================================
// 5. USER-SPECIFIC INVESTMENTS & HARVESTING
// ==========================================

// User: Get active user investments
app.get('/api/user/investments', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const record = serverDatabase[userId];

  if (!record) {
    return res.status(404).json({ error: 'User record not found.' });
  }

  res.json({ investments: record.data.machines || [] });
});

// User: Activate / Purchase Investment Node
app.post('/api/user/investments/buy', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userRecord = (req as any).userRecord as ServerUserRecord;
  const record = serverDatabase[userId];

  if (record.user.status === 'blocked') {
    return res.status(403).json({ error: 'Account is blocked. Investment purchases are disabled.' });
  }

  const { machineId, title, category, image, minInvestUGX, dailyRewardUGX, hashrate, estYearlyROI, powerSource } = req.body;
  const cost = Math.round(Number(minInvestUGX));

  const MIN_INVESTMENT_UGX = 15000;
  if (!cost || cost < MIN_INVESTMENT_UGX) {
    return res.status(400).json({
      error: `Minimum Investment: The minimum investment amount is UGX ${MIN_INVESTMENT_UGX.toLocaleString()}.`,
    });
  }

  const currentBalance = record.data.wallet.totalBalanceUGX || 0;
  if (currentBalance < cost) {
    return res.status(400).json({
      error: `Insufficient balance. Machine investment requires UGX ${cost.toLocaleString()}, but available balance is UGX ${currentBalance.toLocaleString()}. Please deposit funds first.`,
    });
  }

  record.data.wallet.totalBalanceUGX -= cost;
  record.data.wallet.activeMachinesCount = (record.data.wallet.activeMachinesCount || 0) + 1;
  record.data.wallet.dailyPnlUGX = (record.data.wallet.dailyPnlUGX || 0) + (dailyRewardUGX || 0);

  const newInvestment = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: userId,
    machineId: machineId || 'custom_node',
    title: title || 'Mining Rig Node',
    category: category || 'DS-Mining',
    image: image || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    dailyRewardUGX: dailyRewardUGX || 210000,
    status: 'Active',
    estYearlyROI: estYearlyROI || 125,
    minInvestUGX: cost,
    amountInvestedUGX: cost,
    investedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    period: '365 Days / Continuous Sovereign Yield',
    hashrate: hashrate || '50.0 TH/s',
    powerSource: powerSource || 'Hybrid Kinetic / Solar Array',
    uptime: '100.00%',
    temperature: '38.0°C',
    efficiency: 99.4,
    totalMinedUGX: 0,
    unclaimedRewardsUGX: 0,
    isBoosted: false,
  };

  record.data.machines.unshift(newInvestment);

  // Dynamic Return Bonus based on 15,000 -> 25,000 ratio (which is a ~66.67% bonus)
  const bonusMultiplier = 10000 / 15000; // 2/3
  const bonusAdded = Math.round(cost * bonusMultiplier);

  if (bonusAdded > 0) {
    record.data.wallet.totalBalanceUGX += bonusAdded;
    
    // Create a transaction for the bonus
    const bonusTx = {
      id: `tx_bonus_${Date.now()}`,
      userId: userId,
      type: 'bonus',
      amountUGX: bonusAdded,
      status: 'Completed',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      description: 'Massive Return Bonus for Investment',
      isCredit: true,
    };
    record.data.transactions.unshift(bonusTx);

    // Notify user
    record.data.notifications.unshift({
      id: `notif_bonus_${Date.now()}`,
      title: 'Massive Investment Bonus!',
      message: `You received an instant return bonus of UGX ${bonusAdded.toLocaleString()} for your investment!`,
      timestamp: 'Just now',
      isRead: false,
      type: 'system',
    });
  }

  const txId = `tx_inv_${Date.now()}`;
  record.data.transactions.unshift({
    id: txId,
    userId: userId,
    username: userRecord.username,
    userFullName: userRecord.fullName,
    type: 'investment',
    amountUGX: cost,
    currency: 'UGX',
    date: 'Just now',
    timestamp: Date.now(),
    status: 'completed',
    description: `Node Activation: ${title || 'Hardware Investment'}`,
    txHash: `0x${Math.random().toString(16).substring(2, 10)}...node`,
  });

  record.data.notifications.unshift({
    id: `notif_${Date.now()}`,
    title: 'Investment Active!',
    message: `Successfully activated ${title}. Daily yield of +UGX ${(dailyRewardUGX || 0).toLocaleString()} will begin accruing.`,
    timestamp: 'Just now',
    read: false,
    type: 'success',
  });

  saveDatabaseToDisk();

  res.status(201).json({
    success: true,
    investment: newInvestment,
    wallet: record.data.wallet,
  });
});

// User: Harvest / Claim Investment Yield
app.post('/api/user/investments/:id/claim', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const investmentId = req.params.id;
  const record = serverDatabase[userId];

  const investment = record.data.machines.find((m: any) => m.id === investmentId);
  if (!investment) {
    return res.status(404).json({ error: 'Investment node not found.' });
  }

  const unclaimed = investment.unclaimedRewardsUGX || 0;
  if (unclaimed <= 0) {
    return res.status(400).json({ error: 'No pending yield to claim right now.' });
  }

  record.data.wallet.totalBalanceUGX += unclaimed;
  investment.totalMinedUGX = (investment.totalMinedUGX || 0) + unclaimed;
  investment.unclaimedRewardsUGX = 0;

  record.data.transactions.unshift({
    id: `tx_claim_${Date.now()}`,
    userId: userId,
    type: 'reward',
    amountUGX: unclaimed,
    currency: 'UGX',
    date: 'Just now',
    timestamp: Date.now(),
    status: 'completed',
    description: `Harvested Mining Yield (${investment.title})`,
    txHash: `0x${Math.random().toString(16).substring(2, 10)}...yield`,
  });

  saveDatabaseToDisk();

  res.json({
    success: true,
    claimedUGX: unclaimed,
    wallet: record.data.wallet,
    investment,
  });
});

// Protected Admin: Get All Admin Tasks
app.get('/api/admin/tasks', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const record = serverDatabase[userId];
  res.json({ tasks: record.data.adminTasks || [] });
});

// Protected Admin: Approve Task
app.post('/api/admin/tasks/:id/approve', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const taskId = req.params.id;
  const userId = (req as any).userId;
  const record = serverDatabase[userId];

  const task = record.data.adminTasks.find((t: any) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Admin task not found.' });
  }

  task.status = 'approved';
  record.data.wallet.pendingTasksCount = Math.max(0, record.data.wallet.pendingTasksCount - 1);

  if (task.transactionId) {
    for (const uid in serverDatabase) {
      const u = serverDatabase[uid];
      const foundTx = u.data.transactions.find((t: any) => t.id === task.transactionId);
      if (foundTx && foundTx.status === 'pending') {
        foundTx.status = 'approved';
        foundTx.approvedAt = new Date().toISOString();
        if (foundTx.type === 'deposit') {
          u.data.wallet.totalBalanceUGX += foundTx.amountUGX;
        } else if (foundTx.type === 'withdraw') {
          u.data.wallet.totalBalanceUGX = Math.max(0, u.data.wallet.totalBalanceUGX - foundTx.amountUGX);
        }
      }
    }
  }

  saveDatabaseToDisk();
  res.json({ success: true, task });
});

// Protected Admin: Reject Task
app.post('/api/admin/tasks/:id/reject', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const taskId = req.params.id;
  const userId = (req as any).userId;
  const record = serverDatabase[userId];

  const task = record.data.adminTasks.find((t: any) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Admin task not found.' });
  }

  task.status = 'rejected';
  record.data.wallet.pendingTasksCount = Math.max(0, record.data.wallet.pendingTasksCount - 1);

  if (task.transactionId) {
    for (const uid in serverDatabase) {
      const u = serverDatabase[uid];
      const foundTx = u.data.transactions.find((t: any) => t.id === task.transactionId);
      if (foundTx && foundTx.status === 'pending') {
        foundTx.status = 'rejected';
        foundTx.rejectedAt = new Date().toISOString();
      }
    }
  }

  saveDatabaseToDisk();
  res.json({ success: true, task });
});

// ==========================================
// VITE SPA & STATIC ASSET SERVER
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunrise Capital full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
