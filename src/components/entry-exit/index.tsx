import React, { useState, useEffect } from 'react';
import { FilePlus, FileOutput, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User, InvoiceItem } from '../../types';
import DeviceEntry from './DeviceEntry';
import DeviceExit from './DeviceExit';
import { motion } from 'motion/react';
import { collection, query, onSnapshot } from '../../firebase';
import { db } from '../../firebase';

interface EntryExitProps {
  user: User;
  onBack: () => void;
  view: 'hub' | 'entry' | 'exit';
  setView: (v: 'hub' | 'entry' | 'exit') => void;
}

export default function EntryExit({ user, onBack, view, setView }: EntryExitProps) {
  const { t, i18n } = useTranslation();
  const [todayEntryCount, setTodayEntryCount] = useState(0);
  const [todayExitCount, setTodayExitCount] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'invoice_items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let enteredToday = 0;
      let exitedToday = 0;
      const todayStr = new Date().toDateString();

      snapshot.forEach(doc => {
        const item = doc.data() as InvoiceItem;
        
        // 1. Check entry (createdAt)
        const entryDate = item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt ? new Date(item.createdAt) : null);
        if (entryDate && entryDate.toDateString() === todayStr) {
          enteredToday += (item.quantity || 1);
        }

        // 2. Check exit (deliveredAt / status = '60')
        if (item.status === '60' && item.deliveredAt) {
          const exitDate = new Date(item.deliveredAt);
          if (exitDate.toDateString() === todayStr) {
            exitedToday += (item.quantity || 1);
          }
        }
      });

      setTodayEntryCount(enteredToday);
      setTodayExitCount(exitedToday);
    });

    return () => unsubscribe();
  }, []);

  const categories = [
    { 
      id: 'entry', 
      title: t('entryExit.deviceEntry', 'Device Entry'), 
      desc: 'Add new devices to the shop.',
      icon: FilePlus, 
      color: 'text-blue-600', 
      bg: 'bg-blue-500/10' 
    },
    { 
      id: 'exit', 
      title: t('entryExit.deviceExit', 'Device Exit'), 
      desc: 'Deliver ready devices to customers.',
      icon: FileOutput, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-500/10' 
    }
  ];

  if (view === 'entry') {
    return <DeviceEntry user={user} onBack={() => setView('hub')} />;
  }
  
  if (view === 'exit') {
    return <DeviceExit user={user} onBack={() => setView('hub')} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12 text-right animate-fadeIn" dir="rtl">
      <div className="px-4 space-y-6 pt-4">
        {/* Top Card: Today Statistics (Orange Theme matching Dashboard active devices) */}
        <div className="w-full bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col items-center text-center">
          {/* Faint Background Icon */}
          <div className="absolute opacity-10 -left-6 -top-6">
            <ArrowLeft size={120} className="rtl:rotate-180" />
          </div>
          
          <h2 className="text-sm font-black font-cairo text-orange-50 mb-4 z-10">إحصائية حركة الأجهزة لليوم</h2>
          
          <div className="grid grid-cols-2 gap-4 w-full divide-x divide-white/20 divide-x-reverse z-10">
            {/* Entered Today */}
            <div className="flex flex-col items-center justify-center p-2">
              <div className="flex items-center gap-2 mb-1">
                <FilePlus size={18} className="text-orange-100" />
                <span className="text-xs font-bold text-orange-100 font-cairo">الأجهزة الداخلة</span>
              </div>
              <span className="text-3xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{todayEntryCount}</span>
            </div>
            
            {/* Exited Today */}
            <div className="flex flex-col items-center justify-center p-2">
              <div className="flex items-center gap-2 mb-1">
                <FileOutput size={18} className="text-orange-100" />
                <span className="text-xs font-bold text-orange-100 font-cairo">الأجهزة الخارجة</span>
              </div>
              <span className="text-3xl font-black tracking-widest text-white shadow-sm drop-shadow-md">{todayExitCount}</span>
            </div>
          </div>
        </div>

        {/* Action Grid - White background, aspect-square, premium styling */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-6 justify-center">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView(cat.id as any)}
              className="flex flex-col items-center justify-center gap-4 p-6 bg-white hover:bg-gray-50 rounded-[2rem] border border-gray-100 transition-all text-center group shadow-md hover:shadow-xl aspect-square w-full"
            >
              <div className={`p-4 ${cat.bg} ${cat.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                <cat.icon size={28} />
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
