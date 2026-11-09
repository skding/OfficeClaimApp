'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, Plus, LogOut, Key, FileCheck, ClipboardList, 
  Upload, Camera, Loader2, Sparkles, Trash2, Calendar, 
  DollarSign, Hash, Tag, FileClock, Check, X, AlertCircle, ShieldCheck
} from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

interface Account {
  id: string;
  code: string;
  name: string;
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
  claimType?: string;
  accountId: string;
  account: Account;
  isArchived?: boolean;
  isStaffArchived?: boolean;
}

export default function StaffDashboard() {
  const router = useRouter();
  
  // States
  const [claims, setClaims] = useState<Claim[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; username: string } | null>(null);
  
  // Form States
  const [claimType, setClaimType] = useState<'EXPENSE' | 'PAYROLL'>('EXPENSE');
  const [supplierName, setSupplierName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  // Interaction/UX States
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Highlighted fields after AI extraction
  const [aiHighlightedFields, setAiHighlightedFields] = useState<string[]>([]);
  
  // Camera Capture States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
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

  // Fetch initial profile, accounts, and claims
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchProfile();
    fetchAccounts();
    fetchClaims();
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

  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setFilePreview(URL.createObjectURL(file) + '#' + file.name);
      } else {
        setFilePreview(null);
      }
    }
  };

  const clearForm = () => {
    setClaimType('EXPENSE');
    setSupplierName('');
    setReferenceNumber('');
    setDate('');
    setAccountId('');
    setItemDescription('');
    setAmount('');
    setSelectedFile(null);
    setFilePreview(null);
    setErrorMsg('');
    setAiHighlightedFields([]);
    setSelectedClaim(null);
  };

  // Google Document AI scanner trigger
  const runAIScanner = async () => {
    if (!selectedFile) {
      setErrorMsg('Please upload or snap a receipt first before scanning with AI.');
      return;
    }

    setScanning(true);
    setErrorMsg('');
    setAiHighlightedFields([]);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan receipt');
      }

      // Populate form fields
      const highlights: string[] = [];
      
      if (data.supplierName) {
        setSupplierName(data.supplierName);
        highlights.push('supplierName');
      }
      if (data.referenceNumber) {
        setReferenceNumber(data.referenceNumber);
        highlights.push('referenceNumber');
      }
      if (data.date) {
        setDate(data.date);
        highlights.push('date');
      }
      if (data.amount) {
        setAmount(data.amount.toString());
        highlights.push('amount');
      }
      if (data.itemDescription) {
        setItemDescription(data.itemDescription);
        highlights.push('itemDescription');
      }

      setAiHighlightedFields(highlights);
      setSuccessMsg('OCR Data auto-filled successfully! Please review the fields.');
      setTimeout(() => setSuccessMsg(''), 4000);

      // Clean up highlights after animation
      setTimeout(() => {
        setAiHighlightedFields([]);
      }, 5000);

    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.message || 'AI scanning failed. Please enter details manually.');
    } finally {
      setScanning(false);
    }
  };

  // Camera Functions
  const startCamera = async () => {
    setErrorMsg('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Could not access device camera. Please upload file manually.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Match canvas size to video aspect ratio
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedFile(file);
            setFilePreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // Submit Claim handler
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!supplierName || !referenceNumber || !date || !accountId || !itemDescription || !amount) {
      setErrorMsg('All claim fields are required.');
      return;
    }

    setLoadingSubmit(true);

    try {
      const formData = new FormData();
      formData.append('claimType', claimType);
      formData.append('supplierName', supplierName);
      formData.append('referenceNumber', referenceNumber);
      formData.append('date', date);
      formData.append('accountId', accountId);
      formData.append('itemDescription', itemDescription);
      formData.append('amount', amount);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      let url = '/api/claims';
      let method = 'POST';

      // Edit state
      if (selectedClaim) {
        url = `/api/claims/${selectedClaim.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit claim');
      }

      setSuccessMsg(selectedClaim ? 'Claim updated successfully!' : 'Claim submitted successfully!');
      clearForm();
      setIsCreating(false);
      fetchClaims();

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.message || 'Submission failed. Please check form fields.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Delete Draft Claim handler
  const handleDeleteClaim = async (id: string) => {
    if (!confirm('Are you sure you want to delete this claim?')) return;

    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setClaims(claims.filter(c => c.id !== id));
        setSuccessMsg('Claim deleted successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete claim');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Staff Archive/Unarchive Claim handler
  const handleArchiveClaim = async (id: string, archiveState: boolean = true) => {
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('isStaffArchived', archiveState ? 'true' : 'false');

      const res = await fetch(`/api/claims/${id}`, {
        method: 'PUT',
        body: formData,
      });

      if (res.ok) {
        setSuccessMsg(archiveState ? 'Claim archived successfully.' : 'Claim restored from archive.');
        fetchClaims();
        if (selectedClaim && selectedClaim.id === id) {
          setIsCreating(false);
          clearForm();
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to update archive status');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Operation failed');
    }
  };

  // Click on a claim to view/edit
  const handleSelectClaimForEdit = (claim: Claim) => {
    setSelectedClaim(claim);
    setClaimType(claim.claimType === 'PAYROLL' ? 'PAYROLL' : 'EXPENSE');
    setSupplierName(claim.supplierName);
    setReferenceNumber(claim.referenceNumber);
    setDate(claim.date.split('T')[0]);
    setAccountId(claim.accountId);
    setItemDescription(claim.itemDescription);
    setAmount(claim.amount.toString());
    setFilePreview(claim.receiptUrl);
    setSelectedFile(null); // Reset file upload unless replaced
    setIsCreating(true);
  };

  // Filtering claims list
  const filteredClaims = claims.filter(c => {
    const isArchived = Boolean(c.isStaffArchived || c.isArchived);
    if (filterStatus === 'ARCHIVED') {
      return isArchived;
    }
    if (isArchived) {
      return false; // Exclude archived claims from active views
    }
    if (filterStatus === 'ALL') return true;
    return c.status === filterStatus;
  });

  const getStatusClass = (status: string) => {
    if (status === 'APPROVED') return 'badge badge-approved';
    if (status === 'REJECTED') return 'badge badge-rejected';
    return 'badge badge-pending';
  };

  const getFieldPulseStyle = (fieldName: string) => {
    if (aiHighlightedFields.includes(fieldName)) {
      return {
        borderColor: 'hsl(var(--accent))',
        boxShadow: '0 0 12px hsl(var(--accent) / 0.5)',
        animation: 'pulseGlow 2s infinite',
        transition: 'all 0.5s ease',
      };
    }
    return {};
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--accent))', fontWeight: 600 }}>STAFF PORTAL</span>
                <span style={{ fontSize: '0.65rem', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '1px 5px', color: 'hsl(var(--text-muted))' }}>v1.0.0</span>
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className={`btn ${!isCreating ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setIsCreating(false); clearForm(); }}
            >
              <ClipboardList size={18} />
              <span>My Claims</span>
            </button>
            <button 
              className={`btn ${isCreating && !selectedClaim ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setIsCreating(true); clearForm(); }}
            >
              <Plus size={18} />
              <span>New Claim</span>
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {userProfile && (
            <div className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.85rem' }}>
              <div style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{userProfile.name}</div>
              <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>@{userProfile.username}</div>
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
        {/* Banner header alerts */}
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

        {/* View toggled */}
        {!isCreating ? (
          <>
            {/* Summary Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
              <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ 
                  background: 'hsl(var(--warning) / 0.15)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  color: 'hsl(var(--warning))'
                }}>
                  <FileClock size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Pending Claims</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                    RM {claims.filter(c => c.status === 'PENDING').reduce((acc, c) => acc + c.amount, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="card glass" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ 
                  background: 'hsl(var(--success) / 0.15)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  color: 'hsl(var(--success))'
                }}>
                  <FileCheck size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>Approved (This Month)</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                    RM {claims.filter(c => c.status === 'APPROVED').reduce((acc, c) => acc + c.amount, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Claims Table Header / Search */}
            <div className="card glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Expense Claims History</h3>
                
                {/* Filter buttons */}
                <div className="glass" style={{ display: 'flex', padding: '0.25rem', borderRadius: '8px', gap: '0.25rem' }}>
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'].map((st) => (
                    <button
                      key={st}
                      className="btn"
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        background: filterStatus === st ? 'hsl(var(--bg-main))' : 'transparent',
                        color: filterStatus === st ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))'
                      }}
                      onClick={() => setFilterStatus(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Claims List Table */}
              {loadingClaims ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={32} className="spin" style={{ color: 'hsl(var(--primary))' }} />
                </div>
              ) : filteredClaims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'hsl(var(--text-muted))' }}>
                  <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No claims found matching this filter.</p>
                  <button 
                    className="btn btn-primary" 
                    style={{ marginTop: '1rem' }}
                    onClick={() => setIsCreating(true)}
                  >
                    Create Your First Claim
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Supplier</th>
                        <th>Ref / Invoice</th>
                        <th>Account Category</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim) => {
                        const isClaimArchived = Boolean(claim.isStaffArchived || claim.isArchived);
                        return (
                          <tr key={claim.id}>
                            <td>{new Date(claim.date).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: claim.claimType === 'PAYROLL' ? 'hsl(150, 45%, 18%)' : 'hsl(var(--bg-card))',
                                color: claim.claimType === 'PAYROLL' ? '#86efac' : 'hsl(var(--text-secondary))',
                                border: '1px solid hsl(var(--border-color))',
                                whiteSpace: 'nowrap'
                              }}>
                                {claim.claimType === 'PAYROLL' ? 'Site Allowance' : 'Expense'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{claim.supplierName}</td>
                            <td><code>{claim.referenceNumber}</code></td>
                            <td>
                              <span style={{ fontSize: '0.85rem' }}>
                                <strong>{claim.account.code}</strong> - {claim.account.name}
                              </span>
                            </td>
                            <td>{claim.itemDescription}</td>
                            <td style={{ fontWeight: 700 }}>RM {claim.amount.toFixed(2)}</td>
                            <td>
                              <span className={getStatusClass(claim.status)}>{claim.status}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                                  onClick={() => handleSelectClaimForEdit(claim)}
                                >
                                  View / Edit
                                </button>

                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                  onClick={() => handleArchiveClaim(claim.id, !isClaimArchived)}
                                  title={isClaimArchived ? 'Restore to active claims' : 'Move to archived'}
                                >
                                  <ShieldCheck size={13} />
                                  <span>{isClaimArchived ? 'Unarchive' : 'Archive'}</span>
                                </button>
                                
                                {claim.status === 'PENDING' && (
                                  <button 
                                    className="btn btn-danger" 
                                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                                    onClick={() => handleDeleteClaim(claim.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Split View for Editing / Creating */
          <div className="split-layout split-layout-form">
            
            {/* Form Section */}
            <div className="card glass">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>
                  {selectedClaim ? `Edit Claim (${selectedClaim.status})` : 'New Expense Claim'}
                </h3>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={clearForm}>
                  Clear Form
                </button>
              </div>

              <form onSubmit={handleSubmitClaim}>
                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Tag size={14} /> Claim Category / Type
                    </span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`btn ${claimType === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        borderRadius: '8px',
                        border: claimType === 'EXPENSE' ? 'none' : '1px solid hsl(var(--border-color))',
                      }}
                      onClick={() => setClaimType('EXPENSE')}
                      disabled={(selectedClaim && selectedClaim.status !== 'PENDING') || loadingSubmit}
                    >
                      <Tag size={14} />
                      <span>Expense Claim</span>
                    </button>
                    <button
                      type="button"
                      className={`btn ${claimType === 'PAYROLL' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        borderRadius: '8px',
                        border: claimType === 'PAYROLL' ? 'none' : '1px solid hsl(var(--border-color))',
                      }}
                      onClick={() => setClaimType('PAYROLL')}
                      disabled={(selectedClaim && selectedClaim.status !== 'PENDING') || loadingSubmit}
                    >
                      <DollarSign size={14} />
                      <span>Site Allowance (Payroll)</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '0.35rem' }}>
                    {claimType === 'PAYROLL'
                      ? 'Note: Site Allowance is part of payroll and will be grouped separately in summaries and excluded from Bukku export.'
                      : 'Standard expense claim to be processed and exported to Bukku.'}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Tag size={14} /> Supplier Name
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. Grab Holdings, Shell, Maxis"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    style={getFieldPulseStyle('supplierName')}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Hash size={14} /> Invoice / Receipt / Reference Number
                    </span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g. INV-998811"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    style={getFieldPulseStyle('referenceNumber')}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} /> Receipt Date
                    </span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={getFieldPulseStyle('date')}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Account Category (Chart of Accounts)</label>
                  <select
                    className="form-input form-select"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  >
                    <option value="">-- Select Bukku Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Item / Claim Description</label>
                  <textarea
                    rows={3}
                    className="form-input"
                    placeholder="Provide details about the purchase, project usage, travel purpose, etc."
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    style={{ ...getFieldPulseStyle('itemDescription'), resize: 'vertical' }}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <DollarSign size={14} /> Amount (RM)
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={getFieldPulseStyle('amount')}
                    disabled={selectedClaim && selectedClaim.status !== 'PENDING' || loadingSubmit}
                  />
                </div>

                {/* Bottom submit button */}
                {(!selectedClaim || selectedClaim.status === 'PENDING') ? (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flex: 1 }}
                      onClick={() => { setIsCreating(false); clearForm(); }}
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ flex: 2 }}
                      disabled={loadingSubmit}
                    >
                      {loadingSubmit ? <Loader2 size={16} className="spin" /> : (selectedClaim ? 'Save Changes' : 'Submit Claim')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flex: 1 }}
                      onClick={() => { setIsCreating(false); clearForm(); }}
                    >
                      Back
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                      onClick={() => handleArchiveClaim(selectedClaim.id, !(selectedClaim.isStaffArchived || selectedClaim.isArchived))}
                    >
                      <ShieldCheck size={16} />
                      <span>{(selectedClaim.isStaffArchived || selectedClaim.isArchived) ? 'Unarchive Claim' : 'Archive Claim'}</span>
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Document Review & AI Scan Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card glass" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h4 style={{ fontSize: '1.1rem' }}>Receipt File Upload & AI OCR</h4>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  Upload a photo of the receipt or snap a new image. Click the AI button to auto-fill the form using Document AI Expense Parser.
                </p>

                {/* Dropzone area */}
                {(!selectedClaim || selectedClaim.status === 'PENDING') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    
                    {/* Manual Upload */}
                    <label style={{
                      border: '2px dashed hsl(var(--border-color))',
                      borderRadius: '12px',
                      padding: '1.5rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: 'hsl(var(--bg-main) / 0.4)'
                    }}>
                      <Upload size={24} style={{ color: 'hsl(var(--primary))' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Choose File</span>
                      <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Image or PDF</span>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>

                    {/* Camera Snap */}
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        height: 'auto',
                        border: '2px dashed hsl(var(--border-color))',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'hsl(var(--bg-main) / 0.4)'
                      }}
                      onClick={startCamera}
                    >
                      <Camera size={24} style={{ color: 'hsl(var(--accent))' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Take Photo</span>
                      <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>Use Device Camera</span>
                    </button>
                  </div>
                )}

                {/* Web Camera interface overlay */}
                {isCameraActive && (
                  <div className="glass" style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid hsl(var(--border-color))',
                    padding: '0.5rem',
                    backgroundColor: 'black'
                  }}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} 
                    />
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '1rem', 
                      left: '0', 
                      right: '0', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      gap: '1rem' 
                    }}>
                      <button type="button" className="btn btn-success" onClick={capturePhoto}>
                        Snap Receipt
                      </button>
                      <button type="button" className="btn btn-danger" onClick={stopCamera}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* File Preview */}
                {filePreview && (
                  <div style={{
                    border: '1px solid hsl(var(--border-color))',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    backgroundColor: 'hsl(var(--bg-main))',
                    minHeight: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {filePreview.toLowerCase().includes('.pdf') ? (
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <FileText size={48} style={{ color: 'hsl(var(--primary))', marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>PDF Receipt Attached</div>
                        {selectedFile && <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>{selectedFile.name}</div>}
                        <a 
                          href={filePreview} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-secondary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'inline-block' }}
                        >
                          Open PDF in New Tab
                        </a>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={filePreview} 
                        alt="Receipt preview" 
                        style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }} 
                      />
                    )}

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '0.5rem',
                          background: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          color: 'white',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}

                {/* AI scan trigger button */}
                {selectedFile && !selectedClaim && (
                  <button 
                    type="button" 
                    className="btn btn-ai"
                    onClick={runAIScanner}
                    disabled={scanning}
                    style={{ width: '100%' }}
                  >
                    {scanning ? (
                      <>
                        <Loader2 size={18} className="spin" />
                        <span>AI Scanning & Extracting data...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Auto-Fill with Google Document AI</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Change Password Dialog overlay */}
      <ChangePasswordModal 
        isOpen={isPassModalOpen} 
        onClose={() => setIsPassModalOpen(false)} 
      />

      <style jsx global>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0px hsl(var(--accent) / 0); }
          50% { box-shadow: 0 0 12px hsl(var(--accent) / 0.5); }
          100% { box-shadow: 0 0 0px hsl(var(--accent) / 0); }
        }
      `}</style>
    </div>
  );
}
