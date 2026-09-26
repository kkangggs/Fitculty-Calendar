import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc
} from 'firebase/firestore';
import {
  Calendar as CalendarIcon, Users, DollarSign, Settings, Plus, Edit, Trash2,
  CheckCircle, AlertCircle, Download, Lock, Key, ChevronLeft, ChevronRight, Clock, X, LayoutGrid, List, Tag, UserPlus, Briefcase
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

// SHA-256 Hashing helper
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

const WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const COLOR_OPTIONS = [
  { name: 'น้ำเงิน', class: 'bg-indigo-600 text-white' },
  { name: 'เขียว', class: 'bg-emerald-600 text-white' },
  { name: 'ส้ม', class: 'bg-amber-500 text-white' },
  { name: 'ชมพู', class: 'bg-rose-500 text-white' },
  { name: 'ฟ้า', class: 'bg-sky-500 text-white' },
  { name: 'ม่วง', class: 'bg-purple-600 text-white' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [viewMode, setViewMode] = useState('grid');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Real-time collections state
  const [schedules, setSchedules] = useState([]);
  const [staffList, setStaffList] = useState([
    { id: 'st1', name: 'โค้ชเอ', role: 'Trainer', hourlyRate: 300 },
    { id: 'st2', name: 'โค้ชบี', role: 'Instructor', hourlyRate: 350 },
    { id: 'st3', name: 'โค้ชซี', role: 'Personal Coach', hourlyRate: 400 }
  ]);
  const [jobTypes, setJobTypes] = useState([
    { id: 'jt1', name: 'Personal Training', color: 'bg-indigo-600 text-white' },
    { id: 'jt2', name: 'Group Class', color: 'bg-emerald-600 text-white' },
    { id: 'jt3', name: 'Pilates', color: 'bg-amber-500 text-white' },
    { id: 'jt4', name: 'Yoga Class', color: 'bg-rose-500 text-white' }
  ]);

  // Admin Login & PIN State
  const [isAdmin, setIsAdmin] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [savedPinHash, setSavedPinHash] = useState('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'); // Default PIN 1234
  const [newPin, setNewPin] = useState('');

  // Form States for Modal Schedule
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState({
    date: '', startTime: '09:00', endTime: '10:00',
    staffId: '', jobTypeId: '', note: '', rate: 300
  });

  // Form States for Admin Management
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Trainer', hourlyRate: 300 });
  const [newJobType, setNewJobType] = useState({ name: '', color: 'bg-indigo-600 text-white' });

  // Toast Notification
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Firestore Real-time Listeners
  useEffect(() => {
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(data);
    }, (err) => console.warn('Firestore schedules offline:', err));

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStaffList(data);
      }
    }, (err) => console.warn('Firestore staff offline:', err));

    const unsubJobTypes = onSnapshot(collection(db, 'jobTypes'), (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobTypes(data);
      }
    }, (err) => console.warn('Firestore jobTypes offline:', err));

    return () => {
      unsubSchedules();
      unsubStaff();
      unsubJobTypes();
    };
  }, []);

  // Admin Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const hashed = await hashPin(inputPin);
    if (inputPin === '1234' || hashed === savedPinHash) {
      setIsAdmin(true);
      setInputPin('');
      showToast('เข้าสู่ระบบ Admin สำเร็จ');
    } else {
      showToast('รหัส PIN ไม่ถูกต้อง (ใช้ 1234)', 'error');
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

  // --- Staff Management ---
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name.trim()) return;
    const staffData = { ...newStaff, hourlyRate: Number(newStaff.hourlyRate) };
    try {
      await addDoc(collection(db, 'staff'), staffData);
      showToast(`เพิ่มพนักงาน ${newStaff.name} สำเร็จ`);
    } catch (err) {
      setStaffList([...staffList, { ...staffData, id: Date.now().toString() }]);
      showToast(`เพิ่มพนักงาน ${newStaff.name} เรียบร้อย`);
    }
    setNewStaff({ name: '', role: 'Trainer', hourlyRate: 300 });
  };

  const handleDeleteStaff = async (id, name) => {
    if (!window.confirm(`ต้องการลบพนักงาน ${name} ใช่หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      showToast(`ลบพนักงานเรียบร้อย`);
    } catch (err) {
      setStaffList(staffList.filter(s => s.id !== id));
      showToast(`ลบพนักงานเรียบร้อย`);
    }
  };

  // --- Job Types Management ---
  const handleAddJobType = async (e) => {
    e.preventDefault();
    if (!newJobType.name.trim()) return;
    try {
      await addDoc(collection(db, 'jobTypes'), newJobType);
      showToast(`เพิ่มประเภทงาน ${newJobType.name} สำเร็จ`);
    } catch (err) {
      setJobTypes([...jobTypes, { ...newJobType, id: Date.now().toString() }]);
      showToast(`เพิ่มประเภทงานเรียบร้อย`);
    }
    setNewJobType({ name: '', color: COLOR_OPTIONS[0].class });
  };

  const handleDeleteJobType = async (id, name) => {
    if (!window.confirm(`ต้องการลบประเภทงาน ${name} ใช่หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, 'jobTypes', id));
      showToast(`ลบประเภทงานเรียบร้อย`);
    } catch (err) {
      setJobTypes(jobTypes.filter(j => j.id !== id));
      showToast(`ลบประเภทงานเรียบร้อย`);
    }
  };

  // --- Schedule Handling ---
  const handleOpenAddModal = (dateString = '') => {
    const targetDate = dateString || new Date().toISOString().split('T')[0];
    const initialStaff = staffList[0] || { id: '', hourlyRate: 300 };
    setScheduleFormData({
      date: targetDate,
      startTime: '09:00',
      endTime: '10:00',
      staffId: initialStaff.id,
      jobTypeId: jobTypes[0]?.id || '',
      note: '',
      rate: initialStaff.hourlyRate || 300
    });
    setShowScheduleModal(true);
  };

  const handleStaffChangeInModal = (staffId) => {
    const selected = staffList.find(s => s.id === staffId);
    setScheduleFormData({
      ...scheduleFormData,
      staffId: staffId,
      rate: selected ? selected.hourlyRate : scheduleFormData.rate
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'schedules'), {
        ...scheduleFormData,
        rate: Number(scheduleFormData.rate),
        createdAt: new Date().toISOString()
      });
      showToast('บันทึกตารางงานสำเร็จ');
      setShowScheduleModal(false);
    } catch (err) {
      setSchedules([...schedules, { ...scheduleFormData, rate: Number(scheduleFormData.rate), id: Date.now().toString() }]);
      showToast('บันทึกตารางงานเรียบร้อย');
      setShowScheduleModal(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('คุณต้องการลบตารางงานนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'schedules', id));
      showToast('ลบตารางงานเรียบร้อย');
    } catch (err) {
      setSchedules(schedules.filter(s => s.id !== id));
      showToast('ลบตารางงานเรียบร้อย');
    }
  };

  // --- Export CSV ---
  const exportPayrollCSV = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const currentMonthSchedules = schedules.filter(s => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    let csvContent = "\uFEFF";
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

  // Date calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const yearBE = year + 543;
  const monthName = THAI_MONTHS[month];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const resetToToday = () => setCurrentDate(new Date());

  const formatDateString = (dayNumber) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(dayNumber).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-white flex items-center gap-2 animate-bounce ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
              F
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fitculty</h1>
              <p className="text-xs text-slate-500 font-medium">ระบบจัดตารางงาน & คำนวณค่าตอบแทน</p>
            </div>
          </div>

          <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <CalendarIcon size={18} />
              <span>ปฏิทินงาน</span>
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'payroll' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <DollarSign size={18} />
              <span>สรุปค่าตอบแทน</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Settings size={18} />
              <span>ตั้งค่าหลังบ้าน</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-extrabold text-slate-900 min-w-[180px]">
                  {monthName} {yearBE}
                </h2>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition"><ChevronLeft size={18} /></button>
                  <button onClick={resetToToday} className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-white rounded-lg transition">วันนี้</button>
                  <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition"><ChevronRight size={18} /></button>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                    <LayoutGrid size={18} />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                    <List size={18} />
                  </button>
                </div>

                <button
                  onClick={() => handleOpenAddModal()}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition"
                >
                  <Plus size={18} />
                  <span>เพิ่มตารางงาน</span>
                </button>
              </div>
            </div>

            {/* Grid Calendar */}
            {viewMode === 'grid' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-500 py-3">
                  {WEEKDAYS.map((day, idx) => (
                    <div key={day} className={idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-indigo-500' : ''}>
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100/30">
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[110px] bg-slate-50/40 p-2 opacity-50" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = formatDateString(dayNum);
                    const daySchedules = schedules.filter(s => s.date === dateStr);
                    const isToday = new Date().toISOString().split('T')[0] === dateStr;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => handleOpenAddModal(dateStr)}
                        className={`min-h-[110px] p-2 bg-white hover:bg-indigo-50/30 transition cursor-pointer flex flex-col justify-between group relative ${isToday ? 'bg-indigo-50/20' : ''}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700'}`}>
                            {dayNum}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition text-indigo-600 text-[10px] font-bold">+ เพิ่ม</span>
                        </div>

                        <div className="space-y-1 overflow-y-auto max-h-[80px] pr-0.5 custom-scrollbar">
                          {daySchedules.map(s => {
                            const staff = staffList.find(st => st.id === s.staffId)?.name || 'งาน';
                            const job = jobTypes.find(j => j.id === s.jobTypeId);
                            return (
                              <div
                                key={s.id}
                                onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }}
                                className={`text-[11px] p-1.5 rounded-lg font-medium shadow-2xs flex justify-between items-center group/item ${job?.color || 'bg-slate-700 text-white'}`}
                              >
                                <div className="truncate pr-1">
                                  <div className="font-bold truncate">{staff}</div>
                                  <div className="text-[9px] opacity-85">{s.startTime}-{s.endTime}</div>
                                </div>
                                <Trash2 size={12} className="opacity-0 group-hover/item:opacity-100 transition text-white hover:text-rose-200 shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {schedules
                  .filter(s => {
                    if (!s.date) return true;
                    const d = new Date(s.date);
                    return d.getMonth() === month && d.getFullYear() === year;
                  })
                  .map(s => {
                    const staff = staffList.find(st => st.id === s.staffId);
                    const job = jobTypes.find(j => j.id === s.jobTypeId);
                    return (
                      <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${job?.color || 'bg-slate-500 text-white'}`}>
                              {job?.name || 'ทั่วไป'}
                            </span>
                            <button onClick={() => handleDeleteSchedule(s.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={16} /></button>
                          </div>
                          <h3 className="font-bold text-slate-900 text-lg">{staff?.name || 'ไม่ระบุพนักงาน'}</h3>
                          <div className="text-xs text-slate-500 space-y-1.5 mt-3">
                            <div className="flex items-center gap-2"><CalendarIcon size={14} /> <span>วันที่: {s.date}</span></div>
                            <div className="flex items-center gap-2"><Clock size={14} /> <span>เวลา: {s.startTime} - {s.endTime} น.</span></div>
                            <div className="flex items-center gap-2 font-bold text-emerald-600 text-sm"><DollarSign size={14} /> <span>{s.rate} บาท</span></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* PAYROLL TAB */}
        {activeTab === 'payroll' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">สรุปค่าตอบแทนพนักงาน ({monthName} {yearBE})</h2>
                <p className="text-xs text-slate-500 mt-1">คำนวณจากตารางงานที่ลงบันทึกในเดือนนี้</p>
              </div>
              <button onClick={exportPayrollCSV} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow transition">
                <Download size={18} />
                <span>Export CSV (Excel)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 text-xs font-bold uppercase">
                    <th className="py-3.5 px-4">ชื่อพนักงาน</th>
                    <th className="py-3.5 px-4">ตำแหน่ง</th>
                    <th className="py-3.5 px-4 text-center">จำนวนงานในเดือนนี้</th>
                    <th className="py-3.5 px-4 text-right">ยอดรวมค่าตอบแทน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {staffList.map(st => {
                    const staffSchedules = schedules.filter(s => {
                      if (!s.date) return false;
                      const d = new Date(s.date);
                      return s.staffId === st.id && d.getMonth() === month && d.getFullYear() === year;
                    });
                    const totalPay = staffSchedules.reduce((sum, s) => sum + Number(s.rate || 0), 0);
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-4 font-bold text-slate-900">{st.name}</td>
                        <td className="py-4 px-4 text-slate-500">{st.role}</td>
                        <td className="py-4 px-4 text-center font-semibold text-slate-700">{staffSchedules.length} งาน</td>
                        <td className="py-4 px-4 text-right font-extrabold text-emerald-600 text-base">{totalPay.toLocaleString()} บาท</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADMIN SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {!isAdmin ? (
              <div className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <form onSubmit={handleAdminLogin} className="space-y-5 py-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                      <Lock size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">เข้าสู่ระบบ Admin</h2>
                    <p className="text-xs text-slate-500">กรุณากรอกรหัส Admin PIN เพื่อจัดการตั้งค่าระบบ (PIN เริ่มต้น: <span className="font-bold text-indigo-600">1234</span>)</p>
                  </div>
                  <input
                    type="password"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value)}
                    placeholder="กรอกรหัส PIN"
                    className="w-full text-center text-3xl tracking-[0.5em] font-bold px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    maxLength={8}
                  />
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition">
                    เข้าสู่ระบบ Admin
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">⚙️ ตั้งค่าหลังบ้าน (Admin Dashboard)</h2>
                    <p className="text-xs text-slate-500">จัดการรายชื่อพนักงาน ประเภทงาน และความปลอดภัย</p>
                  </div>
                  <button onClick={() => setIsAdmin(false)} className="text-xs font-bold text-rose-600 hover:underline">ออกจากระบบ Admin</button>
                </div>

                {/* 1. Staff Management */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-3">
                    <UserPlus size={20} className="text-indigo-600" />
                    <span>จัดการรายชื่อพนักงาน & เรทค่าตอบแทน</span>
                  </h3>

                  <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="ชื่อพนักงาน / โค้ช"
                      value={newStaff.name}
                      onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="ตำแหน่ง (เช่น Trainer)"
                      value={newStaff.role}
                      onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                      required
                    />
                    <input
                      type="number"
                      placeholder="เรทค่าจ้าง/ชม. (บาท)"
                      value={newStaff.hourlyRate}
                      onChange={e => setNewStaff({ ...newStaff, hourlyRate: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                      required
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                      + เพิ่มพนักงาน
                    </button>
                  </form>

                  <div className="divide-y divide-slate-100">
                    {staffList.map(st => (
                      <div key={st.id} className="py-3 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{st.name}</div>
                          <div className="text-xs text-slate-500">{st.role} • <span className="text-emerald-600 font-semibold">{st.hourlyRate} บาท/ชม.</span></div>
                        </div>
                        <button onClick={() => handleDeleteStaff(st.id, st.name)} className="text-slate-400 hover:text-rose-600 p-1">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Job Types Management */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-3">
                    <Tag size={20} className="text-indigo-600" />
                    <span>จัดการประเภทงาน / วิชาเรียน</span>
                  </h3>

                  <form onSubmit={handleAddJobType} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      placeholder="ชื่อประเภทงาน (เช่น Pilates)"
                      value={newJobType.name}
                      onChange={e => setNewJobType({ ...newJobType, name: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                      required
                    />
                    <select
                      value={newJobType.color}
                      onChange={e => setNewJobType({ ...newJobType, color: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      {COLOR_OPTIONS.map(c => (
                        <option key={c.name} value={c.class}>สี {c.name}</option>
                      ))}
                    </select>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                      + เพิ่มประเภทงาน
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {jobTypes.map(j => (
                      <div key={j.id} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 ${j.color}`}>
                        <span>{j.name}</span>
                        <button onClick={() => handleDeleteJobType(j.id, j.name)} className="hover:text-rose-200">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. PIN Security */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b pb-3">
                    <Key size={20} className="text-indigo-600" />
                    <span>เปลี่ยนรหัสผ่าน Admin PIN</span>
                  </h3>
                  <div className="flex gap-2 max-w-md">
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="ตั้งรหัส PIN ใหม่ (ตัวเลข)"
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={handleUpdatePin} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition">
                      บันทึก PIN ใหม่
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">เพิ่มตารางงานใหม่</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSchedule} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">พนักงาน</label>
                <select
                  value={scheduleFormData.staffId}
                  onChange={e => handleStaffChangeInModal(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {staffList.map(st => <option key={st.id} value={st.id}>{st.name} ({st.role})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">ประเภทงาน</label>
                <select
                  value={scheduleFormData.jobTypeId}
                  onChange={e => setScheduleFormData({ ...scheduleFormData, jobTypeId: e.target.value })}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {jobTypes.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">วันที่</label>
                <input
                  type="date"
                  value={scheduleFormData.date}
                  onChange={e => setScheduleFormData({ ...scheduleFormData, date: e.target.value })}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">เวลาเริ่ม</label>
                  <input
                    type="time"
                    value={scheduleFormData.startTime}
                    onChange={e => setScheduleFormData({ ...scheduleFormData, startTime: e.target.value })}
                    className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">เวลาเลิก</label>
                  <input
                    type="time"
                    value={scheduleFormData.endTime}
                    onChange={e => setScheduleFormData({ ...scheduleFormData, endTime: e.target.value })}
                    className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">ค่าตอบแทน (บาท)</label>
                <input
                  type="number"
                  value={scheduleFormData.rate}
                  onChange={e => setScheduleFormData({ ...scheduleFormData, rate: e.target.value })}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition mt-4">
                บันทึกตารางงาน
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
