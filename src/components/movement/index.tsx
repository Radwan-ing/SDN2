import React, { useState } from 'react';
import { Settings as SettingsIcon, Wrench, Search, ArrowLeft, Clock, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';
import Inspection from './Inspection';
import Maintenance from './Maintenance';
import ApprovalAndParts from './ApprovalAndParts';
import { motion } from 'motion/react';

export default function DeviceMovement({ user, onBack }: { user: User, onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'hub' | 'inspection' | 'maintenance' | 'approval'>('hub');

  const categories = [
    { 
      id: 'inspection', 
      title: t('movement.inspection', 'Inspection Action'), 
      desc: 'Review incoming devices and diagnose problems.',
      icon: Search, 
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10' 
    },
    { 
      id: 'approval', 
      title: 'انتظار الموافقة والقطع', 
      desc: 'Confirm customer decision for repairing and spare parts approval.',
      icon: Clock, 
      color: 'text-amber-500', 
      bg: 'bg-amber-500/10' 
    },
    { 
      id: 'maintenance', 
      title: t('movement.maintenance', 'Maintenance Action'), 
      desc: 'Perform repairs on inspected devices.',
      icon: Wrench, 
      color: 'text-orange-500', 
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
    <div className="max-w-4xl mx-auto space-y-4 pb-12 text-right" dir="rtl">
      {/* Unified Header */}
      <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/20" dir="rtl">
        <div className="flex items-center gap-2">
          {onBack && (
            <button 
              type="button"
              onClick={onBack}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
            >
              <ArrowLeft size={18} className="rtl:rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-black text-white m-0 p-0">{t('common.deviceMovement', 'حركة الأجهزة والصيانة')}</h1>
            <p className="text-[10px] text-gray-500 font-bold m-0 p-0 leading-none mt-1">
              {t('movement.subtitle', 'فحص وتشخيص الأجهزة، الموافقة والقطع، وإجراء الصيانات ومتابعتها')}
            </p>
          </div>
        </div>
      </div>

      {/* Categories Grid - Matching beautiful square style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView(cat.id as any)}
            className="flex flex-col items-center justify-center text-center gap-3 p-5 bg-[#1a1a1a] rounded-2xl border border-white/5 hover:border-white/10 transition-all group shadow-lg cursor-pointer min-h-[140px]"
          >
            <div className={`p-3 ${cat.bg} ${cat.color} rounded-xl group-hover:scale-105 transition-transform shadow-md`}>
              <cat.icon size={26} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white mt-1 leading-tight">{cat.title}</h3>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
