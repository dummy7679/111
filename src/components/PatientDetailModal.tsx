import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Heart, 
  AlertTriangle,
  FileText,
  CreditCard,
  Clock,
  Activity
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import { supabase } from '../lib/supabase';
import { Patient, Visit, MedicalHistory, PaymentTransaction } from '../types';
import { formatDate, formatTime, getStatusColor, getPaymentStatusColor } from '../lib/utils';
import { useTranslation } from '../lib/translations';

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  onClose,
  patientId
}) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'medical' | 'payments'>('overview');

  useEffect(() => {
    if (isOpen && patientId) {
      fetchPatientDetails();
    }
  }, [isOpen, patientId]);

  const fetchPatientDetails = async () => {
    setLoading(true);
    try {
      // Fetch patient details
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData);

      // Fetch visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          doctor:doctors(*),
          payment_transactions(*)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      // Fetch medical history
      const { data: medicalData, error: medicalError } = await supabase
        .from('medical_history')
        .select(`
          *,
          doctor:doctors(*),
          visit:visits(*)
        `)
        .eq('patient_uid', patientData.uid)
        .order('created_at', { ascending: false });

      if (medicalError) throw medicalError;
      setMedicalHistory(medicalData || []);

      // Fetch payment history
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (paymentError) throw paymentError;
      setPaymentHistory(paymentData || []);

    } catch (error) {
      console.error('Error fetching patient details:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalVisits = visits.length;
    const completedVisits = visits.filter(v => v.status === 'completed').length;
    const totalSpent = paymentHistory
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const avgWaitTime = visits.length > 0 ? 
      visits.reduce((sum, v) => {
        if (v.checked_in_at && v.created_at) {
          const waitTime = new Date(v.checked_in_at).getTime() - new Date(v.created_at).getTime();
          return sum + (waitTime / (1000 * 60)); // Convert to minutes
        }
        return sum;
      }, 0) / visits.length : 0;

    return { totalVisits, completedVisits, totalSpent, avgWaitTime };
  };

  if (!patient) return null;

  const stats = calculateStats();
  const lastVisit = visits[0];
  const recentMedicalRecord = medicalHistory[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('patient_details')} - ${patient.name}`} size="xl">
      <div className="space-y-6">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading patient details...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Patient Overview Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{patient.name}</h3>
                        <p className="text-gray-600">ID: {patient.uid}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{patient.age} years old</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span>{patient.phone}</span>
                      </div>
                      {patient.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span>{patient.email}</span>
                        </div>
                      )}
                      {patient.address && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span>{patient.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Health Info */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 flex items-center">
                      <Heart className="h-4 w-4 mr-2 text-red-500" />
                      Health Information
                    </h4>
                    
                    {patient.blood_group && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <span className="text-sm font-medium text-red-800">Blood Group: {patient.blood_group}</span>
                      </div>
                    )}

                    {patient.allergies && patient.allergies.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                          <span className="text-sm font-medium text-yellow-800">Allergies:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {patient.allergies.map((allergy, index) => (
                            <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                              {allergy}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {patient.medical_conditions && patient.medical_conditions.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <Activity className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="text-sm font-medium text-blue-800">Medical Conditions:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {patient.medical_conditions.map((condition, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {patient.emergency_contact && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <span className="text-sm font-medium text-gray-800">
                          Emergency Contact: {patient.emergency_contact}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Statistics</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-blue-600">{stats.totalVisits}</div>
                        <div className="text-xs text-blue-700">Total Visits</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-green-600">{stats.completedVisits}</div>
                        <div className="text-xs text-green-700">Completed</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-purple-600">₹{stats.totalSpent.toFixed(0)}</div>
                        <div className="text-xs text-purple-700">Total Spent</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold text-orange-600">{stats.avgWaitTime.toFixed(0)}m</div>
                        <div className="text-xs text-orange-700">Avg Wait</div>
                      </div>
                    </div>

                    {lastVisit && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-gray-800 mb-2">Last Visit</h5>
                        <div className="text-xs text-gray-600">
                          <div>{formatDate(lastVisit.visit_date)}</div>
                          <div className="capitalize">{lastVisit.department}</div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getStatusColor(lastVisit.status)}`}>
                            {lastVisit.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'overview', label: 'Overview', icon: User },
                  { key: 'visits', label: `Visits (${visits.length})`, icon: Calendar },
                  { key: 'medical', label: `Medical Records (${medicalHistory.length})`, icon: FileText },
                  { key: 'payments', label: `Payments (${paymentHistory.length})`, icon: CreditCard }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                      activeTab === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">Recent Activity</h4>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {visits.slice(0, 3).map((visit) => (
                            <div key={visit.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <div className="text-sm font-medium">Token #{visit.stn}</div>
                                <div className="text-xs text-gray-600">{formatDate(visit.visit_date)}</div>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(visit.status)}`}>
                                {visit.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <h4 className="font-semibold">Payment Summary</h4>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Total Paid:</span>
                            <span className="font-bold text-green-600">₹{stats.totalSpent.toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pending:</span>
                            <span className="font-bold text-yellow-600">
                              ₹{paymentHistory.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0).toFixed(0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Transactions:</span>
                            <span className="font-medium">{paymentHistory.length}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'visits' && (
                <div className="space-y-4">
                  {visits.map((visit) => (
                    <Card key={visit.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              Token #{visit.stn} - {visit.department.charAt(0).toUpperCase() + visit.department.slice(1)}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {formatDate(visit.visit_date)} at {formatTime(visit.created_at)}
                            </p>
                            {visit.doctor && (
                              <p className="text-sm text-gray-600">Dr. {visit.doctor.name}</p>
                            )}
                          </div>
                          <div className="text-right space-y-1">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(visit.status)}`}>
                              {visit.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <br />
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPaymentStatusColor(visit.payment_status)}`}>
                              {visit.payment_status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {visit.checked_in_at && (
                          <div className="text-xs text-gray-500 mb-2">
                            Checked in: {formatTime(visit.checked_in_at)}
                          </div>
                        )}

                        {visit.completed_at && (
                          <div className="text-xs text-gray-500 mb-2">
                            Completed: {formatTime(visit.completed_at)}
                          </div>
                        )}

                        {visit.payment_transactions && visit.payment_transactions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Payment:</span>
                              <span className="font-medium text-green-600">
                                ₹{visit.payment_transactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {visits.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No visits found for this patient.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'medical' && (
                <div className="space-y-4">
                  {medicalHistory.map((record) => (
                    <Card key={record.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {formatDate(record.created_at)}
                            </h4>
                            {record.doctor && (
                              <p className="text-sm text-gray-600">Dr. {record.doctor.name}</p>
                            )}
                          </div>
                        </div>

                        {record.diagnosis && (
                          <div className="mb-3">
                            <h5 className="font-medium text-gray-900 mb-1">Diagnosis:</h5>
                            <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded">{record.diagnosis}</p>
                          </div>
                        )}

                        {record.prescription && (
                          <div className="mb-3">
                            <h5 className="font-medium text-gray-900 mb-1">Prescription:</h5>
                            <p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{record.prescription}</p>
                          </div>
                        )}

                        {record.notes && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-1">Notes:</h5>
                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{record.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {medicalHistory.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No medical records found for this patient.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-4">
                  {paymentHistory.map((payment) => (
                    <Card key={payment.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">₹{parseFloat(payment.amount.toString()).toFixed(2)}</h4>
                            <p className="text-sm text-gray-600">{formatDate(payment.created_at)}</p>
                            <p className="text-sm text-gray-600 capitalize">{payment.payment_method}</p>
                            {payment.transaction_id && (
                              <p className="text-xs text-gray-500">ID: {payment.transaction_id}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {payment.status.toUpperCase()}
                            </span>
                            {payment.processed_at && (
                              <div className="text-xs text-gray-500 mt-1">
                                {formatTime(payment.processed_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {paymentHistory.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No payment records found for this patient.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>
                {t('close')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};