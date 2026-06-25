import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Wrench, ClipboardCheck, ArrowLeft, Clock, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User, InvoiceItem } from '../../types';
import Inspection from './Inspection';
import Maintenance from './Maintenance';
import ApprovalAndParts from './ApprovalAndParts';
import { motion } from 'motion/react';
import { collection, query, onSnapshot } from '../../firebase';
import { db } from '../../firebase';

export default function DeviceMovement({ 
  user, 
  onBack, 
  view, 
  setView 
}: { 
  user: User; 
  onBack: () => void; 
  view: 'hub' | 'inspection' | 'maintenance' | 'approval'; 
  setView: (v: 'hub' | 'inspection' | 'maintenance' | 'approval') => void; 
}) {
  const { t, i18n } = useTranslation();
  
  const [inspectionCount, setInspectionCount] = useState(0);
  const [approvalCount, setApprovalCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'invoice_items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let insCount = 0;
      let appCount = 0;
      let maintCount = 0;

      snapshot.forEach(doc => {
        const item = doc.data() as InvoiceItem;
        const status = item.status;
        const qty = Number(item.quantity) || 1;

        // 1. Inspection: '10', 'new', '20'
        if (status === '10' || status === 'new' || status === '20') {
          insCount += qty;
        }
        // 2. Approval & Parts: '30', 'awaiting_approval', '35', 'awaiting_parts'
        else if (status === '30' || status === 'awaiting_approval' || status === '35' || status === 'awaiting_parts') {
          appCount += qty;
        }
        // 3. Maintenance: '40', 'repairing'
        else if (status === '40' || status === 'repairing') {
          maintCount += qty;
        }
      });

      setInspectionCount(insCount);
      setApprovalCount(appCount);
      setMaintenanceCount(maintCount);
    });

    return () => unsubscribe();
  }, []);

  const categories = [
    { 
      id: 'inspection', 
      title: t('movement.inspection', 'Inspection Action'), 
      desc: 'Review incoming devices and diagnose problems.',
      icon: ClipboardCheck, 
      color: 'text-purple-600', 
      bg: 'bg-purple-500/10' 
    },
    { 
      id: 'approval', 
      title: 'انتظار الموافقة والقطع', 
      desc: 'Confirm customer decision for repairing and spare parts approval.',
      icon: Clock, 
      color: 'text-amber-600', 
      bg: 'bg-amber-500/10' 
    },
    { 
      id: 'maintenance', 
      title: t('movement.maintenance', 'Maintenance Action'), 
      desc: 'Perform repairs on inspected devices.',
      icon: Wrench, 
      color: 'text-orange-600', 
      bg: 'bg-orange-500/10' 
    }
  ];

  if (view === 'inspection') {
    return <Inspection user={user} onBack={() => setView('hub')} />;
  }
  
  if (view === 'approval') {
    return <ApprovalAndParts user={user} onBack={() => setView('hub')} />;
  }

  if (view === 'maintenance') {
    return <Maintenance user={user} onBack={() => setView('hub')} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12 text-right animate-fadeIn" dir="rtl">
      <div className="px-4 space-y-6 pt-4">
        {/* Top Card: Maintenance Statistics (Blue Theme matching "قسم الصيانة" block on desktop) */}
        <div className="w-full bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col items-center text-center">
          {/* Faint Background Icon */}
          <div className="absolute opacity-10 -left-6 -top-6">
            <SettingsIcon size={120} />
          </div>
          
          <h2 className="text-sm font-black font-cairo text-blue-50 mb-4 z-10">إحصائية حركة الصيانة النشطة بالمحل</h2>
          
          <div className="grid grid-cols-3 gap-2 w-full divide-x divide-white/20 divide-x-reverse z-10">
            {/* Under Inspection */}
            <div className="flex flex-col items-center justify-center p-1">
              <div className="flex items-center gap-1.5 mb-1 justify-center">
                <ClipboardCheck size={16} className="text-blue-100 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold text-blue-100 font-cairo whitespace-nowrap">في الفحص</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{inspectionCount}</span>
            </div>
            
            {/* Awaiting Approval */}
            <div className="flex flex-col items-center justify-center p-1">
              <div className="flex items-center gap-1.5 mb-1 justify-center">
                <Clock size={16} className="text-blue-100 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold text-blue-100 font-cairo whitespace-nowrap">انتظار الموافقة والقطع</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{approvalCount}</span>
            </div>

            {/* In Repair */}
            <div className="flex flex-col items-center justify-center p-1">
              <div className="flex items-center gap-1.5 mb-1 justify-center">
                <Wrench size={16} className="text-blue-100 shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold text-blue-100 font-cairo whitespace-nowrap">الصيانة</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{maintenanceCount}</span>
            </div>
          </div>
        </div>

        {/* Action Grid - White background, aspect-square, premium styling */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-lg mx-auto mt-6 justify-center">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView(cat.id as any)}
              className="flex flex-col items-center justify-center gap-4 p-5 bg-white hover:bg-gray-50 rounded-[2rem] border border-gray-100 transition-all text-center group shadow-md hover:shadow-xl aspect-square w-full"
            >
              <div className={`p-4 ${cat.bg} ${cat.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                <cat.icon size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-xs md:text-sm text-gray-900 font-cairo leading-tight">{cat.title}</h3>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
