/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FilePlus, 
  Package, 
  CheckCircle, 
  BarChart3, 
  Users, 
  Settings as SettingsIcon, 
  ClipboardCheck,
  Router,
  Bell,
  LogOut,
  Cpu,
  CircleDollarSign,
  Wrench,
  ArrowRightLeft,
  Clock,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc } from './firebase';
import { db } from './firebase';
import { User, ShopConfig } from './types';

// Components
import Dashboard from './components/Dashboard';
import EntryExit from './components/entry-exit';
import DeviceMovement from './components/movement';
import Inspection from './components/movement/Inspection';
import Maintenance from './components/movement/Maintenance';
import ApprovalAndParts from './components/movement/ApprovalAndParts';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Customers from './components/Customers';
import Settings from './components/Settings';
import SearchInvoice from './components/SearchInvoice';
import DeviceManagement from './components/DeviceManagement';
import Login from './components/Login';
import SetupWizard from './components/SetupWizard';

import Vault from './components/Vault';
import SecurityGuard from './components/SecurityGuard';

import { useTranslation } from 'react-i18next';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'entry-exit' | 'device-movement' | 'inspection' | 'maintenance' | 'inventory' | 'reports' | 'customers' | 'settings' | 'search' | 'vault' | 'device-management'>('dashboard');
  const [movementView, setMovementView] = useState<'hub' | 'inspection' | 'maintenance' | 'approval'>('hub');
  const [entryExitView, setEntryExitView] = useState<'hub' | 'entry' | 'exit'>('hub');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Maintain latest navigation state in a ref for back-listeners
  const navigationStateRef = React.useRef({ activeTab, movementView, entryExitView });

  useEffect(() => {
    navigationStateRef.current = { activeTab, movementView, entryExitView };
  }, [activeTab, movementView, entryExitView]);

  const handleBack = () => {
    const { activeTab: currentTab, movementView: currentMovement, entryExitView: currentEntryExit } = navigationStateRef.current;

    // 1. Dispatch custom event for child components to intercept
    const backEvent = new CustomEvent('app-back-button', { cancelable: true });
    const intercepted = !window.dispatchEvent(backEvent);

    if (intercepted) {
      return;
    }

    // 2. Main app navigation back
    if (currentTab === 'device-movement' && currentMovement !== 'hub') {
      setMovementView('hub');
    } else if (currentTab === 'entry-exit' && currentEntryExit !== 'hub') {
      setEntryExitView('hub');
    } else if (currentTab !== 'dashboard') {
      setActiveTab('dashboard');
    } else {
      setShowExitConfirm(true);
    }
  };

  // Bind Capacitor app backButton event & standard browser popstate
  useEffect(() => {
    let isMounted = true;
    let capSub: any = null;

    const setupListeners = async () => {
      // 1. Capacitor native backButton listener
      try {
        const { App: CapApp } = await import('@capacitor/app');
        capSub = await CapApp.addListener('backButton', () => {
          if (isMounted) {
            handleBack();
          }
        });
      } catch (err) {
        console.log('Capacitor App plugin not available, using fallback browser events');
      }

      // 2. Initial push state for browser popstate
      window.history.pushState({ appNav: true }, '');
    };

    setupListeners();

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state so that the browser doesn't actually navigate back
      window.history.pushState({ appNav: true }, '');
      handleBack();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      isMounted = false;
      if (capSub) {
        capSub.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    setMovementView('hub');
    setEntryExitView('hub');
  }, [activeTab]);

  useEffect(() => {
    document.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  useEffect(() => {
    const applyTheme = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('snd_settings') || '{}');
        if (settings.appearance === 'normal') {
          document.documentElement.classList.add('light-app');
        } else {
          document.documentElement.classList.remove('light-app');
        }
      } catch (e) {
        console.error("Theme apply failed", e);
      }
    };
    applyTheme();
    window.addEventListener('snd_settings_changed', applyTheme);
    return () => window.removeEventListener('snd_settings_changed', applyTheme);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // Check for session in localStorage
        const savedUser = localStorage.getItem('snd_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
          checkAutoBackup();
        }

        // Fetch Shop Config with timeout/resilience
        // We'll try to get it, if it fails we just log it and proceed
        try {
          const shopSnap = await getDoc(doc(db, 'settings', 'shop'));
          if (shopSnap.exists()) {
            setShopConfig(shopSnap.data() as ShopConfig);
          } else {
            if (savedUser) setShowSetup(true);
          }
        } catch (shopErr) {
          console.warn("Failed to fetch shop config, might be offline:", shopErr);
        }

        // Ensure default admin exists - wrap in try to prevent blocking
        try {
          const adminDoc = await getDoc(doc(db, 'users', 'primary-admin'));
          if (!adminDoc.exists()) {
            await setDoc(doc(db, 'users', 'primary-admin'), {
              username: 'admin',
              password: 'admin',
              name: 'المدير العام',
              role: 'admin',
              isPrimary: true
            });
            console.log("Default admin created");
          }
        } catch (adminErr) {
          console.warn("Could not check/create admin, might be offline:", adminErr);
        }
      } catch (e) {
        console.error("Initialization error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('snd_user', JSON.stringify(loggedInUser));
    
    // After login, check if shop config exists
    if (!shopConfig) {
      setShowSetup(true);
    }
  };

  const handleSignOut = async () => {
    try {
      const { Dialog } = await import('@capacitor/dialog');
      const { value } = await Dialog.confirm({
        title: t('common.signOut'),
        message: t('common.confirmSignOut') || 'Are you sure you want to sign out?',
        okButtonTitle: 'نعم',
        cancelButtonTitle: 'إلغاء'
      });
      if (value) {
        setUser(null);
        localStorage.removeItem('snd_user');
      }
    } catch (e) {
      if (window.confirm(t('common.confirmSignOut') || 'Are you sure you want to sign out?')) {
        setUser(null);
        localStorage.removeItem('snd_user');
      }
    }
  };

  const handleSetupComplete = (config: ShopConfig) => {
    setShopConfig(config);
    setShowSetup(false);
  };

  const checkAutoBackup = async () => {
    try {
      const settings = JSON.parse(localStorage.getItem('snd_settings') || '{}');
      if (!settings.autoBackup) return;

      const lastBackup = localStorage.getItem('last_auto_backup');
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (lastBackup !== todayStr) {
        // Check if current time matches or passed the backupTime
        const [targetH, targetM] = settings.backupTime.split(':').map(Number);
        if (now.getHours() > targetH || (now.getHours() === targetH && now.getMinutes() >= targetM)) {
          await runBackup(settings.backupPath);
          localStorage.setItem('last_auto_backup', todayStr);
        }
      }
    } catch (e) {
      console.error("Auto backup check failed", e);
    }
  };

  const runBackup = async (path: string) => {
    try {
      // Mock backup: Get all firestore data and save as JSON
      const collections = ['invoices', 'customers', 'inventory_items'];
      const backupData: any = {};
      
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        backupData[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      await Filesystem.writeFile({
        path: `${path}/backup_${new Date().getTime()}.json`,
        data: JSON.stringify(backupData),
        directory: Directory.Documents,
        recursive: true,
        encoding: Encoding.UTF8
      });
      console.log("Automatic backup completed successfully");
    } catch (e) {
      console.error("Backup execution failed", e);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0f0f0f] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (showSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} shopName={shopConfig?.shopName} fiscalYear={shopConfig?.fiscalYear} />;
      case 'entry-exit':
        return <EntryExit onBack={() => setActiveTab('dashboard')} user={user} view={entryExitView} setView={setEntryExitView} />;
      case 'device-movement':
        return <DeviceMovement onBack={() => setActiveTab('dashboard')} user={user} view={movementView} setView={setMovementView} />;
      case 'approval':
        return <ApprovalAndParts user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'inspection':
        return <Inspection user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'maintenance':
        return <Maintenance user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'inventory':
        return <Inventory user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'reports':
        return <Reports onBack={() => setActiveTab('dashboard')} />;
      case 'vault':
        return <Vault user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'customers':
        return <Customers user={user} onBack={() => setActiveTab('dashboard')} />;
      case 'settings':
        return <Settings user={user} onShopConfigUpdate={setShopConfig} />;
      case 'search':
        return <SearchInvoice onBack={() => setActiveTab('dashboard')} />;
      case 'device-management':
        return <DeviceManagement user={user} onBack={() => setActiveTab('dashboard')} />;
      default:
        return <Dashboard onNavigate={setActiveTab} shopName={shopConfig?.shopName} fiscalYear={shopConfig?.fiscalYear} />;
    }
  };

  return (
    <SecurityGuard>
      <div className={`min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-orange-500/30 ${i18n.language === 'ar' ? 'font-arabic' : ''}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="flex h-screen overflow-hidden">
          {/* ... desktop navigation and main content handled below ... */}
          <aside className="w-20 lg:w-72 bg-[#0f0f0f] border-r border-white/5 flex-col hidden md:flex sticky top-0 h-screen transition-all z-50">
          <div className="p-6 flex items-center lg:justify-start justify-center gap-3">
            {shopConfig?.logoUrl ? (
              <img src={shopConfig.logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-black/50" />
            ) : (
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                <Router className="text-white w-6 h-6" />
              </div>
            )}
            <span className="font-black text-xl tracking-tighter text-white hidden lg:block truncate">{shopConfig?.shopName || 'SND SYSTEM'}</span>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-2 overflow-hidden">
            <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={22} />} label={t('common.dashboard')} />
            <NavItem active={activeTab === 'entry-exit'} onClick={() => setActiveTab('entry-exit')} icon={<FilePlus size={22} />} label={t('common.entryExit')} />
            <NavItem active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} icon={<CircleDollarSign size={22} />} label={t('common.vault')} />
            <NavItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={22} />} label={t('common.customers')} />
            <NavItem active={activeTab === 'device-movement'} onClick={() => setActiveTab('device-movement')} icon={<SettingsIcon size={22} />} label={t('common.deviceMovement')} />
            <NavItem active={activeTab === 'inspection'} onClick={() => setActiveTab('inspection')} icon={<ClipboardCheck size={22} />} label="فحص" />
            <NavItem active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={<Wrench size={22} />} label="صيانة" />
          </nav>

          <div className="p-4 border-t border-white/5 space-y-2">
            <button onClick={handleSignOut} className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all border border-red-500/20 group font-bold">
              <LogOut size={22} className="group-hover:scale-110 transition-transform" />
              <span className="font-medium hidden lg:block">{t('common.signOut')}</span>
            </button>
          </div>
        </aside>

        {/* Main View Area */}
        <main className="flex-1 flex flex-col relative bg-[#0a0a0a] overflow-hidden">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 md:px-8 py-3 flex items-center justify-between min-h-[64px]">
            <div className="flex items-center gap-3">
              <div className="md:hidden flex items-center gap-2 -mr-1.5">
                 {shopConfig?.logoUrl ? (
                   <img src={shopConfig.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
                 ) : (
                   <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                      <Router className="text-white w-5 h-5" />
                   </div>
                 )}
              </div>

              {activeTab !== 'dashboard' && (
                <button 
                  onClick={handleBack}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
                  title="العودة للخلف"
                >
                  <ArrowLeft size={18} className="rtl:rotate-180" />
                </button>
              )}

              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-cairo">
                {activeTab === 'device-management' ? 'إدارة الأجهزة' : 
                 activeTab === 'entry-exit' ? (
                   entryExitView === 'entry' ? 'دخول وخروج أجهزة - دخول أجهزة' :
                   entryExitView === 'exit' ? 'دخول وخروج أجهزة - خروج أجهزة' :
                   (i18n.language === 'ar' ? 'دخول وخروج أجهزة' : 'Device Entry & Exit')
                 ) :
                 activeTab === 'device-movement' ? (
                   movementView === 'inspection' ? 'قسم الصيانة - إجراء فحص' :
                   movementView === 'maintenance' ? 'قسم الصيانة - إجراء صيانة' :
                   movementView === 'approval' ? 'قسم الصيانة - انتظار الموافقة والقطع' :
                   (i18n.language === 'ar' ? 'قسم الصيانة' : 'Maintenance Department')
                 ) :
                 activeTab === 'inspection' ? (i18n.language === 'ar' ? 'فحص الأجهزة' : 'Inspection') :
                 activeTab === 'maintenance' ? (i18n.language === 'ar' ? 'صيانة الأجهزة' : 'Maintenance') :
                 activeTab === 'approval' ? (i18n.language === 'ar' ? 'انتظار الموافقة والقطع' : 'Approval & Parts') :
                 activeTab === 'vault' ? (i18n.language === 'ar' ? 'الحسابات' : 'Accounts') :
                 t(`common.${activeTab.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`)}
              </h2>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={handleSignOut} className="flex items-center gap-2 mr-1 md:mr-0 group relative" title={t('common.signOut')}>
                <div className="text-right hidden sm:block group-hover:text-red-400 transition-colors">
                  <p className="text-[10px] font-bold text-gray-200 line-clamp-1">{user.name}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 group-hover:bg-red-500 group-hover:text-white flex items-center justify-center transition-all relative">
                  <span className="absolute group-hover:opacity-0 transition-opacity font-black text-xs font-mono">{user.name.charAt(0)}</span>
                  <LogOut size={14} className="opacity-0 group-hover:opacity-100 absolute transition-opacity" />
                </div>
              </button>

              <div className="md:hidden flex items-center">
                 <button 
                   onClick={() => setActiveTab('settings')}
                   className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-all text-gray-400 hover:text-white"
                 >
                   <MoreVertical size={20} />
                 </button>
              </div>
            </div>
          </header>

          {/* Tab Content */}
          <div className={`flex-1 ${activeTab === 'dashboard' ? 'overflow-hidden' : 'overflow-y-auto'} p-4 md:p-8 pb-28 md:pb-8`}>
            <div className="max-w-7xl mx-auto min-h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Navigation - Mobile Only */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#0f0f0f]/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/5 py-2 px-6 flex items-center justify-around shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-2xl mobile-bottom-nav" dir="rtl">
            <MobileNavItem 
              active={activeTab === 'entry-exit'} 
              onClick={() => setActiveTab('entry-exit')} 
              icon={<ArrowRightLeft size={22} />} 
              label="دخول وخروج"
              colorClass="text-orange-500"
            />
            <MobileNavItem 
              active={activeTab === 'approval'} 
              onClick={() => setActiveTab('approval')} 
              icon={<Clock size={22} />} 
              label="الموافقة والقطع"
              colorClass="text-amber-500"
            />
            <div className="relative -top-3">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="w-14 h-14 bg-white dark:bg-[#1a1a1a] rounded-full flex flex-col items-center justify-center shadow-xl ring-4 ring-gray-100 dark:ring-[#0f0f0f] mobile-center-btn border border-gray-200 dark:border-white/5"
              >
                <div className="grid grid-cols-2 gap-[2px] w-[20px] h-[20px]">
                  <div className="bg-orange-600 rounded-[3px]"></div>
                  <div className="bg-blue-600 rounded-[3px]"></div>
                  <div className="bg-amber-500 rounded-[3px]"></div>
                  <div className="bg-emerald-600 rounded-[3px]"></div>
                </div>
              </button>
            </div>
            <MobileNavItem 
              active={activeTab === 'inspection'} 
              onClick={() => setActiveTab('inspection')} 
              icon={<ClipboardCheck size={22} />} 
              label="فحص"
              colorClass="text-purple-500"
            />
            <MobileNavItem 
              active={activeTab === 'maintenance'} 
              onClick={() => setActiveTab('maintenance')} 
              icon={<Wrench size={22} />} 
              label="صيانة"
              colorClass="text-emerald-500"
            />
          </nav>
        </main>
      </div>

      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
              className="bg-[#121212] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <LogOut size={28} />
              </div>
              <h3 className="text-lg font-black text-white font-cairo mb-2">تأكيد الخروج</h3>
              <p className="text-gray-400 text-sm mb-6 font-bold leading-relaxed font-cairo">
                هل تريد بالفعل الخروج من البرنامج وإغلاقه؟
              </p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={async () => {
                    try {
                      const { App: CapApp } = await import('@capacitor/app');
                      await CapApp.exitApp();
                    } catch (err) {
                      console.error("Failed to exit app", err);
                      setShowExitConfirm(false);
                    }
                  }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 text-sm font-cairo cursor-pointer"
                >
                  خروج
                </button>
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-all text-sm font-cairo cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </SecurityGuard>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative ${
        active 
        ? 'bg-orange-600 text-white shadow-xl shadow-orange-900/30' 
        : 'text-gray-500 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={`${active ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}>{icon}</span>
      <span className="font-bold text-sm hidden lg:block">{label}</span>
      {active && <motion.div layoutId="nav-active" className="absolute left-0 w-1 lg:hidden h-6 bg-white rounded-full translate-x-[-8px]" />}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label, colorClass }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, colorClass: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? colorClass : 'text-gray-400 dark:text-gray-500 hover:' + colorClass}`}
    >
      <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-gray-100 dark:bg-white/10 shadow-inner' : ''}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-tighter opacity-80`}>{label}</span>
    </button>
  );
}
