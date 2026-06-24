import React, { useState } from 'react';
import { FilePlus, FileOutput, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User } from '../../types';
import DeviceEntry from './DeviceEntry';
import DeviceExit from './DeviceExit';
import { motion } from 'motion/react';

interface EntryExitProps {
  user: User;
  onBack: () => void;
}

export default function EntryExit({ user, onBack }: EntryExitProps) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'hub' | 'entry' | 'exit'>('hub');

  const categories = [
    { 
      id: 'entry', 
      title: t('entryExit.deviceEntry', 'Device Entry'), 
      desc: 'Add new devices to the shop.',
      icon: FilePlus, 
      color: 'text-blue-500', 
      bg: 'bg-blue-500/10' 
    },
    { 
      id: 'exit', 
      title: t('entryExit.deviceExit', 'Device Exit'), 
      desc: 'Deliver ready devices to customers.',
      icon: FileOutput, 
      color: 'text-orange-500', 
      bg: 'bg-orange-500/10' 
    }
  ];

  if (view === 'entry') {
    return <DeviceEntry user={user} onBack={() => setView('hub')} />;
  }
  
  if (view === 'exit') {
    return <DeviceExit user={user} onBack={() => setView('hub')} />;
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
            <h1 className="text-lg font-black text-white m-0 p-0">{t('common.entryExit', 'إدخال وإخراج الأجهزة')}</h1>
          </div>
        </div>
      </div>

      <div className="px-4">
        {/* Categories Grid - Matching Settings/Movement Style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setView(cat.id as any)}
            className="flex items-center gap-4 p-5 bg-[#1a1a1a] rounded-[1.5rem] border border-white/5 hover:border-white/10 transition-all text-left rtl:text-right group shadow-xl"
          >
            <div className={`p-4 ${cat.bg} ${cat.color} rounded-2xl group-hover:scale-105 transition-transform`}>
              <cat.icon size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-white">{cat.title}</h3>
            </div>
            <div className="text-gray-600 group-hover:text-white transition-colors text-sm">
               {i18n.language === 'ar' ? '←' : '→'}
            </div>
          </motion.button>
        ))}

        </div>
      </div>
    </div>
  );
}
