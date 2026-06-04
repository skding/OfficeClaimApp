'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Users, Settings, Download, LogOut, Key, 
  ShieldCheck, ClipboardCheck, ArrowDownToLine, 
  Trash2, ToggleLeft, ToggleRight, X, Check, Eye, AlertCircle, Loader2
} from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Claim {
  id: string;
  supplierName: string;
  referenceNumber: string;
  date: string;
  amount: number;
  itemDescription: string;
  receiptUrl: string | null;
  status: string;
  userId: string;
  user: {
    name: string;
    username: string;
  };
  account: {
    code: string;
    name: string;
  };
}

type TabType = 'CLAIMS' | 'USERS' | 'ACCOUNTS' | 'EXPORT';

export default function AdminDashboard() {
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('CLAIMS');
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState<{ name: string; username: string } | null>(null);

  // General lists
  const [claims, setClaims] = useState<Claim[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // Loading States
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // Notification / Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Claims Review states
  const [filterClaimsStatus, setFilterClaimsStatus] = useState<string>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [processingClaim, setProcessingClaim] = useState(false);

  // 2. User Management Form States
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('STAFF');
  const [creatingUser, setCreatingUser] = useState(false);

  // 3. Account Management Form States
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  // 4. Bukku Exporter States
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportUserFilter, setExportUserFilter] = useState('');
  const [exportTemplateType, setExportTemplateType] = useState('simple');

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data.user);
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchClaims = async () => {
    setLoadingClaims(true);
    try {
      const res = await fetch('/api/claims');
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClaims(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Load everything
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchProfile();
    fetchClaims();
    fetchUsers();
    fetchAccounts();
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  // Process claim (Approve / Reject)
  const handleProcessClaim = async (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setProcessingClaim(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('status', newStatus);

      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update claim status');
      }

      setSuccessMsg(`Claim status updated to ${newStatus}!`);
      setSelectedClaim(null); // close preview
      fetchClaims();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.message || 'Operation failed.');
    } finally {
      setProcessingClaim(false);
    }
  };

  // Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newUsername || !newPassword || !newName || !newRole) {
      setErrorMsg('All fields are required.');
      return;
    }

    setCreatingUser(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername, 
          password: newPassword, 
          name: newName, 
          role: newRole 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccessMsg('User registered successfully.');
      setNewUsername('');
      setNewPassword('');
      setNewName('');
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.message || 'Failed to register user.');
    } finally {
      setCreatingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user? All their claims will also be deleted.')) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
        setSuccessMsg('User and claims deleted successfully.');
        // If the admin deleted user, refresh claims list
        fetchClaims();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete user.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Account Category
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newAccCode || !newAccName) {
      setErrorMsg('Account code and category name are required.');
      return;
    }

    setCreatingAccount(true);

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newAccCode, name: newAccName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      setSuccessMsg('Account Category added successfully.');
      setNewAccCode('');
      setNewAccName('');
      fetchAccounts();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.message || 'Failed to add account category.');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Toggle Account Active Status
  const handleToggleAccount = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        fetchAccounts();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to update account.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete/Deactivate Account
  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete or deactivate this account category?')) return;

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'Operation successful.');
        fetchAccounts();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(data.error || 'Operation failed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Bukku CSV download
  const handleTriggerExport = () => {
    let url = `/api/admin/export?template=${exportTemplateType}`;
    if (exportStartDate) url += `&startDate=${exportStartDate}`;
    if (exportEndDate) url += `&endDate=${exportEndDate}`;
    if (exportUserFilter) url += `&userId=${exportUserFilter}`;
    
    // Open in a new tab or trigger a window download
    window.open(url, '_blank');
  };

  // Claims Filter
  const filteredClaims = claims.filter(c => {
    if (filterClaimsStatus === 'ALL') return true;
    return c.status === filterClaimsStatus;
  });

  const getStatusClass = (status: string) => {
    if (status === 'APPROVED') return 'badge badge-approved';
    if (status === 'REJECTED') return 'badge badge-rejected';
    return 'badge badge-pending';
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px hsl(var(--primary) / 0.3)'
            }}>
              <FileText size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>Office Claim</h2>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--accent))', fontWeight: 600 }}>ADMIN PORTAL</span>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className={`btn ${activeTab === 'CLAIMS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setActiveTab('CLAIMS')}
            >
              <ClipboardCheck size={18} />
              <span>Claims Review</span>
            </button>
            <button 
              className={`btn ${activeTab === 'USERS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setActiveTab('USERS')}
            >
              <Users size={18} />
              <span>Manage Users</span>
            </button>
            <button 
              className={`btn ${activeTab === 'ACCOUNTS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setActiveTab('ACCOUNTS')}
            >
              <Settings size={18} />
              <span>Chart of Accounts</span>
            </button>
            <button 
              className={`btn ${activeTab === 'EXPORT' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setActiveTab('EXPORT')}
            >
              <Download size={18} />
              <span>Bukku Exporter</span>
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {adminProfile && (
            <div className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem' }}>
              <div style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{adminProfile.name}</div>
              <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>@{adminProfile.username}</div>
            </div>
          )}

          <button 
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
            onClick={() => setIsPassModalOpen(true)}
          >
            <Key size={16} />
            <span style={{ fontSize: '0.85rem' }}>Change Password</span>
          </button>

          <button 
            className="btn btn-danger"
            style={{ width: '100%', justifyContent: 'flex-start', padding: '0.6rem 1rem' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span style={{ fontSize: '0.85rem' }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        {/* Banner Alert Popups */}
        {successMsg && (
          <div className="glass" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: '1px solid hsl(var(--success) / 0.3)',
            backgroundColor: 'hsl(var(--success) / 0.1)',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            color: 'hsl(var(--success))',
            fontSize: '0.9rem'
          }}>
            <Check size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="glass" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            border: '1px solid hsl(var(--danger) / 0.3)',
            backgroundColor: 'hsl(var(--danger) / 0.1)',
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            color: 'hsl(var(--danger))',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dynamic rendering depending on activeTab */}
        
        {/* TAB 1: CLAIMS REVIEW */}
        {activeTab === 'CLAIMS' && (
          <>
            {/* Overview Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              <div className="card glass">
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Pending claims count</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: 'hsl(var(--warning))' }}>
                  {claims.filter(c => c.status === 'PENDING').length} Claims
                </div>
              </div>
              <div className="card glass">
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Pending Approval Value</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  RM {claims.filter(c => c.status === 'PENDING').reduce((acc, c) => acc + c.amount, 0).toFixed(2)}
                </div>
              </div>
              <div className="card glass">
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Total Approved claims (Monthly)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem', color: 'hsl(var(--success))' }}>
                  RM {claims.filter(c => c.status === 'APPROVED').reduce((acc, c) => acc + c.amount, 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Claims Table Review Card */}
            <div className="card glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>Employee Claims Verification</h3>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Click on a claim row to review and approve/reject the submission.</p>
                </div>
                
                {/* Filter buttons */}
                <div className="glass" style={{ display: 'flex', padding: '0.25rem', borderRadius: '8px', gap: '0.25rem' }}>
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                    <button
                      key={st}
                      className="btn"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        background: filterClaimsStatus === st ? 'hsl(var(--bg-main))' : 'transparent',
                        color: filterClaimsStatus === st ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))'
                      }}
                      onClick={() => setFilterClaimsStatus(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {loadingClaims ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={32} className="spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
              ) : filteredClaims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'hsl(var(--text-muted))' }}>
                  <ShieldCheck size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No claims matching this filter.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Reference</th>
                        <th>Account</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim) => (
                        <tr key={claim.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedClaim(claim)}>
                          <td style={{ fontWeight: 600 }}>{claim.user.name}</td>
                          <td>{new Date(claim.date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                          <td>{claim.supplierName}</td>
                          <td><code>{claim.referenceNumber}</code></td>
                          <td style={{ fontSize: '0.85rem' }}><strong>{claim.account.code}</strong> - {claim.account.name}</td>
                          <td style={{ fontWeight: 700 }}>RM {claim.amount.toFixed(2)}</td>
                          <td>
                            <span className={getStatusClass(claim.status)}>{claim.status}</span>
                          </td>
                          <td>
                            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}>
                              <Eye size={12} />
                              <span>Review</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Split Screen interactive reviewer overlay */}
            {selectedClaim && (
              <div className="modal-overlay" onClick={() => setSelectedClaim(null)}>
                <div className="modal-content glass admin-modal-grid" onClick={(e) => e.stopPropagation()} style={{
                  maxWidth: '1000px',
                  width: '95vw',
                  height: '85vh',
                  padding: '1.5rem'
                }}>
                  {/* Left Column: Claim Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.5rem' }}>Review Claim</h3>
                        <span className={getStatusClass(selectedClaim.status)}>{selectedClaim.status}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.5rem', fontSize: '0.95rem' }}>
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Employee:</span>
                          <strong>{selectedClaim.user.name} (@{selectedClaim.user.username})</strong>

                          <span style={{ color: 'hsl(var(--text-muted))' }}>Supplier:</span>
                          <strong>{selectedClaim.supplierName}</strong>

                          <span style={{ color: 'hsl(var(--text-muted))' }}>Reference Number:</span>
                          <code>{selectedClaim.referenceNumber}</code>

                          <span style={{ color: 'hsl(var(--text-muted))' }}>Claim Date:</span>
                          <strong>{new Date(selectedClaim.date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>

                          <span style={{ color: 'hsl(var(--text-muted))' }}>Account Category:</span>
                          <strong>{selectedClaim.account.code} - {selectedClaim.account.name}</strong>
                          
                          <span style={{ color: 'hsl(var(--text-muted))' }}>Amount Claimed:</span>
                          <strong style={{ fontSize: '1.25rem', color: 'hsl(var(--primary))' }}>RM {selectedClaim.amount.toFixed(2)}</strong>
                        </div>

                        <div className="glass" style={{ padding: '1rem', borderRadius: '10px', marginTop: '1rem' }}>
                          <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>Item Description</div>
                          <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{selectedClaim.itemDescription}</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid hsl(var(--border-color))', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedClaim(null)}>
                        Close Review
                      </button>

                      {selectedClaim.status === 'PENDING' && (
                        <>
                          <button 
                            className="btn btn-danger" 
                            style={{ flex: 1.5 }}
                            onClick={() => handleProcessClaim(selectedClaim.id, 'REJECTED')}
                            disabled={processingClaim}
                          >
                            <X size={18} /> Reject Claim
                          </button>
                          <button 
                            className="btn btn-success" 
                            style={{ flex: 1.5 }}
                            onClick={() => handleProcessClaim(selectedClaim.id, 'APPROVED')}
                            disabled={processingClaim}
                          >
                            <Check size={18} /> Approve Claim
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Receipt Image Document Previewer */}
                  <div style={{ 
                    border: '1px solid hsl(var(--border-color))',
                    borderRadius: '12px',
                    height: '100%',
                    backgroundColor: 'hsl(var(--bg-main))',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {selectedClaim.receiptUrl ? (
                      selectedClaim.receiptUrl.endsWith('.pdf') ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <FileText size={64} style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                          <h4 style={{ marginBottom: '1rem' }}>PDF Document Attached</h4>
                          <a 
                            href={selectedClaim.receiptUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-primary"
                            style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
                          >
                            Open PDF in New Tab
                          </a>
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={selectedClaim.receiptUrl} 
                          alt="Receipt document" 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} 
                        />
                      )
                    ) : (
                      <div style={{ color: 'hsl(var(--text-muted))', textAlign: 'center' }}>
                        <X size={48} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                        <p>No receipt image uploaded for this claim.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: MANAGE USERS */}
        {activeTab === 'USERS' && (
          <div className="split-layout split-layout-reverse">
            {/* List of Users */}
            <div className="card glass">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Active Accounts</h3>
              {loadingUsers ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={32} className="spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td>@{u.username}</td>
                          <td>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: u.role === 'ADMIN' ? 'hsl(var(--accent))' : 'hsl(var(--text-secondary))'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td>
                            {adminProfile && u.username !== adminProfile.username ? (
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '0.35rem 0.5rem' }}
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Active Self</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Register New User form */}
            <div className="card glass">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Register New User</h3>
              <form onSubmit={handleAddUser}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. Tan Ah Kow"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={creatingUser}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. ahkow.tan"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    disabled={creatingUser}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter account password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={creatingUser}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">User Role</label>
                  <select 
                    className="form-input form-select"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    disabled={creatingUser}
                  >
                    <option value="STAFF">STAFF (Can record and edit own claims)</option>
                    <option value="ADMIN">ADMIN (Full access: approve claims, manage codes, exports)</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={creatingUser}>
                  {creatingUser ? <Loader2 size={16} className="spin" /> : 'Register User'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: ACCOUNT CATEGORIES CONFIG */}
        {activeTab === 'ACCOUNTS' && (
          <div className="split-layout split-layout-reverse">
            {/* Table of Accounts */}
            <div className="card glass">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Bukku Expense accounts</h3>
              {loadingAccounts ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={32} className="spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Category Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((acc) => (
                        <tr key={acc.id} style={{ opacity: acc.isActive ? 1 : 0.6 }}>
                          <td><code><strong>{acc.code}</strong></code></td>
                          <td style={{ fontWeight: 600 }}>{acc.name}</td>
                          <td>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: acc.isActive ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' }}
                              onClick={() => handleToggleAccount(acc.id, acc.isActive)}
                            >
                              {acc.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            </button>
                          </td>
                          <td>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '0.35rem 0.5rem' }}
                              onClick={() => handleDeleteAccount(acc.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Register New Account Category */}
            <div className="card glass">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Create Account code</h3>
              <form onSubmit={handleAddAccount}>
                <div className="form-group">
                  <label className="form-label">Account Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. 6001, 6025"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    disabled={creatingAccount}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Category Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. Petrol & Toll, Entertainment"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    disabled={creatingAccount}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={creatingAccount}>
                  {creatingAccount ? <Loader2 size={16} className="spin" /> : 'Add Account code'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: BUKKU EXPORTER */}
        {activeTab === 'EXPORT' && (
          <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
            <div className="card glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid hsl(var(--border-color))', paddingBottom: '1rem' }}>
                <ArrowDownToLine size={24} style={{ color: 'hsl(var(--accent))' }} />
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>Export Approved claims to Bukku</h3>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Configure parameters below to generate a Bukku-compatible CSV import template.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Filter Employee (Optional)</label>
                  <select
                    className="form-input form-select"
                    value={exportUserFilter}
                    onChange={(e) => setExportUserFilter(e.target.value)}
                  >
                    <option value="">-- All Employees --</option>
                    {users.filter(u => u.role === 'STAFF').map(u => (
                      <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Bukku Template Format</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                    
                    <label className="glass" style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: exportTemplateType === 'simple' ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border-color))',
                      backgroundColor: exportTemplateType === 'simple' ? 'hsl(var(--primary) / 0.05)' : 'transparent'
                    }}>
                      <input
                        type="radio"
                        name="templateType"
                        value="simple"
                        checked={exportTemplateType === 'simple'}
                        onChange={() => setExportTemplateType('simple')}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Simple Template</div>
                        <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Basic fields: Employee, Account, Descr, Amount</div>
                      </div>
                    </label>

                    <label className="glass" style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: exportTemplateType === 'extended' ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border-color))',
                      backgroundColor: exportTemplateType === 'extended' ? 'hsl(var(--primary) / 0.05)' : 'transparent'
                    }}>
                      <input
                        type="radio"
                        name="templateType"
                        value="extended"
                        checked={exportTemplateType === 'extended'}
                        onChange={() => setExportTemplateType('extended')}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Extended Template</div>
                        <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Full details: Supplier, qty, discounts, unit prices</div>
                      </div>
                    </label>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleTriggerExport}
                  style={{ width: '100%', padding: '0.85rem' }}
                >
                  <ArrowDownToLine size={18} />
                  <span>Download Bukku Expense claim CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={isPassModalOpen} 
        onClose={() => setIsPassModalOpen(false)} 
      />

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
