import React, { useState } from 'react';
import { Search, User, Calendar, FileText, CreditCard, Download, Printer, Eye, Phone, Mail } from 'lucide-react';
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
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<MedicalHistory | null>(null);

  const downloadPrescription = (prescription: MedicalHistory) => {
    const prescriptionContent = `
DIGITAL PRESCRIPTION
====================

Clinic: MediQueue Clinic
Date: ${formatDate(prescription.created_at)}

PATIENT INFORMATION:
Name: ${patient?.name}
Age: ${patient?.age}
Phone: ${patient?.phone}
Patient ID: ${patient?.uid}

DOCTOR INFORMATION:
Doctor: ${prescription.doctor?.name || 'N/A'}
Specialization: ${prescription.doctor?.specialization || 'N/A'}

DIAGNOSIS:
${prescription.diagnosis || 'Not specified'}

PRESCRIPTION:
${prescription.prescription || 'No prescription provided'}

ADDITIONAL NOTES:
${prescription.notes || 'No additional notes'}

---
This is a digitally generated prescription.
Generated on: ${formatDate(new Date().toISOString())}
    `.trim();

    const blob = new Blob([prescriptionContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescription-${patient?.name}-${formatDate(prescription.created_at)}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const printPrescription = (prescription: MedicalHistory) => {
    const printContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0;">MediQueue Clinic</h1>
          <p style="margin: 5px 0;">Digital Prescription</p>
          <p style="margin: 5px 0;">Date: ${formatDate(prescription.created_at)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Patient Information</h3>
          <p><strong>Name:</strong> ${patient?.name}</p>
          <p><strong>Age:</strong> ${patient?.age}</p>
          <p><strong>Phone:</strong> ${patient?.phone}</p>
          <p><strong>Patient ID:</strong> ${patient?.uid}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Doctor Information</h3>
          <p><strong>Doctor:</strong> ${prescription.doctor?.name || 'N/A'}</p>
          <p><strong>Specialization:</strong> ${prescription.doctor?.specialization || 'N/A'}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Diagnosis</h3>
          <p>${prescription.diagnosis || 'Not specified'}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Prescription</h3>
          <div style="white-space: pre-wrap; font-family: monospace; background: #f5f5f5; padding: 15px; border-radius: 5px;">
${prescription.prescription || 'No prescription provided'}
          </div>
        </div>

        ${prescription.notes ? `
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Additional Notes</h3>
            <p>${prescription.notes}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px;">
          <p style="margin: 0;"><strong>Dr. ${prescription.doctor?.name || 'N/A'}</strong></p>
          <p style="margin: 5px 0;">${prescription.doctor?.qualification || ''}</p>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">This is a digitally generated prescription</p>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Prescription - ${patient?.name}</title>
            <style>
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${printContent}
            <div class="no-print" style="text-align: center; margin-top: 20px;">
              <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
              <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };
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
    setShowPrescriptionModal(false);
    setSelectedPrescription(null);
    onClose();
  };

  return (
    <>
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
                  <div className="grid md:grid-cols-3 gap-4">
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
                        </span>
                      ))}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">
                          <a href={`tel:${patient.phone}`} className="text-blue-600 hover:underline">
                            {patient.phone}
                          </a>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                          <span className="font-medium">
                            <a href={`mailto:${patient.email}`} className="text-blue-600 hover:underline">
                              {patient.email}
                            </a>
                          </span>
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
                          <span className="font-medium">
                            <a href={`tel:${patient.emergency_contact}`} className="text-blue-600 hover:underline">
                              {patient.emergency_contact}
                            </a>
                          </span>
              </CardContent>
            </Card>
                    </div>
                    <div className="space-y-2">

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Visits:</span>
                        <span className="font-medium">{visits.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Prescriptions:</span>
                        <span className="font-medium">{medicalHistory.length}</span>
                      </div>
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

                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPrescription(record);
                                  setShowPrescriptionModal(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <div className="text-sm text-gray-700 bg-green-50 p-2 rounded max-h-24 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans">{record.prescription}</pre>
                              </div>
                                size="sm"
                                variant="outline"
                                onClick={() => downloadPrescription(record)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => printPrescription(record)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
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

      {/* Prescription Detail Modal */}
      <Modal
        isOpen={showPrescriptionModal}
        onClose={() => {
          setShowPrescriptionModal(false);
          setSelectedPrescription(null);
        }}
        title="Prescription Details"
        size="lg"
      >
        {selectedPrescription && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">
                Prescription from {formatDate(selectedPrescription.created_at)}
              </h4>
              <p className="text-sm text-blue-800">
                Doctor: {selectedPrescription.doctor?.name || 'N/A'} | 
                Patient: {patient?.name}
              </p>
            </div>

            {selectedPrescription.diagnosis && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Diagnosis:</h5>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-gray-800">{selectedPrescription.diagnosis}</p>
                </div>
              </div>
            )}

            {selectedPrescription.prescription && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Prescription:</h5>
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm">
                    {selectedPrescription.prescription}
                  </pre>
                </div>
              </div>
            )}

            {selectedPrescription.notes && (
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Additional Notes:</h5>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-gray-800">{selectedPrescription.notes}</p>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => downloadPrescription(selectedPrescription)}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => printPrescription(selectedPrescription)}
                className="flex-1"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                onClick={() => {
                  setShowPrescriptionModal(false);
                  setSelectedPrescription(null);
                }}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};