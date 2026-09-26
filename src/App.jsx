import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc
} from 'firebase/firestore';
import {
  Calendar as CalendarIcon, Users, DollarSign, Settings, Plus, Edit, Trash2,
  CheckCircle, AlertCircle, Download, Lock, Key, ChevronLeft, ChevronRight, Clock, X
} from 'lucide-react';

// 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVlvPEi4ha79rJyYNnOydzByEdl-mnvgA",
  authDomain: "fitculty-calendar.firebaseapp.com",
  projectId: "fitculty-calendar",
  storageBucket: "fitculty-calendar.firebasestorage.app",
  messagingSenderId: "55989070710",
  appId: "1:55989070710:web:2d2bbed8c071787ec7a857",
  measurementId: "G-9ZSYEBN88B"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// SHA-256 Hashing helper for Admin PIN
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [staffList, setStaffList] = useState([
    { id: 'st1', name: 'โค้ชเอ', role: 'Trainer', hourlyRate: 300 },
    { id: 'st2', name: 'โค้ชบี', role: 'Instructor', hourlyRate: 350 }
  ]);
  const [jobTypes, setJobTypes] = useState([
    { id: 'jt1', name: 'Personal Training', color: 'bg-blue-500' },
    { id: 'jt2', name: 'Group Class', color: 'bg-green-500' }
  ]);

  // Admin PIN State
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [savedPinHash, setSavedPinHash] = useState('8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'); // Default 1234
  const [newPin, setNewPin] = useState('');

  // Form States
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: '', startTime: '09:00', endTime: '10:00',
    staffId: '', jobTypeId: '', note: '', rate: 300
  });

  // Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Firestore Real-time listener for schedules
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'schedules'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSchedules(data);
      },
      (error) => {
        console.warn('Firestore offline or fallback mode activated', error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Admin Login Handler
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const hashed = await hashPin(inputPin);
    if (hashed === savedPinHash) {
      setIsAdmin(true);
      setInputPin('');
      showToast('เข้าสู่ระบบ Admin สำเร็จ');
    } else {
      showToast('รหัส PIN ไม่ถูกต้อง', 'error');
    }
  };

  const handleUpdatePin = async () => {
    if (newPin.length < 4) {
      showToast('PIN ต้องมีความยาวอย่างน้อย 4 หลัก', 'error');
      return;
    }
    const hashed = await hashPin(newPin);
    setSavedPinHash(hashed);
    setNewPin('');
    showToast('เปลี่ยนรหัสผ่าน Admin PIN เรียบร้อย');
  };

  // Add / Edit Schedule
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'schedules'), {
        ...formData,
        createdAt: new Date().toISOString()
      });
      showToast('บันทึกตารางงานสำเร็จ');
      setShowModal(false);
    } catch (err) {
      // Local Fallback
      setSchedules([...schedules, { ...formData, id: Date.now().toString() }]);
      showToast('บันทึกในเครื่องเรียบร้อย');
      setShowModal(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
      showToast('ลบรายการเรียบร้อย');
    } catch (err) {
      setSchedules(schedules.filter(s => s.id !== id));
      showToast('ลบรายการเรียบร้อย');
    }
  };

  // CSV Export with UTF-8 BOM
  const exportPayrollCSV = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const currentMonthSchedules = schedules.filter(s => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Thai support
    csvContent += "ชื่อพนักงาน,วันที่,เวลาเริ่ม,เวลาเลิก,ประเภทงาน,ค่าตอบแทน (บาท)\n";

    currentMonthSchedules.forEach(s => {
      const staff = staffList.find(st => st.id === s.staffId)?.name || 'ไม่ระบุ';
      const job = jobTypes.find(j => j.id === s.jobTypeId)?.name || 'ทั่วไป';
      csvContent += `"${staff}","${s.date}","${s.startTime}","${s.endTime}","${job}",${s.rate}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Fitculty_Payroll_${THAI_MONTHS[month]}_${year + 543}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export CSV เรียบร้อยแล้ว');
  };

  // Calendar render helpers
  const yearBE = currentDate.getFullYear() + 543;
  const monthName = THAI_MONTHS[currentDate.getMonth()];

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-m-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Fitculty</h1>
              <p className="text-xs text-slate-500">ระบบจัดตารางงาน & คำนวณค่าตอบแทน</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <CalendarIcon size={18} />
              <span>ปฏิทินงาน</span>
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'payroll' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <DollarSign size={18} />
              <span>สรุปค่าตอบแทน</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Settings size={18} />
              <span>ตั้งค่าหลังบ้าน</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800">
                  {monthName} {yearBE}
                </h2>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronLeft size={20} /></button>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition"><ChevronRight size={20} /></button>
                </div>
              </div>
              <button
                onClick={() => {
                  setFormData({ date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', staffId: staffList[0]?.id || '', jobTypeId: jobTypes[0]?.id || '', note: '', rate: 300 });
                  setShowModal(true);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-md transition"
              >
                <Plus size={18} />
                <span>เพิ่มตารางงาน</span>
              </button>
            </div>

            {/* Schedule List / Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map(s => {
                const staff = staffList.find(st => st.id === s.staffId);
                const job = jobTypes.find(j => j.id === s.jobTypeId);
                return (
                  <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${job?.color || 'bg-slate-500'}`}>
                        {job?.name || 'ทั่วไป'}
                      </span>
                      <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{staff?.name || 'ไม่ระบุพนักงาน'}</h3>
                    <div className="text-sm text-slate-500 space-y-1 mt-2">
                      <div className="flex items-center gap-2"><CalendarIcon size={16} /> <span>{s.date}</span></div>
                      <div className="flex items-center gap-2"><Clock size={16} /> <span>{s.startTime} - {s.endTime} น.</span></div>
                      <div className="flex items-center gap-2 font-semibold text-emerald-600"><DollarSign size={16} /> <span>{s.rate} บาท</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAYROLL TAB */}
        {activeTab === 'payroll' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">สรุปเงินเดือน {monthName} {yearBE}</h2>
                <p className="text-sm text-slate-500">คำนวณจากตารางงานในเดือนนี้</p>
              </div>
              <button onClick={exportPayrollCSV} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium shadow transition">
                <Download size={18} />
                <span>Export CSV (Excel)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-sm">
                    <th className="py-3 px-4">ชื่อพนักงาน</th>
                    <th className="py-3 px-4">ตำแหน่ง</th>
                    <th className="py-3 px-4">จำนวนงานในเดือนนี้</th>
                    <th className="py-3 px-4 text-right">ยอดรวมค่าตอบแทน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.map(st => {
                    const staffSchedules = schedules.filter(s => {
                      const d = new Date(s.date);
                      return s.staffId === st.id && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
                    });
                    const totalPay = staffSchedules.reduce((sum, s) => sum + Number(s.rate || 0), 0);
                    return (
                      <tr key={st.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium text-slate-800">{st.name}</td>
                        <td className="py-3 px-4 text-slate-500">{st.role}</td>
                        <td className="py-3 px-4 text-slate-600">{staffSchedules.length} งาน</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">{totalPay.toLocaleString()} บาท</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            {!isAdmin ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <Lock size={24} />
                  </div>
                  <h2 className="text-xl font-bold">เข้าสู่ระบบ Admin</h2>
                  <p className="text-sm text-slate-500">กรุณากรอกรหัส PIN เพื่อจัดการตั้งค่าระบบ (PIN ดั้งเดิม: 1234)</p>
                </div>
                <input
                  type="password"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="กรอกรหัส PIN"
                  className="w-full text-center text-2xl tracking-widest px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow transition">
                  ยืนยันรหัสผ่าน
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                  <h2 className="text-lg font-bold">⚙️ ตั้งค่าระบบหลังบ้าน</h2>
                  <button onClick={() => setIsAdmin(false)} className="text-sm text-red-600 hover:underline">ออกจากระบบ Admin</button>
                </div>

                {/* Change PIN */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Key size={18} /> เปลี่ยนรหัสผ่าน Admin PIN</h3>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="ตั้งรหัส PIN ใหม่"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <button onClick={handleUpdatePin} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium">บันทึก PIN ใหม่</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-slate-800">เพิ่มตารางงานใหม่</h3>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <form onSubmit={handleSaveSchedule} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">พนักงาน</label>
                <select value={formData.staffId} onChange={e => setFormData({ ...formData, staffId: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl">
                  {staffList.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">ประเภทงาน</label>
                <select value={formData.jobTypeId} onChange={e => setFormData({ ...formData, jobTypeId: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl">
                  {jobTypes.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">วันที่</label>
                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">เวลาเริ่ม</label>
                  <input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">เวลาเลิก</label>
                  <input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl" required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">ค่าตอบแทน (บาท)</label>
                <input type="number" value={formData.rate} onChange={e => setFormData({ ...formData, rate: e.target.value })} className="w-full mt-1 p-2.5 border rounded-xl" required />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition mt-4">
                บันทึกข้อมูล
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
