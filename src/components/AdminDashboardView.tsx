import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Cpu,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Users,
  UserPlus,
  Edit2,
  Plus,
  Trash2,
  Lock,
  Unlock,
  DollarSign,
  FileText,
  Layers,
  Sparkles,
  Phone,
  Calendar,
  Mail,
  AlertCircle,
  Copy,
  CheckCheck,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Hash,
  Tag,
  Wallet,
  UploadCloud,
  Image as ImageIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  AdminTask,
  UserProfile,
  Transaction,
  Machine,
  AdminUserSummary,
  BalanceAdjustment,
} from '../types';
import { authService } from '../services/supabaseAuth';
import { apiClient } from '../services/apiClient';
import { getSupabaseClient } from '../services/supabase';
import { ProjectImage } from './ProjectImage';

interface AdminDashboardViewProps {
  tasks: AdminTask[];
  currentUser: UserProfile | null;
  onApproveTask: (taskId: string) => void;
  onRejectTask: (taskId: string) => void;
  onBackToUserDashboard?: () => void;
  onTransactionApproved?: () => void;
}

type AdminSubTab = 'transactions' | 'users' | 'catalog' | 'audit' | 'cluster' | 'nodes' | 'tasks';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  tasks,
  currentUser,
  onApproveTask,
  onRejectTask,
  onBackToUserDashboard,
  onTransactionApproved,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('transactions');
  const [rewardMultiplier, setRewardMultiplier] = useState<number>(1.0);
  const [systemSyncing, setSystemSyncing] = useState(false);

  // Transactions State (All, Pending, Completed, Rejected)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'investment' | 'bonus'>('all');
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txSortBy, setTxSortBy] = useState<'newest' | 'oldest' | 'highest_amount' | 'lowest_amount'>('newest');
  const [txPageSize, setTxPageSize] = useState<number>(15);
  const [txCurrentPage, setTxCurrentPage] = useState<number>(1);

  // Auto-refresh interval state (in seconds, default 2s, configurable up to 60s / 1 minute)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(2);
  const [isSilentSyncing, setIsSilentSyncing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // User Management State
  const [usersList, setUsersList] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'blocked' | 'admin'>('all');
  const [userSortBy, setUserSortBy] = useState<'highest_balance' | 'lowest_balance' | 'name_asc' | 'nodes' | 'newest'>('highest_balance');
  const [userPageSize, setUserPageSize] = useState<number>(15);
  const [userCurrentPage, setUserCurrentPage] = useState<number>(1);

  // Clipboard copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User Management Modals
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  const [adjustingUser, setAdjustingUser] = useState<AdminUserSummary | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'add' | 'deduct'>('add');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const [deletingUser, setDeletingUser] = useState<AdminUserSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [statusConfirmUser, setStatusConfirmUser] = useState<{ user: AdminUserSummary; targetStatus: 'active' | 'blocked' } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Projects / Catalog Management State
  const [catalogProjects, setCatalogProjects] = useState<Machine[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Machine> | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState('');
  const [projectFormLoading, setProjectFormLoading] = useState(false);

  // Project Image Upload State (Supabase Storage: bucket 'project-images')
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<BalanceAdjustment[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopyText = (text: string, key: string, label: string = 'ID') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
      showToast(`Copied ${label} to clipboard: ${text}`, 'info');
    }
  };

  const isAuthorizedAdmin = Boolean(
    currentUser && (currentUser.isAdmin === true || currentUser.role === 'admin')
  );

  // 1. Fetch Transactions (from Supabase via RPC & table query)
  const loadTransactions = async (isBackground = false) => {
    if (!isBackground) setTxLoading(true);
    else setIsSilentSyncing(true);
    try {
      const res = await authService.fetchAllTransactions();
      if (res.transactions) {
        setAllTransactions(res.transactions);
        if (res.error) console.warn('Transactions notice:', res.error);
      }
      setLastRefreshedAt(new Date());
    } catch (e) {
      console.warn('Failed to load transactions', e);
    } finally {
      if (!isBackground) setTxLoading(false);
      else setTimeout(() => setIsSilentSyncing(false), 300);
    }
  };

  // Backwards-compatible alias
  const loadPendingTransactions = loadTransactions;

  // 2. Fetch Users List
  const loadUsersList = async (isBackground = false) => {
    if (!isBackground) {
      setUsersLoading(true);
      setUsersError(null);
    } else {
      setIsSilentSyncing(true);
    }
    try {
      const res = await authService.getAdminUsers();
      if (res.error && !isBackground) {
        setUsersError(res.error);
      }
      if (res.users) {
        setUsersList(res.users);
      }
      setLastRefreshedAt(new Date());
    } catch (e: any) {
      console.error('[Admin Dashboard] Failed to load users list:', e);
      if (!isBackground) {
        setUsersError(e?.message || 'Unable to load users from Supabase');
      }
    } finally {
      if (!isBackground) setUsersLoading(false);
      else setTimeout(() => setIsSilentSyncing(false), 300);
    }
  };

  // 3. Fetch Catalog Projects (direct from Supabase)
  const loadCatalogProjects = async () => {
    setCatalogLoading(true);
    try {
      const res = await authService.fetchCatalogMachines();
      if (res.machines) {
        setCatalogProjects(res.machines);
      }
    } catch (e) {
      console.warn('Failed to load catalog projects', e);
    } finally {
      setCatalogLoading(false);
    }
  };

  // 4. Fetch Audit Logs
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await authService.getBalanceAuditLogs();
      if (res.adjustments) {
        setAuditLogs(res.adjustments);
      }
    } catch (e) {
      console.warn('Failed to load audit logs', e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorizedAdmin) {
      loadPendingTransactions();
      loadUsersList();
      loadCatalogProjects();
      loadAuditLogs();

      if (autoRefreshInterval > 0) {
        const timer = setInterval(() => {
          loadTransactions(true);
          loadUsersList(true);
        }, autoRefreshInterval * 1000);

        return () => clearInterval(timer);
      }
    }
  }, [isAuthorizedAdmin, autoRefreshInterval]);

  useEffect(() => {
    if (isAuthorizedAdmin) {
      if (activeSubTab === 'transactions' || activeSubTab === 'multisig') {
        loadTransactions();
      } else if (activeSubTab === 'users') {
        loadUsersList();
      } else if (activeSubTab === 'projects') {
        loadCatalogProjects();
      } else if (activeSubTab === 'audit') {
        loadAuditLogs();
      }
    }
  }, [activeSubTab, isAuthorizedAdmin]);

  // Handle Approve Transaction (Supabase RPC — atomic, idempotent)
  const handleApproveTransaction = async (tx: Transaction) => {
    setActionLoadingId(tx.id);
    try {
      const res = await authService.approveTransaction(tx.id);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        confetti({ particleCount: 50, spread: 60 });
        showToast(`Transaction approved: UGX ${tx.amountUGX.toLocaleString()} credited/settled successfully.`);
        await loadPendingTransactions();
        await loadUsersList();
        if (onTransactionApproved) {
          onTransactionApproved();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Approval failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject Transaction (Supabase RPC — balance untouched)
  const handleRejectTransaction = async (tx: Transaction) => {
    setActionLoadingId(tx.id);
    try {
      const res = await authService.rejectTransaction(tx.id);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`Transaction for UGX ${tx.amountUGX.toLocaleString()} rejected.`, 'info');
        await loadPendingTransactions();
        if (onTransactionApproved) {
          onTransactionApproved();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Rejection failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Edit User
  const handleOpenEditUser = (u: AdminUserSummary) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditFullName(u.fullName || '');
    setEditPhone(u.phone || '');
    setEditUserError('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError('');
    setEditUserLoading(true);

    try {
      const res = await authService.updateUserInfo(editingUser.id, {
        username: editUsername.trim(),
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
      });

      if (res.error) {
        setEditUserError(res.error);
      } else {
        showToast(`User @${editUsername} profile updated successfully.`);
        setEditingUser(null);
        await loadUsersList();
      }
    } catch (err: any) {
      setEditUserError(err.message || 'Failed to update user.');
    } finally {
      setEditUserLoading(false);
    }
  };

  // Handle Adjust Balance
  const handleOpenAdjustBalance = (u: AdminUserSummary) => {
    setAdjustingUser(u);
    setAdjustAmount('');
    setAdjustType('add');
    setAdjustReason('');
    setAdjustError('');
  };

  const handleSaveAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser) return;
    setAdjustError('');

    const numAmount = parseInt(adjustAmount.replace(/,/g, ''), 10);
    if (!numAmount || numAmount <= 0) {
      setAdjustError('Please enter a valid positive UGX amount.');
      return;
    }

    if (adjustType === 'deduct' && numAmount > adjustingUser.balanceUGX) {
      setAdjustError(`Cannot deduct UGX ${numAmount.toLocaleString()}. User balance is only UGX ${adjustingUser.balanceUGX.toLocaleString()}.`);
      return;
    }

    setAdjustLoading(true);
    try {
      const res = await authService.adjustBalance(adjustingUser.id, {
        amountUGX: numAmount,
        type: adjustType,
        reason: adjustReason.trim() || 'Admin balance adjustment',
      });

      if (!res.success && res.error) {
        setAdjustError(res.error);
      } else {
        const computedNewBal =
          res.newBalance !== undefined
            ? res.newBalance
            : adjustType === 'add'
            ? adjustingUser.balanceUGX + numAmount
            : Math.max(0, adjustingUser.balanceUGX - numAmount);

        // Optimistically update users list in UI immediately
        setUsersList((prev) =>
          prev.map((u) => (u.id === adjustingUser.id ? { ...u, balanceUGX: computedNewBal } : u))
        );

        confetti({ particleCount: 40, spread: 50 });
        showToast(
          `Balance adjusted: ${adjustType === 'add' ? '+' : '-'}UGX ${numAmount.toLocaleString()} for @${adjustingUser.username}. New Balance: UGX ${computedNewBal.toLocaleString()}`
        );
        setAdjustingUser(null);
        await loadUsersList();
        await loadAuditLogs();
        if (onTransactionApproved) {
          onTransactionApproved();
        }
      }
    } catch (err: any) {
      setAdjustError(err.message || 'Balance adjustment failed.');
    } finally {
      setAdjustLoading(false);
    }
  };

  // Handle Block / Unblock User
  const handleConfirmStatusChange = async () => {
    if (!statusConfirmUser) return;
    setStatusLoading(true);

    try {
      const res = await authService.toggleUserStatus(
        statusConfirmUser.user.id,
        statusConfirmUser.targetStatus
      );

      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(
          `User @${statusConfirmUser.user.username} is now ${statusConfirmUser.targetStatus.toUpperCase()}.`
        );
        setStatusConfirmUser(null);
        await loadUsersList();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status.', 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  // Handle Delete User
  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);

    try {
      const res = await authService.deleteUser(deletingUser.id);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`Account @${deletingUser.username} safely deleted.`, 'info');
        setDeletingUser(null);
        await loadUsersList();
      }
    } catch (err: any) {
      showToast(err.message || 'Delete operation failed.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle Image File Upload to Supabase Storage
  const handleImageFileUpload = async (file: File) => {
    setImageUploadError('');
    setImageUploadSuccess(false);

    // 1. Validate file type
    if (!file.type || !file.type.startsWith('image/')) {
      setImageUploadError('Invalid format. Please select an image file (PNG, JPG, WebP, or SVG).');
      return;
    }

    // 2. Validate file size (max 5 MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setImageUploadError(`Image file is too large (${sizeMB} MB). Maximum size is 5 MB.`);
      return;
    }

    setImageUploading(true);
    try {
      const res = await authService.uploadProjectImage(file);
      if (res.error || !res.publicUrl) {
        setImageUploadError(res.error || 'Failed to upload image to Supabase Storage.');
      } else {
        // Set the permanent Supabase public URL into the editing project state
        setEditingProject((prev) => (prev ? { ...prev, image: res.publicUrl } : null));
        setImageUploadSuccess(true);
        showToast('Image uploaded successfully to Supabase Storage bucket "project-images".');
      }
    } catch (err: any) {
      setImageUploadError(err.message || 'Image upload failed.');
    } finally {
      setImageUploading(false);
    }
  };

  // Handle Save Project (Create / Edit in Supabase)
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    setProjectFormError('');

    if (imageUploading) {
      setProjectFormError('Please wait for image upload to Supabase Storage to finish before saving.');
      return;
    }

    if (imageUploadError) {
      setProjectFormError(`Please resolve the image error: ${imageUploadError}`);
      return;
    }

    if (!editingProject.title || !editingProject.minInvestUGX) {
      setProjectFormError('Project Title and Minimum Investment amount are required.');
      return;
    }

    // Never save a local file path, blob: URL, temporary browser URL, or base64 image
    if (
      editingProject.image &&
      (editingProject.image.startsWith('blob:') ||
        editingProject.image.startsWith('data:') ||
        editingProject.image.startsWith('file://'))
    ) {
      setProjectFormError('Temporary or local image URLs cannot be saved. Please upload the image file to Supabase Storage.');
      return;
    }

    setProjectFormLoading(true);
    try {
      if (isCreatingProject) {
        const res = await authService.createCatalogMachine(editingProject);
        if (res.error) {
          setProjectFormError(res.error);
        } else {
          showToast(`New Project "${editingProject.title}" added to investment catalog in Supabase.`);
          setEditingProject(null);
          setIsCreatingProject(false);
          setImageUploadError('');
          setImageUploadSuccess(false);
          await loadCatalogProjects();
        }
      } else if (editingProject.id) {
        const res = await authService.updateCatalogMachine(editingProject.id, editingProject);
        if (res.error) {
          setProjectFormError(res.error);
        } else {
          showToast(`Project "${editingProject.title}" updated successfully in Supabase.`);
          setEditingProject(null);
          setImageUploadError('');
          setImageUploadSuccess(false);
          await loadCatalogProjects();
        }
      }
    } catch (err: any) {
      setProjectFormError(err.message || 'Failed to save project.');
    } finally {
      setProjectFormLoading(false);
    }
  };

  const handleDeleteProject = async (proj: Machine) => {
    if (!window.confirm(`Are you sure you want to remove project "${proj.title}" from the active catalog in Supabase?`)) {
      return;
    }
    try {
      const res = await authService.deleteCatalogMachine(proj.id);
      if (res.error) {
        showToast(res.error, 'error');
      } else {
        showToast(`Project "${proj.title}" removed from catalog.`, 'info');
        await loadCatalogProjects();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete project.', 'error');
    }
  };

  const handleApprove = (taskId: string) => {
    confetti({ particleCount: 50, spread: 45 });
    onApproveTask(taskId);
    showToast('Task approved successfully.');
  };

  const handleTriggerRebalance = () => {
    setSystemSyncing(true);
    setTimeout(() => {
      setSystemSyncing(false);
      showToast(`Hash multiplier applied: ${rewardMultiplier.toFixed(1)}x across sovereign cluster nodes.`);
    }, 1000);
  };

  // Derived metrics for Transactions
  const pendingTxCount = allTransactions.filter((t) => t.status === 'pending').length;
  const completedTxCount = allTransactions.filter((t) => t.status === 'completed' || t.status === 'approved').length;
  const rejectedTxCount = allTransactions.filter((t) => t.status === 'rejected').length;
  const depositTxCount = allTransactions.filter((t) => t.type === 'deposit').length;
  const withdrawTxCount = allTransactions.filter((t) => t.type === 'withdraw').length;
  const totalVolumeUGX = allTransactions.reduce((sum, t) => sum + (t.amountUGX || 0), 0);
  const totalPendingAmountUGX = allTransactions
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);
  const totalSettledAmountUGX = allTransactions
    .filter((t) => t.status === 'completed' || t.status === 'approved')
    .reduce((sum, t) => sum + (t.amountUGX || 0), 0);

  // Filtered Transactions
  const filteredTransactions = allTransactions.filter((tx) => {
    // 1. Status Filter
    const matchesStatus =
      txStatusFilter === 'all'
        ? true
        : txStatusFilter === 'pending'
        ? tx.status === 'pending'
        : txStatusFilter === 'completed'
        ? tx.status === 'completed' || tx.status === 'approved'
        : txStatusFilter === 'rejected'
        ? tx.status === 'rejected'
        : true;

    // 2. Type Filter
    const matchesType =
      txTypeFilter === 'all'
        ? true
        : txTypeFilter === 'deposit'
        ? tx.type === 'deposit'
        : txTypeFilter === 'withdraw'
        ? tx.type === 'withdraw'
        : txTypeFilter === 'investment'
        ? tx.type === 'investment'
        : txTypeFilter === 'bonus'
        ? tx.type === 'bonus' || tx.type === 'reward'
        : true;

    // 3. Search Query (matches Tx ID, User ID, Username, Full Name, Description, Recipient, Payment Method, Amount, TxHash)
    const query = txSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      tx.id.toLowerCase().includes(query) ||
      (tx.userId && tx.userId.toLowerCase().includes(query)) ||
      (tx.username && tx.username.toLowerCase().includes(query)) ||
      (tx.userFullName && tx.userFullName.toLowerCase().includes(query)) ||
      (tx.description && tx.description.toLowerCase().includes(query)) ||
      (tx.recipientInfo && tx.recipientInfo.toLowerCase().includes(query)) ||
      (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(query)) ||
      (tx.txHash && tx.txHash.toLowerCase().includes(query)) ||
      tx.amountUGX.toString().includes(query);

    return matchesStatus && matchesType && matchesSearch;
  });

  // Sorted Transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (txSortBy === 'highest_amount') return b.amountUGX - a.amountUGX;
    if (txSortBy === 'lowest_amount') return a.amountUGX - b.amountUGX;
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.created_at ? new Date(a.created_at).getTime() : (a.date ? new Date(a.date).getTime() : 0));
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.created_at ? new Date(b.created_at).getTime() : (b.date ? new Date(b.date).getTime() : 0));
    if (txSortBy === 'oldest') return timeA - timeB;
    return timeB - timeA; // newest default
  });

  const totalTxPages = Math.max(1, Math.ceil(sortedTransactions.length / txPageSize));
  const currentTxPage = Math.min(txCurrentPage, totalTxPages);
  const paginatedTransactions = sortedTransactions.slice(
    (currentTxPage - 1) * txPageSize,
    currentTxPage * txPageSize
  );

  // Derived metrics for Users
  const activeUsersCount = usersList.filter((u) => u.status === 'active').length;
  const blockedUsersCount = usersList.filter((u) => u.status === 'blocked').length;
  const adminUsersCount = usersList.filter((u) => u.isAdmin || u.role === 'admin').length;
  const totalSystemVaultUGX = usersList.reduce((sum, u) => sum + (u.balanceUGX || 0), 0);

  // Filtered Users (Search specifically matches Name, User ID / UUID, Username, Phone, Email, Referral)
  const filteredUsers = usersList.filter((u) => {
    const matchesStatus =
      userStatusFilter === 'all'
        ? true
        : userStatusFilter === 'active'
        ? u.status === 'active'
        : userStatusFilter === 'blocked'
        ? u.status === 'blocked'
        : userStatusFilter === 'admin'
        ? u.isAdmin || u.role === 'admin'
        : true;

    const query = userSearchQuery.trim().toLowerCase();
    if (!query) return matchesStatus;

    const matchesSearch =
      (u.id ?? '').toLowerCase().includes(query) ||
      (u.username ?? '').toLowerCase().includes(query) ||
      (u.fullName ?? '').toLowerCase().includes(query) ||
      (u.phone ?? '').toLowerCase().includes(query) ||
      ((u as any).email ?? '').toLowerCase().includes(query) ||
      (u.referralCode ?? '').toLowerCase().includes(query);

    return matchesSearch && matchesStatus;
  });

  // Sorted Users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (userSortBy === 'highest_balance') return b.balanceUGX - a.balanceUGX;
    if (userSortBy === 'lowest_balance') return a.balanceUGX - b.balanceUGX;
    if (userSortBy === 'nodes') return (b.activeMachinesCount || 0) - (a.activeMachinesCount || 0);
    if (userSortBy === 'name_asc') {
      const nameA = a.fullName || a.username || '';
      const nameB = b.fullName || b.username || '';
      return nameA.localeCompare(nameB);
    }
    return 0; // default order from Supabase
  });

  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / userPageSize));
  const currentUserPage = Math.min(userCurrentPage, totalUserPages);
  const paginatedUsers = sortedUsers.slice(
    (currentUserPage - 1) * userPageSize,
    currentUserPage * userPageSize
  );

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="px-5 py-4 space-y-4 pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-[13px] font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-red-900 text-white border-red-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ADMIN TOP CONTROL BAR */}
      <div className="bg-[#0F172A] rounded-3xl p-5 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-blue-600/20 via-indigo-600/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-black text-white leading-none">
                  VESTRA ADMIN CONSOLE
                </h2>
                <span className="text-[9.5px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  SOVEREIGN VAULTS
                </span>
              </div>
              <p className="text-[11.5px] text-slate-400 mt-1">
                Signed in as <span className="font-bold text-white">@{currentUser?.username || 'admin'}</span> • Full Root Controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-Refresh Frequency Control */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-[11.5px] font-bold">
              <span className="relative flex h-2 w-2">
                {autoRefreshInterval > 0 ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                )}
              </span>
              <span className="text-slate-400 text-[10.5px]">Sync:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-[11.5px]"
                title="Adjust automatic refresh interval"
              >
                <option value={2} className="bg-slate-900 text-white">2s (Live Sync)</option>
                <option value={5} className="bg-slate-900 text-white">5s</option>
                <option value={10} className="bg-slate-900 text-white">10s</option>
                <option value={15} className="bg-slate-900 text-white">15s</option>
                <option value={30} className="bg-slate-900 text-white">30s</option>
                <option value={60} className="bg-slate-900 text-white">1 min (60s)</option>
                <option value={0} className="bg-slate-900 text-white">Paused (Manual)</option>
              </select>
              {isSilentSyncing && (
                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin ml-0.5" />
              )}
            </div>

            {onBackToUserDashboard && (
              <button
                onClick={onBackToUserDashboard}
                className="bg-white/10 hover:bg-white/20 active:scale-98 text-white px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Investor View
              </button>
            )}
          </div>
        </div>

        {/* Global Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-800/80 text-[12px]">
          <div className="bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Review</span>
            <span className="text-[16px] font-mono font-black text-amber-400">
              {pendingTxCount + pendingTasksCount}
            </span>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Users</span>
            <span className="text-[16px] font-mono font-black text-blue-400">
              {usersList.length}
            </span>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Settled Volume</span>
            <span className="text-[15px] font-mono font-black text-emerald-400 truncate block">
              UGX {totalSettledAmountUGX.toLocaleString()}
            </span>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Global Yield</span>
            <span className="text-[16px] font-mono font-black text-purple-400">
              {rewardMultiplier.toFixed(1)}x Multiplier
            </span>
          </div>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'transactions'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Transaction Management</span>
          {pendingTxCount > 0 ? (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black animate-pulse">
              {pendingTxCount}
            </span>
          ) : (
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {allTransactions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Management</span>
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
            {usersList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('catalog')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'catalog'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Projects Catalog</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'audit'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Balance Audit Log</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cluster')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'cluster'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Yield Multiplier</span>
        </button>

        <button
          onClick={() => setActiveSubTab('nodes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'nodes'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Node Clusters</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold shrink-0 transition-all cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'bg-[#1657D9] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Multisig Tasks</span>
          {pendingTasksCount > 0 && (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
              {pendingTasksCount}
            </span>
          )}
        </button>
      </div>

      {/* ==========================================
          TAB 1: TRANSACTION MANAGEMENT PANEL (WITH STATUS FILTERING & SEARCH)
          ========================================== */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-3">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Ledger Items</span>
              <span className="text-[16px] font-mono font-black text-slate-900">{allTransactions.length}</span>
              <span className="text-[10.5px] text-slate-500 block mt-0.5">
                {depositTxCount} Inflows • {withdrawTxCount} Outflows
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Pending Review</span>
              <span className="text-[16px] font-mono font-black text-amber-900">{pendingTxCount} requests</span>
              <span className="text-[10.5px] text-amber-700 block font-mono mt-0.5">
                UGX {totalPendingAmountUGX.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Approved & Settled</span>
              <span className="text-[16px] font-mono font-black text-emerald-900">{completedTxCount} settled</span>
              <span className="text-[10.5px] text-emerald-700 block font-mono mt-0.5">
                UGX {totalSettledAmountUGX.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-red-200/80 bg-red-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-red-700 block">Rejected Entries</span>
              <span className="text-[16px] font-mono font-black text-red-900">{rejectedTxCount} items</span>
              <span className="text-[10.5px] text-slate-500 block mt-0.5">Audit recorded</span>
            </div>
          </div>

          {/* Primary Filter & Search Control Panel */}
          <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            {/* Search Input and Refresh */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by User Name, @Username, User ID, Tx ID, Phone, Amount, Ref..."
                  value={txSearchQuery}
                  onChange={(e) => {
                    setTxSearchQuery(e.target.value);
                    setTxCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {txSearchQuery && (
                  <button
                    onClick={() => {
                      setTxSearchQuery('');
                      setTxCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Auto-Refresh Rate for Transactions */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200 text-[11.5px] font-bold text-slate-700">
                  <span className="relative flex h-2 w-2">
                    {autoRefreshInterval > 0 ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                    )}
                  </span>
                  <span className="text-slate-500 text-[10.5px]">Refresh:</span>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                    className="bg-transparent outline-none cursor-pointer text-slate-800"
                    title="Change automatic refresh rate (2s up to 1 minute)"
                  >
                    <option value={2}>2s (Live)</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1 min</option>
                    <option value={0}>Paused</option>
                  </select>
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200 text-[11.5px] font-bold text-slate-700">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={txSortBy}
                    onChange={(e) => setTxSortBy(e.target.value as any)}
                    className="bg-transparent outline-none cursor-pointer"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest_amount">Highest Amount</option>
                    <option value="lowest_amount">Lowest Amount</option>
                  </select>
                </div>

                <button
                  onClick={() => loadTransactions(false)}
                  className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[11.5px] font-bold"
                  title="Refresh Transactions Ledger"
                >
                  <RefreshCw className={`w-4 h-4 ${txLoading || isSilentSyncing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Status-Based Filtering Bar */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-wrap">
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>

                <button
                  onClick={() => {
                    setTxStatusFilter('all');
                    setTxCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    txStatusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Statuses ({allTransactions.length})
                </button>

                <button
                  onClick={() => {
                    setTxStatusFilter('pending');
                    setTxCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    txStatusFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {pendingTxCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-900 animate-ping" />}
                  Pending Review ({pendingTxCount})
                </button>

                <button
                  onClick={() => {
                    setTxStatusFilter('completed');
                    setTxCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    txStatusFilter === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Completed ({completedTxCount})
                </button>

                <button
                  onClick={() => {
                    setTxStatusFilter('rejected');
                    setTxCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    txStatusFilter === 'rejected'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 text-red-800 hover:bg-red-100'
                  }`}
                >
                  Rejected ({rejectedTxCount})
                </button>
              </div>

              {/* Type Sub-Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">Type:</span>

                <button
                  onClick={() => {
                    setTxTypeFilter('all');
                    setTxCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    txTypeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Types
                </button>

                <button
                  onClick={() => {
                    setTxTypeFilter('deposit');
                    setTxCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    txTypeFilter === 'deposit' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Deposits
                </button>

                <button
                  onClick={() => {
                    setTxTypeFilter('withdraw');
                    setTxCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    txTypeFilter === 'withdraw' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Withdrawals
                </button>

                <button
                  onClick={() => {
                    setTxTypeFilter('investment');
                    setTxCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    txTypeFilter === 'investment' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Investments
                </button>
              </div>
            </div>

            {/* Active filter summary bar */}
            {(txSearchQuery || txStatusFilter !== 'all' || txTypeFilter !== 'all') && (
              <div className="flex items-center justify-between text-[11.5px] bg-blue-50/60 p-2 rounded-xl border border-blue-100 text-blue-900">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Showing <strong>{filteredTransactions.length}</strong> of {allTransactions.length} transactions
                  </span>
                  {txStatusFilter !== 'all' && (
                    <span className="bg-blue-200/70 text-blue-900 px-2 py-0.2 rounded-md font-bold text-[10.5px]">
                      Status: {txStatusFilter}
                    </span>
                  )}
                  {txTypeFilter !== 'all' && (
                    <span className="bg-blue-200/70 text-blue-900 px-2 py-0.2 rounded-md font-bold text-[10.5px]">
                      Type: {txTypeFilter}
                    </span>
                  )}
                  {txSearchQuery && (
                    <span className="bg-blue-200/70 text-blue-900 px-2 py-0.2 rounded-md font-bold text-[10.5px]">
                      Query: "{txSearchQuery}"
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setTxSearchQuery('');
                    setTxStatusFilter('all');
                    setTxTypeFilter('all');
                    setTxCurrentPage(1);
                  }}
                  className="font-bold text-blue-700 hover:text-blue-950 underline cursor-pointer text-[11px]"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* List of Filtered Transactions */}
          {txLoading ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-100">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-[13px] font-bold">Synchronizing Supabase transactions ledger...</p>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-[14px] font-bold text-slate-900">No Transactions Found</h4>
              <p className="text-[12px] text-slate-500 max-w-sm mx-auto">
                No transactions matched your selected status, type, or search keyword.
              </p>
              {(txSearchQuery || txStatusFilter !== 'all' || txTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setTxSearchQuery('');
                    setTxStatusFilter('all');
                    setTxTypeFilter('all');
                  }}
                  className="mt-2 text-[12px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear all search filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedTransactions.map((tx) => {
                const isDeposit = tx.type === 'deposit';
                const isWithdraw = tx.type === 'withdraw';
                const isInvestment = tx.type === 'investment';
                const isPending = tx.status === 'pending';
                const isCompleted = tx.status === 'completed' || tx.status === 'approved';
                const isRejected = tx.status === 'rejected';
                const isProcessing = actionLoadingId === tx.id;

                return (
                  <div
                    key={tx.id}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border shadow-xs space-y-3 transition-all ${
                      isPending
                        ? 'border-amber-300/80 bg-amber-50/10 hover:border-amber-400'
                        : isRejected
                        ? 'border-red-200/80 bg-red-50/10'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            isDeposit
                              ? 'bg-emerald-100 text-emerald-700'
                              : isWithdraw
                              ? 'bg-blue-100 text-blue-700'
                              : isInvestment
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : isWithdraw ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : (
                            <Activity className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Type tag */}
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isDeposit
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isWithdraw
                                  ? 'bg-blue-100 text-blue-800'
                                  : isInvestment
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {isDeposit
                                ? 'Deposit'
                                : isWithdraw
                                ? 'Withdrawal'
                                : isInvestment
                                ? 'Investment Node'
                                : tx.type}
                            </span>

                            {/* Status badge */}
                            <span
                              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                                isPending
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : isCompleted
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-red-100 text-red-900 border border-red-300'
                              }`}
                            >
                              {isPending ? (
                                <>
                                  <Clock className="w-3 h-3 text-amber-700" /> Pending Review
                                </>
                              ) : isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Settled / Completed
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 text-red-700" /> Rejected
                                </>
                              )}
                            </span>

                            <span className="text-[11px] font-mono text-slate-400">
                              {tx.date || 'Recent'}
                            </span>
                          </div>

                          <h4 className="text-[14px] font-extrabold text-slate-900 mt-1">
                            {tx.description || `${tx.type} via ${tx.paymentMethod || 'Mobile Money'}`}
                          </h4>

                          <div className="flex items-center gap-2 text-[12px] text-slate-600 mt-0.5 flex-wrap">
                            <span>
                              User:{' '}
                              <strong className="text-slate-900">{tx.userFullName || 'Investor'}</strong>{' '}
                              <span className="font-mono text-slate-500">(@{tx.username || 'user'})</span>
                            </span>

                            {tx.userId && (
                              <button
                                onClick={() => handleCopyText(tx.userId!, `tx-user-${tx.id}`, 'User ID')}
                                className="inline-flex items-center gap-1 font-mono text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-md transition-colors cursor-pointer"
                                title="Copy User ID"
                              >
                                {copiedId === `tx-user-${tx.id}` ? (
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                                <span>UID: {tx.userId.slice(0, 8)}...</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Amount (UGX)
                        </span>
                        <span
                          className={`text-[16px] sm:text-[18px] font-mono font-black ${
                            isDeposit
                              ? 'text-emerald-600'
                              : isWithdraw
                              ? 'text-blue-600'
                              : 'text-slate-900'
                          }`}
                        >
                          UGX {tx.amountUGX.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Transaction Details Box */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-[12px] grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Payment Channel</span>
                        <span className="font-bold text-slate-800">{tx.paymentMethod || 'MTN / Airtel Money'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">
                          {isDeposit ? 'Depositor Phone / Route' : 'Reference / Recipient'}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-bold text-slate-800 text-[11.5px] truncate block">
                            {tx.recipientInfo || (isDeposit ? 'Direct Mobile Money' : 'VESTRA Treasury Core')}
                          </span>
                          {tx.recipientInfo && (
                            <button
                              onClick={() => handleCopyText(tx.recipientInfo!, `tx-ref-${tx.id}`, 'Reference')}
                              className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0 cursor-pointer"
                              title="Copy Depositor / Reference Info"
                            >
                              {copiedId === `tx-ref-${tx.id}` ? (
                                <CheckCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Transaction ID</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[11px] text-slate-600 truncate block">{tx.id}</span>
                          <button
                            onClick={() => handleCopyText(tx.id, `tx-id-${tx.id}`, 'Tx ID')}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="Copy Transaction ID"
                          >
                            {copiedId === `tx-id-${tx.id}` ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls for Pending Transactions */}
                    {isPending && (
                      <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                        <button
                          onClick={() => handleApproveTransaction(tx)}
                          disabled={isProcessing}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-[12.5px] py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {isDeposit ? 'Approve & Credit Balance' : 'Approve & Settle Payout'}
                        </button>

                        <button
                          onClick={() => handleRejectTransaction(tx)}
                          disabled={isProcessing}
                          className="bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-bold text-[12.5px] py-2.5 px-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Reject Request
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Transactions Pagination Controls */}
              {totalTxPages > 1 && (
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-[12px] flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>
                      Showing {(currentTxPage - 1) * txPageSize + 1} to{' '}
                      {Math.min(currentTxPage * txPageSize, sortedTransactions.length)} of{' '}
                      {sortedTransactions.length}
                    </span>
                    <select
                      value={txPageSize}
                      onChange={(e) => {
                        setTxPageSize(Number(e.target.value));
                        setTxCurrentPage(1);
                      }}
                      className="bg-slate-100 px-2 py-1 rounded-lg font-bold border border-slate-200"
                    >
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={30}>30 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTxCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentTxPage === 1}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-800">
                      Page {currentTxPage} of {totalTxPages}
                    </span>
                    <button
                      onClick={() => setTxCurrentPage((p) => Math.min(totalTxPages, p + 1))}
                      disabled={currentTxPage === totalTxPages}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 2: USER MANAGEMENT (SEARCH BY NAME OR ID & STATUS FILTERING)
          ========================================== */}
      {activeSubTab === 'users' && (
        <div className="space-y-3">
          {/* User Vault Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Registered Users</span>
              <span className="text-[16px] font-mono font-black text-slate-900">{usersList.length}</span>
              <span className="text-[10.5px] text-slate-500 block mt-0.5">{adminUsersCount} Administrators</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Active Accounts</span>
              <span className="text-[16px] font-mono font-black text-emerald-900">{activeUsersCount}</span>
              <span className="text-[10.5px] text-emerald-700 block mt-0.5">Good standing</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-red-200/80 bg-red-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-red-700 block">Suspended / Blocked</span>
              <span className="text-[16px] font-mono font-black text-red-900">{blockedUsersCount}</span>
              <span className="text-[10.5px] text-red-700 block mt-0.5">Access revoked</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">System Vault Balance</span>
              <span className="text-[15px] font-mono font-black text-blue-900 truncate block">
                UGX {totalSystemVaultUGX.toLocaleString()}
              </span>
              <span className="text-[10.5px] text-blue-700 block mt-0.5">Custodial holdings</span>
            </div>
          </div>

          {/* User Search & Filter Header */}
          <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            {/* Search Input supporting Name or User ID */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter users by Full Name, @Username, or User ID (UUID)..."
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setUserCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => {
                      setUserSearchQuery('');
                      setUserCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Auto-Refresh Rate for Users */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200 text-[11.5px] font-bold text-slate-700">
                  <span className="relative flex h-2 w-2">
                    {autoRefreshInterval > 0 ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                    )}
                  </span>
                  <span className="text-slate-500 text-[10.5px]">Refresh:</span>
                  <select
                    value={autoRefreshInterval}
                    onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                    className="bg-transparent outline-none cursor-pointer text-slate-800"
                    title="Change automatic refresh rate (2s up to 1 minute)"
                  >
                    <option value={2}>2s (Live)</option>
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1 min</option>
                    <option value={0}>Paused</option>
                  </select>
                </div>

                {/* User Sort selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200 text-[11.5px] font-bold text-slate-700">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={userSortBy}
                    onChange={(e) => setUserSortBy(e.target.value as any)}
                    className="bg-transparent outline-none cursor-pointer"
                  >
                    <option value="highest_balance">Highest Balance</option>
                    <option value="lowest_balance">Lowest Balance</option>
                    <option value="name_asc">Name (A-Z)</option>
                    <option value="nodes">Most Nodes</option>
                    <option value="newest">Default Order</option>
                  </select>
                </div>

                <button
                  onClick={() => loadUsersList(false)}
                  className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[11.5px] font-bold"
                  title="Refresh Users List"
                >
                  <RefreshCw className={`w-4 h-4 ${usersLoading || isSilentSyncing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Status Filter Tabs & Summary */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>

                <button
                  onClick={() => {
                    setUserStatusFilter('all');
                    setUserCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    userStatusFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Users ({usersList.length})
                </button>
                <button
                  onClick={() => {
                    setUserStatusFilter('active');
                    setUserCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    userStatusFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  Active ({activeUsersCount})
                </button>
                <button
                  onClick={() => {
                    setUserStatusFilter('blocked');
                    setUserCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    userStatusFilter === 'blocked' ? 'bg-red-600 text-white shadow-xs' : 'bg-red-50 text-red-800 hover:bg-red-100'
                  }`}
                >
                  Blocked ({blockedUsersCount})
                </button>
                <button
                  onClick={() => {
                    setUserStatusFilter('admin');
                    setUserCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-colors cursor-pointer ${
                    userStatusFilter === 'admin' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                  }`}
                >
                  Admins ({adminUsersCount})
                </button>
              </div>

              {/* Active search filter reset */}
              {(userSearchQuery || userStatusFilter !== 'all') && (
                <div className="flex items-center gap-2 text-[11.5px] text-slate-600">
                  <span>
                    Found <strong>{filteredUsers.length}</strong> matching
                  </span>
                  <button
                    onClick={() => {
                      setUserSearchQuery('');
                      setUserStatusFilter('all');
                      setUserCurrentPage(1);
                    }}
                    className="font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* User List Cards */}
          {usersLoading ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-100">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-[13px] font-bold">Loading users from Supabase ledger...</p>
            </div>
          ) : usersError ? (
            <div className="bg-red-50/70 border border-red-200 rounded-3xl p-6 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[15px] font-black text-red-950">Unable to load users from Supabase</h4>
                <p className="text-[12px] text-red-600 mt-1 font-medium">
                  An error occurred while querying the database user records.
                </p>
              </div>
              <div className="bg-red-100/60 p-3 rounded-xl border border-red-200/80 max-w-md mx-auto">
                <p className="text-[12px] font-mono text-red-800 break-words leading-relaxed">
                  {usersError}
                </p>
              </div>
              <button
                onClick={loadUsersList}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-[12.5px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Retry Loading Users
              </button>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-xs space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-[14px] font-bold text-slate-800">
                {usersList.length === 0 ? 'No registered users found' : 'No matching users found'}
              </h4>
              <p className="text-[12px] text-slate-500 max-w-sm mx-auto">
                {usersList.length === 0
                  ? 'There are currently no registered user accounts in the Supabase database.'
                  : 'No registered accounts match your search query or status filter.'}
              </p>
              {(userSearchQuery || userStatusFilter !== 'all') && usersList.length > 0 && (
                <button
                  onClick={() => {
                    setUserSearchQuery('');
                    setUserStatusFilter('all');
                  }}
                  className="mt-2 text-[12px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear user search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedUsers.map((u) => {
                const isBlocked = u.status === 'blocked';
                const isAdmin = u.isAdmin || u.role === 'admin';

                return (
                  <div
                    key={u.id}
                    className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all ${
                      isBlocked
                        ? 'border-red-200 bg-red-50/20'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-[16px] text-white shrink-0 shadow-xs ${
                            isAdmin
                              ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                              : isBlocked
                              ? 'bg-red-600'
                              : 'bg-gradient-to-tr from-slate-700 to-slate-900'
                          }`}
                        >
                          {(u.fullName || u.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-[15px] font-black text-slate-900 leading-tight">
                              {u.fullName || u.username}
                            </h4>
                            <span className="font-mono text-[12px] text-slate-500 font-bold">
                              @{u.username}
                            </span>
                            {isAdmin && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-blue-600" /> Admin
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isBlocked
                                  ? 'bg-red-100 text-red-900 border border-red-200'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {isBlocked ? 'SUSPENDED / BLOCKED' : 'ACTIVE'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11.5px] text-slate-500 mt-1 flex-wrap">
                            {/* Copyable User ID Badge */}
                            <button
                              onClick={() => handleCopyText(u.id, `user-card-id-${u.id}`, 'User ID')}
                              className="inline-flex items-center gap-1 font-mono text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 transition-colors cursor-pointer"
                              title="Click to copy full User ID"
                            >
                              {copiedId === `user-card-id-${u.id}` ? (
                                <CheckCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                              <span>ID: {u.id}</span>
                            </button>

                            {(u as any).email && (
                              <span className="flex items-center gap-1 font-medium text-slate-600">
                                <Mail className="w-3 h-3 text-slate-400" /> {(u as any).email}
                              </span>
                            )}
                            {u.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {u.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" /> Member: {u.memberSince || 'August 2026'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Balance & Stats block */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Available Balance</span>
                        <span className="text-[17px] font-mono font-black text-slate-900">
                          UGX {u.balanceUGX.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">
                          {u.activeMachinesCount} Nodes • {u.transactionsCount} Transactions
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                      <button
                        onClick={() => handleOpenEditUser(u)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit Info
                      </button>

                      <button
                        onClick={() => handleOpenAdjustBalance(u)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200/80"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Adjust Balance
                      </button>

                      <button
                        onClick={() =>
                          setStatusConfirmUser({
                            user: u,
                            targetStatus: isBlocked ? 'active' : 'blocked',
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isBlocked
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isBlocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" /> Unblock Account
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-amber-600" /> Block Account
                          </>
                        )}
                      </button>

                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete User
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Users Pagination Controls */}
              {totalUserPages > 1 && (
                <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-[12px] flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span>
                      Showing {(currentUserPage - 1) * userPageSize + 1} to{' '}
                      {Math.min(currentUserPage * userPageSize, sortedUsers.length)} of {sortedUsers.length} users
                    </span>
                    <select
                      value={userPageSize}
                      onChange={(e) => {
                        setUserPageSize(Number(e.target.value));
                        setUserCurrentPage(1);
                      }}
                      className="bg-slate-100 px-2 py-1 rounded-lg font-bold border border-slate-200"
                    >
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={30}>30 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setUserCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentUserPage === 1}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-800">
                      Page {currentUserPage} of {totalUserPages}
                    </span>
                    <button
                      onClick={() => setUserCurrentPage((p) => Math.min(totalUserPages, p + 1))}
                      disabled={currentUserPage === totalUserPages}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 3: PROJECTS / MACHINE CATALOG MANAGEMENT
          ========================================== */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-3">
          {/* Header & Add Button */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-extrabold text-slate-900">
                Investment Projects Catalog ({catalogProjects.length})
              </h3>
              <p className="text-[11.5px] text-slate-500">
                Manage hardware mining rigs, clean energy generators, and VIP nodes available for investment.
              </p>
            </div>
            <button
              onClick={() => {
                setIsCreatingProject(true);
                setEditingProject({
                  title: '',
                  subtitle: '',
                  category: 'DS-Mining',
                  dailyRewardUGX: 4500,
                  minInvestUGX: 15000,
                  estYearlyROI: 10950,
                  hashrate: 'Algorithmic Engine',
                  powerSource: 'Clean Energy Grid',
                  status: 'Active',
                  image: '',
                });
                setProjectFormError('');
                setImageUploadError('');
                setImageUploadSuccess(false);
              }}
              className="bg-[#1657D9] hover:bg-blue-700 text-white font-bold text-[12.5px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Project
            </button>
          </div>

          {/* Catalog Projects List */}
          {catalogLoading ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-100">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-[13px] font-bold">Loading investment catalog...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catalogProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs flex flex-col justify-between"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-100 bg-slate-50 flex items-center justify-center p-1">
                        <ProjectImage
                          src={proj.image}
                          alt={proj.title}
                          fallbackCategory={proj.category}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <span className="text-[9.5px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          {proj.category}
                        </span>
                        <h4 className="text-[14px] font-extrabold text-slate-900 mt-1">
                          {proj.title}
                        </h4>
                        <p className="text-[11px] text-slate-500">{proj.subtitle || proj.powerSource}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 text-[12px] grid grid-cols-2 gap-2 border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Min Investment</span>
                        <span className="font-mono font-bold text-slate-900">
                          UGX {proj.minInvestUGX.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Daily Reward</span>
                        <span className="font-mono font-bold text-emerald-600">
                          +UGX {proj.dailyRewardUGX.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Yearly ROI</span>
                        <span className="font-bold text-blue-600">{proj.estYearlyROI}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10.5px]">Hashrate</span>
                        <span className="font-mono font-bold text-slate-700">{proj.hashrate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        proj.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Status: {proj.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setIsCreatingProject(false);
                          setEditingProject(proj);
                          setProjectFormError('');
                          setImageUploadError('');
                          setImageUploadSuccess(false);
                        }}
                        className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11.5px] px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProject(proj)}
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-[11.5px] px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 4: BALANCE ADJUSTMENTS AUDIT LOG
          ========================================== */}
      {activeSubTab === 'audit' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-extrabold text-slate-900">
                Administrative Balance Audit Trail
              </h3>
              <p className="text-[11.5px] text-slate-500">
                Immutable records of every manual fund allocation or deduction performed by administrators.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Refresh Audit Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {auditLoading ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-100">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-[13px] font-bold">Loading audit records...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-xs">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-[13px] font-bold text-slate-700">No balance adjustments recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((log) => {
                const isAdd = log.type === 'add';
                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isAdd ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isAdd ? '+ ADDED FUNDS' : '- DEDUCTED FUNDS'}
                        </span>
                        <span className="text-[12px] font-extrabold text-slate-900">
                          @{log.username} ({log.userFullName || 'User'})
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {log.date}
                        </span>
                      </div>

                      <p className="text-[12px] text-slate-600">
                        Reason: <span className="font-semibold text-slate-800">{log.reason}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Authorized by Admin: <span className="font-bold text-slate-700">@{log.adminUsername}</span>
                      </p>
                    </div>

                    <div className="text-right bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
                      <span
                        className={`text-[15px] font-mono font-black ${
                          isAdd ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isAdd ? '+' : '-'}UGX {Math.abs(log.adjustmentAmountUGX).toLocaleString()}
                      </span>
                      <div className="text-[11px] font-mono text-slate-500">
                        UGX {log.previousBalanceUGX.toLocaleString()} → UGX {log.newBalanceUGX.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 5: CLUSTER MULTIPLIER
          ========================================== */}
      {activeSubTab === 'cluster' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Platform Hash Multiplier
            </h3>
            <span className="font-mono font-black text-blue-600 text-[16px]">
              {rewardMultiplier.toFixed(1)}x
            </span>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Adjust the universal mining hash multiplier for all synchronized DS-Hardware clusters across the Uganda sovereign grid.
          </p>

          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={rewardMultiplier}
            onChange={(e) => setRewardMultiplier(parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.5x (Safe)</span>
            <span>1.0x (Standard)</span>
            <span>2.0x (Hyper Yield)</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-1.5 text-[12px]">
            <div className="flex justify-between text-slate-600">
              <span>Target Hardware:</span>
              <span className="font-bold text-slate-900">Solar-Mech, DS-Shoe & Hydro</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Consensus Engine:</span>
              <span className="font-bold text-emerald-600">DS Hybrid Proof-of-Yield</span>
            </div>
          </div>

          <button
            onClick={handleTriggerRebalance}
            disabled={systemSyncing}
            className="w-full py-3 bg-[#1657D9] hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${systemSyncing ? 'animate-spin' : ''}`} />
            {systemSyncing ? 'Synchronizing Cluster Nodes...' : 'Apply Multiplier & Sync Nodes'}
          </button>
        </div>
      )}

      {/* ==========================================
          TAB 6: NODE CLUSTERS
          ========================================== */}
      {activeSubTab === 'nodes' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-3">
            <h3 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" /> Active Rigs & Subsystems
            </h3>

            <div className="divide-y divide-slate-100">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-bold text-slate-900">Cluster Alpha (Jinja Solar Farm)</h4>
                  <span className="text-[11px] text-slate-400 font-mono">64 Units • 99.9% Uptime</span>
                </div>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  OPTIMAL
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-bold text-slate-900">Cluster Beta (Victoria Hydro Dam)</h4>
                  <span className="text-[11px] text-slate-400 font-mono">42 Units • 99.8% Uptime</span>
                </div>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  OPTIMAL
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-bold text-slate-900">Cluster Gamma (Kampala Kinetic)</h4>
                  <span className="text-[11px] text-slate-400 font-mono">42 Units • 98.9% Uptime</span>
                </div>
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  OPTIMAL
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 7: MULTISIG TASKS
          ========================================== */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-500 border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-[13px] font-bold">All Multisig queue tasks resolved.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {task.category || 'System Action'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">{task.timestamp}</span>
                </div>

                <h4 className="text-[13.5px] font-bold text-slate-900 leading-snug">
                  {task.title}
                </h4>
                <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
                  {task.description}
                </p>

                {task.amountUGX && (
                  <div className="mt-2 text-[13px] font-mono font-black text-slate-900">
                    Amount: UGX {task.amountUGX.toLocaleString()}
                  </div>
                )}

                {task.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => handleApprove(task.id)}
                      className="flex-1 bg-[#1657D9] hover:bg-blue-700 active:scale-98 text-white font-bold text-[12px] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve & Sign
                    </button>
                    <button
                      onClick={() => onRejectTask(task.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12px] py-2 px-3 rounded-xl transition-colors cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ==========================================
          MODALS FOR USER & PROJECT MANAGEMENT
          ========================================== */}

      {/* 1. EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[13px]">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-extrabold text-slate-900">
                  Edit User Profile
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editUserError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200">
                {editUserError}
              </div>
            )}

            <form onSubmit={handleSaveEditUser} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+256 700 000 000"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editUserLoading}
                  className="flex-1 py-2.5 bg-[#1657D9] hover:bg-blue-700 text-white font-bold text-[12.5px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {editUserLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADJUST BALANCE MODAL */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[16px] font-extrabold text-slate-900 leading-tight">
                    Adjust User Balance
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Target: @{adjustingUser.username} ({adjustingUser.fullName || 'User'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Balance Box */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center justify-between">
              <span className="text-[12px] font-bold text-slate-600">Current User Balance:</span>
              <span className="text-[15px] font-mono font-black text-slate-900">
                UGX {adjustingUser.balanceUGX.toLocaleString()}
              </span>
            </div>

            {adjustError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleSaveAdjustBalance} className="space-y-3.5">
              {/* Type Selection (Add vs Deduct) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                    adjustType === 'add'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  + Add Funds
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('deduct')}
                  className={`py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                    adjustType === 'deduct'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  - Deduct Funds
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Adjustment Amount (UGX)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  min="1"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Audit Reason / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Money merchant manual deposit settlement"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Real-time Resulting Balance Preview */}
              {adjustAmount && !isNaN(Number(adjustAmount)) && Number(adjustAmount) > 0 && (
                <div className="bg-blue-50/70 rounded-2xl p-3 border border-blue-200/80 text-[12px] flex items-center justify-between">
                  <span className="text-blue-900 font-bold">Resulting Balance:</span>
                  <span className="font-mono font-black text-blue-900 text-[14px]">
                    UGX{' '}
                    {(
                      adjustType === 'add'
                        ? adjustingUser.balanceUGX + Number(adjustAmount)
                        : Math.max(0, adjustingUser.balanceUGX - Number(adjustAmount))
                    ).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className={`flex-1 py-2.5 font-bold text-[12.5px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-white disabled:opacity-50 ${
                    adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {adjustLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    `Confirm ${adjustType === 'add' ? 'Credit' : 'Deduction'}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. BLOCK / UNBLOCK CONFIRMATION MODAL */}
      {statusConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                statusConfirmUser.targetStatus === 'blocked'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {statusConfirmUser.targetStatus === 'blocked' ? (
                <Lock className="w-7 h-7" />
              ) : (
                <Unlock className="w-7 h-7" />
              )}
            </div>

            <div>
              <h3 className="text-[17px] font-extrabold text-slate-900">
                {statusConfirmUser.targetStatus === 'blocked' ? 'Block User Account?' : 'Unblock User Account?'}
              </h3>
              <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">
                {statusConfirmUser.targetStatus === 'blocked'
                  ? `Suspending @${statusConfirmUser.user.username} will immediately restrict their ability to deposit, withdraw, or invest, while keeping historical ledgers intact.`
                  : `Unblocking @${statusConfirmUser.user.username} will restore full active trading, deposit, and investment privileges.`}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusConfirmUser(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={statusLoading}
                className={`flex-1 py-2.5 text-white font-bold text-[12.5px] rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                  statusConfirmUser.targetStatus === 'blocked'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" />
                ) : statusConfirmUser.targetStatus === 'blocked' ? (
                  'Yes, Block User'
                ) : (
                  'Yes, Unblock'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE USER CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 p-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-[17px] font-extrabold text-slate-900">
                Delete Account @{deletingUser.username}?
              </h3>
              <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">
                This will safely deactivate the account and revoke all active Supabase sessions for <span className="font-bold text-slate-900">{deletingUser.fullName || deletingUser.username}</span>.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[12.5px] rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleteLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CREATE / EDIT PROJECT MODAL */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-[16px] font-extrabold text-slate-900">
                  {isCreatingProject ? 'Add New Investment Project' : `Edit "${editingProject.title}"`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingProject(null);
                  setIsCreatingProject(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {projectFormError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200">
                {projectFormError}
              </div>
            )}

            <form onSubmit={handleSaveProject} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. SOLAR-MECH 20"
                  value={editingProject.title || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Subtitle / Subsystem
                </label>
                <input
                  type="text"
                  placeholder="e.g. (Dual-Core Autonomous Miner)"
                  value={editingProject.subtitle || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, subtitle: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editingProject.category || 'DS-Mining'}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="DS-Mining">DS-Mining</option>
                    <option value="Clean Energy">Clean Energy</option>
                    <option value="VIP Products">VIP Products</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingProject.status || 'Active'}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Min Investment (UGX)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={editingProject.minInvestUGX || ''}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        minInvestUGX: Number(e.target.value),
                      })
                    }
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Daily Reward (UGX)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 4500"
                    value={editingProject.dailyRewardUGX || ''}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        dailyRewardUGX: Number(e.target.value),
                      })
                    }
                    required
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Estimated Yearly ROI (%)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 120"
                    value={editingProject.estYearlyROI || ''}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        estYearlyROI: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1">
                    Hashrate
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 54.2 TH/s"
                    value={editingProject.hashrate || ''}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        hashrate: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1">
                  Power Source / Hardware Spec
                </label>
                <input
                  type="text"
                  placeholder="e.g. Solar 1.2kW Array + Dual Dynamos"
                  value={editingProject.powerSource || ''}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      powerSource: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Supabase Storage Image Upload & Live Preview */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[12.5px] font-extrabold text-slate-800 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-blue-600" />
                    Project Image (Supabase Storage)
                  </label>
                  {imageUploadSuccess && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Stored in Supabase Storage
                    </span>
                  )}
                </div>

                {/* Live Preview & Upload Button */}
                <div className="flex items-center gap-3.5">
                  <div className="w-20 h-20 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                    <ProjectImage
                      src={editingProject.image}
                      alt={editingProject.title || 'Project Preview'}
                      fallbackCategory={editingProject.category}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageFileUpload(file);
                        }
                      }}
                    />

                    <button
                      type="button"
                      disabled={imageUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-100 active:scale-[0.99] border border-slate-300 hover:border-blue-500 text-slate-800 font-bold text-[12.5px] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                    >
                      {imageUploading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                          <span className="text-blue-700">Uploading to Supabase Storage...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4 text-blue-600" />
                          <span>{editingProject.image ? 'Replace / Upload New Image' : 'Select Image from Device'}</span>
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-slate-500 leading-snug">
                      PNG, JPG, WebP or SVG (max 5 MB). Uploads directly to bucket <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[10.5px] font-mono text-slate-800">project-images</code>.
                    </p>
                  </div>
                </div>

                {/* Upload Error Banner */}
                {imageUploadError && (
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-[11.5px] font-medium border border-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span className="flex-1">{imageUploadError}</span>
                  </div>
                )}

                {/* Image URL Manual Inspection / Fallback Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Direct Public Image URL:
                  </label>
                  <input
                    type="url"
                    placeholder="https://...supabase.co/storage/v1/object/public/project-images/..."
                    value={editingProject.image || ''}
                    onChange={(e) => {
                      setImageUploadSuccess(false);
                      setImageUploadError('');
                      setEditingProject({ ...editingProject, image: e.target.value });
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setIsCreatingProject(false);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={projectFormLoading}
                  className="flex-1 py-2.5 bg-[#1657D9] hover:bg-blue-700 text-white font-bold text-[12.5px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {projectFormLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isCreatingProject ? (
                    'Create Project'
                  ) : (
                    'Save Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
