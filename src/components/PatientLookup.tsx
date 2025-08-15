import React, { useState } from 'react';
import { Search, User, Calendar, FileText, CreditCard } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Modal } from './ui/Modal';
import { supabase } from '../lib/supabase';
import { Patient, Visit, MedicalHistory } from '../types';
import { formatDate, formatTime } from '../lib/utils';

interface PatientLookupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatientLookup: React.FC<PatientLookupProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'visits' | 'history'>('visits');
  const [error, setError] = useState<string>('');

  const searchPatient = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setPatient(null);
    setVisits([]);
    setMedicalHistory([]);
    
    try {
      // Search by UID, phone, or name
      let query = supabase
        .from('patients')
        .select('*');

      if (searchQuery.startsWith('CLN1-')) {
        query = query.eq('uid', searchQuery.trim().toUpperCase());
      } else if (/^\d+$/.test(searchQuery)) {
        query = query.eq('phone', searchQuery.trim());
      } else {
        query = query.ilike('name', `%${searchQuery.trim()}%`);
      }

      const { data: patientData, error: patientError } = await query.limit(1);

      if (patientError) {
        console.error('Patient search error:', patientError);
        setError('Patient not found. Please check the search criteria.');
        return;
      }

      if (!patientData || patientData.length === 0) {
          setError('Patient not found. Please check the search criteria.');
        return;
      }

      const patient = Array.isArray(patientData) ? patientData[0] : patientData;
      setPatient(patient);

      // Fetch all visits for this patient
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          doctor:doctors(*),
          payment_transactions(*)
        `)
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData || []);

      // Fetch medical history
      const { data: historyData, error: historyError } = await supabase
        .from('medical_history')
        .select(`
          *,
          doctor:doctors(*),
          visit:visits(*)
        `)
        .eq('patient_uid', patient.uid)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      setMedicalHistory(historyData || []);

    } catch (error) {
      console.error('Error searching patient:', error);
      setError('Error searching patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setPatient(null);
    setVisits([]);
    setMedicalHistory([]);
    setActiveTab('visits');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Patient Lookup" size="xl">
      <div className="space-y-6">
        {/* Search */}
        <div className="flex space-x-3">
          <Input
            placeholder="Search by UID, phone number, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchPatient()}
            className="flex-1"
            error={error}
          />
          <Button onClick={searchPatient} loading={loading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {patient && (
          <div className="space-y-6">
            {/* Patient Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-blue-600" />
                  <h3 className="text-lg font-semibold">Patient Information</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Patient ID:</span>
                      <span className="font-medium">{patient.uid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{patient.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Age:</span>
                      <span className="font-medium">{patient.age}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{patient.phone}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {patient.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email:</span>
                        <span className="font-medium">{patient.email}</span>
                      </div>
                    )}
                    {patient.blood_group && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Blood Group:</span>
                        <span className="font-medium">{patient.blood_group}</span>
                      </div>
                    )}
                    {patient.emergency_contact && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Emergency Contact:</span>
                        <span className="font-medium">{patient.emergency_contact}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Registered:</span>
                      <span className="font-medium">{formatDate(patient.created_at)}</span>
                    </div>
                  </div>
                </div>

                {patient.allergies && patient.allergies.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">Allergies:</h4>
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((allergy, index) => (
                        <span key={index} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {patient.medical_conditions && patient.medical_conditions.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">Medical Conditions:</h4>
                    <div className="flex flex-wrap gap-2">
                      {patient.medical_conditions.map((condition, index) => (
                        <span key={index} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('visits')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'visits'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Visit History ({visits.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Medical Records ({medicalHistory.length})
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
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
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              visit.status === 'completed' ? 'bg-green-100 text-green-800' :
                              visit.status === 'in_service' ? 'bg-blue-100 text-blue-800' :
                              visit.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {visit.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {visit.doctor && (
                          <div className="mb-2">
                            <span className="text-sm text-gray-600">Doctor: </span>
                            <span className="text-sm font-medium">{visit.doctor.name}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              visit.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                              visit.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {visit.payment_status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          {visit.payment_transactions && visit.payment_transactions.length > 0 && (
                            <div className="text-sm text-gray-600">
                              <CreditCard className="h-4 w-4 inline mr-1" />
                              ₹{visit.payment_transactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)}
                            </div>
                          )}
                        </div>
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

              {activeTab === 'history' && (
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
                            <p className="text-sm text-gray-700">{record.diagnosis}</p>
                          </div>
                        )}

                        {record.prescription && (
                          <div className="mb-3">
                            <h5 className="font-medium text-gray-900 mb-1">Prescription:</h5>
                            <p className="text-sm text-gray-700">{record.prescription}</p>
                          </div>
                        )}

                        {record.notes && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-1">Notes:</h5>
                            <p className="text-sm text-gray-700">{record.notes}</p>
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
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};