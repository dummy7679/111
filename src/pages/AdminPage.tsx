import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  QrCode, 
  Search, 
  CheckCircle,
  LogOut,
  Eye,
  CreditCard,
  Settings,
  BarChart3,
  UserSearch,
  TrendingUp,
  DollarSign,
  Stethoscope
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { QRScanner } from '../components/QRScanner';
import { PatientLookup } from '../components/PatientLookup';
import { PatientDetailModal } from '../components/PatientDetailModal';
import { SettingsPanel } from '../components/SettingsPanel';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { useQueue } from '../hooks/useQueue';
import { useAnalytics } from '../hooks/useAnalytics';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import { useTranslation } from '../lib/translations';
import { supabase } from '../lib/supabase';
import { Visit, Patient, PaymentTransaction } from '../types';
import { formatTime, formatRelativeTime, getStatusColor, getPaymentStatusColor } from '../lib/utils';
import { QRPayload, parseQRCode } from '../lib/qr';

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const { visits, queueStatus, loading: queueLoading, refetch } = useQueue();
  const { analytics, loading: analyticsLoading } = useAnalytics();
  
  const [showScanner, setShowScanner] = useState(false);
  const [showPatientLookup, setShowPatientLookup] = useState(false);
  const [showPatientDetail, setShowPatientDetail] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      refetch();
      console.log('Auto-refresh triggered at:', new Date().toLocaleTimeString());
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refreshInterval, refetch]);

  // Load refresh settings
  useEffect(() => {
    const loadRefreshSettings = async () => {
      try {
        const { data } = await supabase
          .from('clinic_settings')
          .select('setting_value')
          .eq('setting_key', 'auto_refresh_interval')
          .single();
        
        if (data) {
          setRefreshInterval(data.setting_value);
        }
      } catch (error) {
        console.log('Using default refresh interval');
      }
    };
    
    if (user) {
      loadRefreshSettings();
    }
  }, [user]);

  // Real-time updates
  useRealTimeUpdates(() => {
    if (autoRefreshEnabled) {
      refetch();
    }
  });

  // If not authenticated, show login form
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center text-gray-900">{t('admin_login')}</h1>
            <p className="text-center text-gray-600 text-sm mt-2">
              Use your Supabase admin credentials to access the dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginLoading(true);
                try {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email: loginForm.email,
                    password: loginForm.password,
                  });
                  if (error) throw error;
                } catch (error: any) {
                  alert(error.message || 'Login failed. Please check your credentials.');
                } finally {
                  setLoginLoading(false);
                }
              }}
              className="space-y-4"
            >
              <Input
                label="Email"
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter your password"
                required
              />
              <Button type="submit" loading={loginLoading} className="w-full">
                Sign In
              </Button>
              <div className="text-center text-sm text-gray-600 mt-4">
                <p>Demo credentials:</p>
                <p>Email: admin@clinic.com</p>
                <p>Password: admin123</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || queueLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const handleQRScan = async (payload: QRPayload) => {
    try {
      setError('');
      // Find the visit by QR payload
      const { data: visits, error } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients(*),
          doctor:doctors(*)
        `)
        .eq('stn', payload.stn)
        .eq('visit_date', payload.visit_date);

      if (error) {
        console.error('QR scan error:', error);
        setError('Error scanning QR code. Please try again.');
        return;
      }

      const visit = visits?.find(v => {
        try {
          const qrData = JSON.parse(v.qr_payload);
          return qrData.uid === payload.uid;
        } catch {
          return false;
        }
      });

      if (!visit) {
        setError('Visit not found. Please check the QR code.');
        return;
      }

      // Check if visit is from today
      const today = new Date().toISOString().split('T')[0];
      if (visit.visit_date !== today) {
        setError('This QR code is not valid for today.');
        return;
      }

      // Update status to checked_in if currently waiting
      if (visit.status === 'waiting') {
        const { error: updateError } = await supabase
          .from('visits')
          .update({ 
            status: 'checked_in',
            checked_in_at: new Date().toISOString()
          })
          .eq('id', visit.id);

        if (updateError) {
          console.error('Error updating visit:', updateError);
          setError('Failed to check in patient. Please try again.');
          return;
        } else {
          refetch();
          setSuccess('Patient checked in successfully!');
        }
      }

      setSelectedVisit(visit);
      setShowVisitModal(true);
      setShowScanner(false);
    } catch (error) {
      console.error('Error handling QR scan:', error);
      setError('Error processing QR code. Please try again.');
    }
  };

  const processPayment = async (visitId: string, amount: number, method: string = 'cash') => {
    try {
      setError('');
      const visit = visits.find(v => v.id === visitId);
      if (!visit) {
        throw new Error('Visit not found');
      }

      // Create payment transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          visit_id: visitId,
          patient_id: visit.patient_id,
          amount: amount,
          payment_method: method,
          status: 'completed',
          processed_by: user?.id,
          processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update visit payment status
      const { error: visitError } = await supabase
        .from('visits')
        .update({ payment_status: 'paid' })
        .eq('id', visitId);

      if (visitError) throw visitError;

      // Log audit action
      await logAuditAction('PROCESS_PAYMENT', 'visit', visitId, { 
        amount,
        method,
        transaction_id: transaction.id 
      });

      setSuccess(`Payment of ₹${amount} processed successfully`);
      refetch();
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('cash');
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setError(error.message || 'Failed to process payment');
    }
  };

  const logAuditAction = async (action: string, resourceType: string, resourceId: string, payload?: any) => {
    try {
      await supabase
        .from('audit_logs')
        .insert({
          actor_id: user?.id,
          action_type: action,
          action_payload: payload,
          resource_type: resourceType,
          resource_id: resourceId
        });
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  const updateVisitStatus = async (visitId: string, status: string) => {
    try {
      setError('');
      const updates: any = { status };
      
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else if (status === 'checked_in') {
        updates.checked_in_at = new Date().toISOString();
      } else if (status === 'in_service') {
        updates.checked_in_at = updates.checked_in_at || new Date().toISOString();
      }

      const { error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', visitId);

      if (error) throw error;

      // Log audit action
      await logAuditAction('UPDATE_VISIT_STATUS', 'visit', visitId, { 
        old_status: visits.find(v => v.id === visitId)?.status,
        new_status: status 
      });

      setSuccess(`Visit status updated to ${status.replace('_', ' ')}`);
      refetch();
    } catch (error) {
      console.error('Error updating visit status:', error);
      setError('Failed to update status');
    }
  };

  const updatePaymentStatus = async (visitId: string, paymentStatus: string) => {
    try {
      setError('');
      const { error } = await supabase
        .from('visits')
        .update({ payment_status: paymentStatus })
        .eq('id', visitId);

      if (error) throw error;

      // Log audit action
      await logAuditAction('UPDATE_PAYMENT_STATUS', 'visit', visitId, { 
        old_payment_status: visits.find(v => v.id === visitId)?.payment_status,
        new_payment_status: paymentStatus 
      });

      setSuccess(`Payment status updated to ${paymentStatus.replace('_', ' ')}`);
      refetch();
    } catch (error) {
      console.error('Error updating payment status:', error);
      setError('Failed to update payment status');
    }
  };

  // Filter visits based on search and filters
  const filteredVisits = visits.filter(visit => {
    const matchesSearch = !searchQuery || 
      visit.stn.toString().includes(searchQuery) ||
      visit.patient?.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.patient?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.patient?.phone.includes(searchQuery);

    const matchesStatus = !statusFilter || visit.status === statusFilter;
    const matchesDepartment = !departmentFilter || visit.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const departments = Array.from(new Set(visits.map(v => v.department)));
  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map(dept => ({ value: dept, label: dept.charAt(0).toUpperCase() + dept.slice(1) }))
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'checked_in', label: 'Checked In' },
    { value: 'in_service', label: 'In Service' },
    { value: 'completed', label: 'Completed' },
    { value: 'held', label: 'On Hold' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">{t('admin_dashboard')}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <div className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  id="auto-refresh"
                  checked={autoRefreshEnabled}
                  onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="auto-refresh" className="text-gray-600">
                  Auto Refresh ({refreshInterval}s)
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                >
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                </select>
              </div>
              <Button 
                onClick={() => setShowScanner(true)}
                size="sm"
              >
                <QrCode className="mr-2 h-4 w-4" />
                {t('scan_qr')}
              </Button>
              <Button 
                onClick={() => setShowPatientLookup(true)}
                variant="outline"
                size="sm"
              >
                <UserSearch className="mr-2 h-4 w-4" />
                {t('patient_lookup')}
              </Button>
              <Button 
                onClick={() => setShowSettings(true)}
                variant="outline"
                size="sm"
              >
                <Settings className="mr-2 h-4 w-4" />
                {t('settings')}
              </Button>
              <Button variant="outline" onClick={() => signOut()} size="sm">
                <LogOut className="mr-2 h-4 w-4" />
                {t('sign_out')}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.open('/doctor', '_blank')}
                size="sm"
              >
                <Stethoscope className="mr-2 h-4 w-4" />
                Doctor Room
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('now_serving')}</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStatus.now_serving}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('total_waiting')}</p>
                  <p className="text-2xl font-bold text-gray-900">{queueStatus.total_waiting}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('completed_today')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {visits.filter(v => v.status === 'completed').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('total_visits')}</p>
                  <p className="text-2xl font-bold text-gray-900">{visits.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('today_revenue')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{analytics?.today.revenue.toFixed(0) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('avg_wait')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics?.today.average_wait_time || 15}m
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Weekly Visits Trend
                </h3>
              </CardHeader>
              <CardContent>
                <div className="h-32 flex items-end space-x-2">
                  {analytics.weekly.visits_trend.map((count, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t"
                        style={{ 
                          height: `${Math.max(4, (count / Math.max(...analytics.weekly.visits_trend)) * 100)}px` 
                        }}
                      ></div>
                      <span className="text-xs text-gray-600 mt-1">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Weekly Revenue Trend
                </h3>
              </CardHeader>
              <CardContent>
                <div className="h-32 flex items-end space-x-2">
                  {analytics.weekly.revenue_trend.map((amount, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-green-500 rounded-t"
                        style={{ 
                          height: `${Math.max(4, (amount / Math.max(...analytics.weekly.revenue_trend)) * 100)}px` 
                        }}
                      ></div>
                      <span className="text-xs text-gray-600 mt-1">₹{amount.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search by STN, UID, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="md:col-span-2"
              />
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="Filter by status"
              />
              <Select
                options={departmentOptions}
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                placeholder="Filter by department"
              />
            </div>
          </CardContent>
        </Card>

        {/* Queue Table */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">{t('todays_queue')}</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('token')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('patient')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('department')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('payment')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('time')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-gray-900">#{visit.stn}</div>
                        <div className="text-sm text-gray-500">{visit.patient?.uid}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {visit.patient?.name}
                          <button
                            onClick={() => {
                              setSelectedPatientId(visit.patient_id);
                              setShowPatientDetail(true);
                            }}
                            className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            View Profile
                          </button>
                        </div>
                        <div className="text-sm text-gray-500">
                          Age: {visit.patient?.age} | {visit.patient?.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">
                          {visit.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(visit.status)}`}>
                          {visit.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(visit.payment_status)}`}>
                          {visit.payment_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{formatTime(visit.created_at)}</div>
                        <div>{formatRelativeTime(visit.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedVisit(visit);
                              setShowVisitModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {visit.status === 'waiting' && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                await updateVisitStatus(visit.id, 'checked_in');
                              }}
                            >
                              {t('check_in')}
                            </Button>
                          )}
                          
                          {visit.status === 'checked_in' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                await updateVisitStatus(visit.id, 'in_service');
                              }}
                            >
                              {t('start_service')}
                            </Button>
                          )}
                          
                          {visit.status === 'in_service' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                await updateVisitStatus(visit.id, 'completed');
                              }}
                            >
                              {t('complete')}
                            </Button>
                          )}

                          {visit.payment_status === 'pay_at_clinic' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                setSelectedVisit(visit);
                                // Get department fee
                                const { data: dept } = await supabase.from('departments').select('consultation_fee').eq('name', visit.department).single();
                                setPaymentAmount((dept?.consultation_fee || 500).toString());
                                setShowPaymentModal(true);
                              }}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {visit.payment_status === 'pending' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                await updatePaymentStatus(visit.id, 'paid');
                              }}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              {t('mark_paid')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredVisits.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">{t('no_visits_found')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Patient Lookup Modal */}
      <PatientLookup
        isOpen={showPatientLookup}
        onClose={() => setShowPatientLookup(false)}
      />

      {/* Patient Detail Modal */}
      <PatientDetailModal
        isOpen={showPatientDetail}
        onClose={() => setShowPatientDetail(false)}
        patientId={selectedPatientId}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Visit Details Modal */}
      <Modal
        isOpen={showVisitModal}
        onClose={() => setShowVisitModal(false)}
        title="Patient Details"
        size="lg"
      >
        {selectedVisit && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Patient Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Patient ID:</span>
                    <span className="font-medium">{selectedVisit.patient?.uid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{selectedVisit.patient?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Age:</span>
                    <span className="font-medium">{selectedVisit.patient?.age}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{selectedVisit.patient?.phone}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Visit Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Token Number:</span>
                    <span className="font-bold text-lg">#{selectedVisit.stn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium capitalize">{selectedVisit.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedVisit.status)}`}>
                      {selectedVisit.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(selectedVisit.payment_status)}`}>
                      {selectedVisit.payment_status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Booked At:</span>
                    <span className="font-medium">{formatTime(selectedVisit.created_at)}</span>
                  </div>
                  {selectedVisit.checked_in_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Checked In:</span>
                      <span className="font-medium">{formatTime(selectedVisit.checked_in_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setShowVisitModal(false)}
                className="flex-1"
              >
                Close
              </Button>
              
              {selectedVisit.status === 'waiting' && (
                <Button
                  onClick={async () => {
                    await updateVisitStatus(selectedVisit.id, 'checked_in');
                    setShowVisitModal(false);
                  }}
                  className="flex-1"
                >
                  Check In
                </Button>
              )}
              
              {selectedVisit.status === 'checked_in' && (
                <Button
                  onClick={async () => {
                    await updateVisitStatus(selectedVisit.id, 'in_service');
                    setShowVisitModal(false);
                  }}
                  className="flex-1"
                >
                  Start Service
                </Button>
              )}
              
              {selectedVisit.status === 'in_service' && (
                <Button
                  onClick={async () => {
                    await updateVisitStatus(selectedVisit.id, 'completed');
                    setShowVisitModal(false);
                  }}
                  className="flex-1"
                >
                  Complete
                </Button>
              )}
              
              {selectedVisit.payment_status === 'pay_at_clinic' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    // Get department fee
                    const dept = departmentStats.find(d => d.department === selectedVisit.department);
                    setPaymentAmount((dept?.consultation_fee || 500).toString());
                    setShowPaymentModal(true);
                  }}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Process Payment
                </Button>
              )}
              
              {selectedVisit.payment_status === 'pending' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await updatePaymentStatus(selectedVisit.id, 'paid');
                    setShowVisitModal(false);
                  }}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Processing Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentAmount('');
          setPaymentMethod('cash');
        }}
        title="Process Payment"
        size="md"
      >
        {selectedVisit && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Patient Details</h4>
              <p className="text-sm text-gray-600">
                {selectedVisit.patient?.name} - Token #{selectedVisit.stn}
              </p>
              <p className="text-sm text-gray-600 capitalize">
                {selectedVisit.department} Department
              </p>
            </div>

            <Input
              label="Payment Amount (₹)"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter amount"
              min="0"
              step="0.01"
              required
            />

            <Select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'upi', label: 'UPI' },
                { value: 'online', label: 'Online' },
                { value: 'insurance', label: 'Insurance' }
              ]}
              required
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentMethod('cash');
                  setError('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
                    setError('Please enter a valid amount');
                    return;
                  }
                  setError('');
                  await processPayment(selectedVisit.id, parseFloat(paymentAmount), paymentMethod);
                }}
                className="flex-1"
              >
                Process Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Credits Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-600">
            <p>
              Developed by{' '}
              <a 
                href="https://instagram.com/aftabxplained" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                Aftab Alam [ASOSE Lajpat Nagar]
              </a>
              {' '}| Follow on Instagram:{' '}
              <a 
                href="https://instagram.com/aftabxplained" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                @aftabxplained
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};