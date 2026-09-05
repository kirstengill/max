/**
 * Standard REST API Client for SolNova Capital — Solar Mining & Investment
 * Integrates with Supabase Cloud & Server Backend as Single Source of Truth
 * NO localStorage or sessionStorage is used. Sessions are maintained in-memory & cloud.
 */

import {
  UserProfile,
  WalletState,
  Transaction,
  Machine,
  AdminTask,
  AppNotification,
  AdminUserSummary,
  BalanceAdjustment,
  UserAccountData,
} from '../types';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private token: string | null = null;
  private userId: string | null = null;

  constructor() {
    // Session values are maintained strictly in memory
    this.token = null;
    this.userId = null;
  }

  public setSession(token: string | null, userId: string | null) {
    this.token = token;
    this.userId = userId;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getUserId(): string | null {
    return this.userId;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.userId) {
      headers['x-user-id'] = this.userId;
    }
    return headers;
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string; isAdmin?: boolean; isBlocked?: boolean; [key: string]: any }> {
    try {
      const res = await fetch(endpoint, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {}),
        },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          error: json.error || `HTTP error ${res.status}`,
          data: undefined,
          isBlocked: json.isBlocked || false,
          user: json.user,
        };
      }
      return json;
    } catch (err: any) {
      return { error: err.message || 'Network request failed' };
    }
  }

  // ==================== AUTHENTICATION ====================
  public async signIn(username: string, password: string): Promise<{ user?: UserProfile; data?: UserAccountData; token?: string; isAdmin?: boolean; isBlocked?: boolean; error?: string }> {
    const res = await this.request<any>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return {
      user: res.user,
      data: res.data,
      token: res.token,
      isAdmin: res.isAdmin,
      isBlocked: res.isBlocked,
      error: res.error,
    };
  }

  public async signUp(username: string, password: string, fullName?: string, phone?: string, referralCode?: string): Promise<{ user?: UserProfile; data?: UserAccountData; token?: string; isAdmin?: boolean; error?: string }> {
    const res = await this.request<any>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, fullName, phone, referralCode }),
    });
    return {
      user: res.user,
      data: res.data,
      token: res.token,
      isAdmin: res.isAdmin,
      error: res.error,
    };
  }

  public async getSessionUser(): Promise<{ user?: UserProfile; data?: UserAccountData; isAdmin?: boolean; isBlocked?: boolean; error?: string }> {
    const res = await this.request<any>('/api/auth/me', {
      method: 'GET',
    });
    return {
      user: res.user,
      data: res.data,
      isAdmin: res.isAdmin,
      isBlocked: res.isBlocked,
      error: res.error,
    };
  }

  public async signOut() {
    try {
      await this.request('/api/auth/signout', { method: 'POST' });
    } catch {}
    this.setSession(null, null);
  }

  // ==================== USER PROFILE & LEDGER ====================

  public async fetchUserData() {
    return this.request('/api/user/data', { method: 'GET' });
  }

  public async syncUserData(payload: {
    wallet?: WalletState;
    transactions?: Transaction[];
    machines?: Machine[];
    notifications?: AppNotification[];
    adminTasks?: AdminTask[];
  }) {
    return this.request('/api/user/data', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ==================== DYNAMIC INVESTMENT CATALOG ====================

  public async fetchCatalogMachines(): Promise<{ machines: Machine[]; error?: string }> {
    const res = await this.request<{ machines: Machine[] }>('/api/catalog/machines', {
      method: 'GET',
    });
    return { machines: res.machines || [], error: res.error };
  }

  public async createCatalogMachine(machine: Partial<Machine>) {
    return this.request<{ success: boolean; machine: Machine; catalog: Machine[] }>(
      '/api/admin/catalog/machines',
      {
        method: 'POST',
        body: JSON.stringify(machine),
      }
    );
  }

  public async updateCatalogMachine(id: string, machine: Partial<Machine>) {
    return this.request<{ success: boolean; machine: Machine; catalog: Machine[] }>(
      `/api/admin/catalog/machines/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(machine),
      }
    );
  }

  public async deleteCatalogMachine(id: string) {
    return this.request<{ success: boolean; catalog: Machine[] }>(
      `/api/admin/catalog/machines/${id}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ==================== DEPOSITS & WITHDRAWALS ====================

  public async submitDeposit(amountUGX: number, paymentMethod: string, referenceInfo?: string) {
    return this.request<{ success: boolean; transaction: Transaction; wallet: WalletState }>('/api/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountUGX, paymentMethod, referenceInfo }),
    });
  }

  public async submitWithdrawal(
    amountUGX: number,
    paymentMethod: string,
    recipientInfo: string,
    isBonusWithdrawal?: boolean
  ) {
    return this.request<{
      success: boolean;
      transaction: Transaction;
      wallet: WalletState;
      withdrawalSummary?: {
        withdrawalAmountUGX: number;
        feeRate: number;
        feeUGX: number;
        finalAmountReceivedUGX: number;
        totalDeductionUGX: number;
      };
    }>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amountUGX, paymentMethod, recipientInfo, isBonusWithdrawal }),
    });
  }

  public async fetchPendingTransactions() {
    return this.request<{ transactions: Transaction[] }>('/api/admin/pending-transactions', {
      method: 'GET',
    });
  }

  public async fetchAllTransactions() {
    return this.request<{ transactions: Transaction[] }>('/api/admin/transactions', {
      method: 'GET',
    });
  }

  public async approveTransaction(txId: string) {
    return this.request<{ success: boolean; transaction: Transaction; updatedUserBalance?: number }>(
      `/api/admin/transactions/${txId}/approve`,
      { method: 'POST' }
    );
  }

  public async rejectTransaction(txId: string) {
    return this.request<{ success: boolean; transaction: Transaction }>(
      `/api/admin/transactions/${txId}/reject`,
      { method: 'POST' }
    );
  }

  // ==================== ADMIN USER MANAGEMENT ====================

  public async fetchAdminUsers(): Promise<{ users: AdminUserSummary[]; error?: string }> {
    const res = await this.request<{ users: AdminUserSummary[] }>('/api/admin/users', {
      method: 'GET',
    });
    return { users: res.users || [], error: res.error };
  }

  public async updateAdminUser(
    userId: string,
    data: { username?: string; fullName?: string; phone?: string }
  ) {
    return this.request<{ success: boolean; user: UserProfile }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async adjustUserBalance(
    userId: string,
    adjustment: { amountUGX: number; type: 'add' | 'deduct'; reason: string }
  ) {
    return this.request<{
      success: boolean;
      previousBalance: number;
      newBalance: number;
      adjustment: BalanceAdjustment;
      wallet: WalletState;
    }>(`/api/admin/users/${userId}/balance`, {
      method: 'POST',
      body: JSON.stringify(adjustment),
    });
  }

  public async setUserStatus(userId: string, status: 'active' | 'blocked') {
    return this.request<{ success: boolean; user: UserProfile }>(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  public async deleteAdminUser(userId: string) {
    return this.request<{ success: boolean; message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  public async fetchBalanceAdjustments(): Promise<{ adjustments: BalanceAdjustment[]; error?: string }> {
    const res = await this.request<{ adjustments: BalanceAdjustment[] }>(
      '/api/admin/audit/balance-adjustments',
      { method: 'GET' }
    );
    return { adjustments: res.adjustments || [], error: res.error };
  }

  // ==================== USER INVESTMENTS ====================

  public async fetchUserInvestments() {
    return this.request<{ investments: any[] }>('/api/user/investments', { method: 'GET' });
  }

  public async buyInvestment(machineOrId: Partial<Machine> | string, amountUGX?: number) {
    const payload =
      typeof machineOrId === 'string'
        ? { id: machineOrId, minInvestUGX: amountUGX }
        : machineOrId;
    return this.request<{ success: boolean; investment: any; wallet: WalletState }>('/api/user/investments/buy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async claimInvestmentYield(investmentId: string) {
    return this.request<{ success: boolean; claimedUGX: number; wallet: WalletState; investment: any }>(
      `/api/user/investments/${investmentId}/claim`,
      { method: 'POST' }
    );
  }

  // ==================== ADMIN TASKS ====================

  public async fetchAdminTasks() {
    return this.request('/api/admin/tasks', { method: 'GET' });
  }

  public async approveAdminTask(taskId: string) {
    return this.request(`/api/admin/tasks/${taskId}/approve`, { method: 'POST' });
  }

  public async rejectAdminTask(taskId: string) {
    return this.request(`/api/admin/tasks/${taskId}/reject`, { method: 'POST' });
  }
}

export const apiClient = new ApiClient();
