import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, updateDoc, deleteDoc, addDoc, serverTimestamp } from '../firebase';
import { Save, RefreshCw, Smartphone, Database, Languages, LogOut, Shield, Fingerprint, Lock, Clock, HardDrive, Download, Archive, Upload, RotateCcw, FileText, User as UserIcon, Tag, X, Cpu, Calculator, ArrowLeft, Edit, Phone, Mail, Facebook, MapPin, Store } from 'lucide-react';
import { localDb } from '../lib/local-db';
import { User } from '../types';
import UserManagement from './UserManagement';
import EngineersTable from './EngineersTable';
import CategoriesTable from './CategoriesTable';
import DeviceManagement from './DeviceManagement';
import AccountingInputs from './AccountingInputs';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Device } from '@capacitor/device';
import { NativeBiometric } from 'capacitor-native-biometric';

export default function Settings({ user, onShopConfigUpdate }: { user: User, onShopConfigUpdate?: (config: any) => void }) {
  const { t, i18n } = useTranslation();
  
  const [invoiceCounter, setInvoiceCounter] = useState(0);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ active: boolean; value: number; label: string }>({ active: false, value: 0, label: '' });
  const [activeTab, setActiveTab ] = useState<'main' | 'general' | 'security' | 'backup' | 'users' | 'engineers' | 'categories' | 'device-management' | 'accounting-inputs'>('main');
  const [backupSubTab, setBackupSubTab] = useState<'list' | 'stats' | 'backup_manual' | 'export' | 'import' | 'archive' | 'reset' | 'audit'>('list');

  // Shop details states
  const [generalSubTab, setGeneralSubTab] = useState<'language' | 'details' | 'advanced'>('language');
  const [appearance, setAppearance] = useState<'normal' | 'dark'>('dark');
  const [printPaperSize, setPrintPaperSize] = useState<'A4' | '80mm'>('A4');
  const [shopName, setShopName] = useState('عالم الصيانة والتجارة');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [landline, setLandline] = useState('');
  const [phone1Call, setPhone1Call] = useState(false);
  const [phone1Whatsapp, setPhone1Whatsapp] = useState(false);
  const [phone2Call, setPhone2Call] = useState(false);
  const [phone2Whatsapp, setPhone2Whatsapp] = useState(false);
  const [landlineCall, setLandlineCall] = useState(false);
  const [landlineWhatsapp, setLandlineWhatsapp] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [isEditingShop, setIsEditingShop] = useState(false);

  // Bank Accounts
  const [bankYerName, setBankYerName] = useState('');
  const [bankYerAccount, setBankYerAccount] = useState('');
  const [bankSarName, setBankSarName] = useState('');
  const [bankSarAccount, setBankSarAccount] = useState('');
  const [bankUsdName, setBankUsdName] = useState('');
  const [bankUsdAccount, setBankUsdAccount] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');

  // Audit States
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    lastChecked: Date | null;
    invoiceCounter: { registered: number; actualMax: number; conflict: boolean };
    customerCounter: { registered: number; actualMax: number; conflict: boolean };
    totalDiscrepancies: any[];
    statusDiscrepancies: any[];
    paymentImbalances: any[];
    orphanedItems: any[];
    emptyInvoices: any[];
  } | null>(null);
  const [repairProgress, setRepairProgress] = useState<{
    status: 'idle' | 'running' | 'completed' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  // Security States
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinCode, setPinCode] = useState('');

  // Backup States
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupTime, setBackupTime] = useState('00:00');
  const [backupPath, setBackupPath] = useState('Documents/SND_Backups');
  const [backupCount, setBackupCount] = useState(0);

  const [statsData, setStatsData] = useState({
    invoices: 0,
    customers: 0,
    maintenance: 0,
    support: 0
  });

  const refreshStats = async () => {
    try {
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const customersSnap = await getDocs(collection(db, 'customers'));
      const maintenanceSnap = await getDocs(collection(db, 'maintenance_actions'));
      
      setStatsData({
        invoices: invoicesSnap.docs.length,
        customers: customersSnap.docs.length,
        maintenance: maintenanceSnap.docs.length,
        support: 0
      });
    } catch (e) {
      console.error('Error fetching statistics:', e);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      const s = await getDoc(doc(db, 'settings', 'app'));
      const data = s.data();
      setInvoiceCounter(data?.lastInvoiceNumber || 0);
      
      const localSettings = JSON.parse(localStorage.getItem('snd_settings') || '{}');
      setBiometricEnabled(localSettings.biometricEnabled || false);
      setPinEnabled(localSettings.pinEnabled || false);
      setPinCode(localSettings.pinCode || '');
      setAutoBackup(localSettings.autoBackup || false);
      setBackupTime(localSettings.backupTime || '00:00');
      setBackupPath(localSettings.backupPath || 'Documents/SND_Backups');
      setAppearance(localSettings.appearance || 'dark');
      setPrintPaperSize(localSettings.printPaperSize || 'A4');

      await refreshStats();

      try {
        const localDetails = await localDb.query("SELECT * FROM company_details LIMIT 1");
        if (localDetails.values && localDetails.values.length > 0) {
          const detail = localDetails.values[0];
          setShopName(detail.shopName || 'عالم الصيانة والتجارة');
          setPhone1(detail.phone1 || '');
          setPhone2(detail.phone2 || '');
          setLandline(detail.landline || '');
          setPhone1Call(detail.phone1Call === 1);
          setPhone1Whatsapp(detail.phone1Whatsapp === 1);
          setPhone2Call(detail.phone2Call === 1);
          setPhone2Whatsapp(detail.phone2Whatsapp === 1);
          setLandlineCall(detail.landlineCall === 1);
          setLandlineWhatsapp(detail.landlineWhatsapp === 1);
          setFacebookUrl(detail.facebookUrl || '');
          setMapUrl(detail.mapUrl || '');
          setEmail(detail.email || '');
          setBio(detail.bio || '');
          setLogoUrl(detail.logoUrl || '');
          setAddress(detail.address || '');
          setBankYerName(detail.bankYerName || '');
          setBankYerAccount(detail.bankYerAccount || '');
          setBankSarName(detail.bankSarName || '');
          setBankSarAccount(detail.bankSarAccount || '');
          setBankUsdName(detail.bankUsdName || '');
          setBankUsdAccount(detail.bankUsdAccount || '');
          setBankHolderName(detail.bankHolderName || '');
        }
      } catch (localErr) {
        console.warn("Failed to fetch local company details from SQLite:", localErr);
      }

      try {
        const shopSnap = await getDoc(doc(db, 'settings', 'shop'));
        if (shopSnap.exists()) {
          const shopData = shopSnap.data();
          setShopName(shopData.shopName || 'عالم الصيانة والتجارة');
          setPhone1(shopData.phone1 || '');
          setPhone2(shopData.phone2 || '');
          setLandline(shopData.landline || '');
          setPhone1Call(shopData.phone1Call ?? false);
          setPhone1Whatsapp(shopData.phone1Whatsapp ?? false);
          setPhone2Call(shopData.phone2Call ?? false);
          setPhone2Whatsapp(shopData.phone2Whatsapp ?? false);
          setLandlineCall(shopData.landlineCall ?? false);
          setLandlineWhatsapp(shopData.landlineWhatsapp ?? false);
          setFacebookUrl(shopData.facebookUrl || '');
          setMapUrl(shopData.mapUrl || '');
          setEmail(shopData.email || '');
          setBio(shopData.bio || '');
          setLogoUrl(shopData.logoUrl || '');
          setAddress(shopData.address || '');
          setBankYerName(shopData.bankYerName || '');
          setBankYerAccount(shopData.bankYerAccount || '');
          setBankSarName(shopData.bankSarName || '');
          setBankSarAccount(shopData.bankSarAccount || '');
          setBankUsdName(shopData.bankUsdName || '');
          setBankUsdAccount(shopData.bankUsdAccount || '');
          setBankHolderName(shopData.bankHolderName || '');

          // Save/Sync to local SQLite table "company_details" as well
          try {
            await localDb.run(
              `INSERT OR REPLACE INTO company_details (
                id, shopName, phone1, phone2, landline, 
                phone1Call, phone1Whatsapp, phone2Call, phone2Whatsapp, 
                landlineCall, landlineWhatsapp, facebookUrl, mapUrl, 
                email, bio, logoUrl, address, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                'main_details',
                shopData.shopName || 'عالم الصيانة والتجارة',
                shopData.phone1 || '',
                shopData.phone2 || '',
                shopData.landline || '',
                shopData.phone1Call ? 1 : 0,
                shopData.phone1Whatsapp ? 1 : 0,
                shopData.phone2Call ? 1 : 0,
                shopData.phone2Whatsapp ? 1 : 0,
                shopData.landlineCall ? 1 : 0,
                shopData.landlineWhatsapp ? 1 : 0,
                shopData.facebookUrl || '',
                shopData.mapUrl || '',
                shopData.email || '',
                shopData.bio || '',
                shopData.logoUrl || '',
                shopData.address || '',
                new Date().toISOString()
              ]
            );
          } catch (syncErr) {
            console.error("Failed to sync Firebase shop settings to local SQLite:", syncErr);
          }
        }
      } catch (shopErr) {
        console.warn("Failed to fetch shop settings from Firebase:", shopErr);
      }
    };
    fetch();
    refreshBackupCount();
  }, []);

  const refreshBackupCount = async () => {
    try {
      const info = await Device.getInfo();
      if (info.platform !== 'web') {
        const result = await Filesystem.readdir({
          path: backupPath,
          directory: Directory.Documents,
        });
        setBackupCount(result.files.length);
      } else {
        setBackupCount(0);
      }
    } catch (e) {
      setBackupCount(0);
    }
  };

  const runDatabaseAudit = async () => {
    setIsAuditing(true);
    setRepairProgress({ status: 'idle', message: '' });
    try {
      const invoicesRes = await localDb.query('SELECT * FROM invoices');
      const dbInvoices = invoicesRes.values || [];
      
      const itemsRes = await localDb.query('SELECT * FROM invoice_items');
      const dbItems = itemsRes.values || [];
      
      const txRes = await localDb.query('SELECT * FROM vault_transactions');
      const dbTransactions = txRes.values || [];
      
      const customersRes = await localDb.query('SELECT * FROM customers');
      const dbCustomers = customersRes.values || [];

      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      const settingsData = settingsDoc.data();
      const registeredLastInvoice = Number(settingsData?.lastInvoiceNumber) || 0;
      const registeredLastCustomer = Number(settingsData?.lastCustomerNumber) || 0;

      let maxInvoiceNum = 0;
      dbInvoices.forEach((inv: any) => {
        const num = parseInt(inv.invoiceNumber, 10);
        if (!isNaN(num) && num > maxInvoiceNum) {
          maxInvoiceNum = num;
        }
      });

      let maxCustomerNum = 0;
      dbCustomers.forEach((cust: any) => {
        const num = parseInt(cust.customerNumber, 10);
        if (!isNaN(num) && num > maxCustomerNum) {
          maxCustomerNum = num;
        }
      });

      const invoiceCounterConflict = registeredLastInvoice < maxInvoiceNum;
      const customerCounterConflict = registeredLastCustomer < maxCustomerNum;

      const totalDiscrepancies: any[] = [];
      const statusDiscrepancies: any[] = [];
      const invoiceItemGroups: Record<string, any[]> = {};

      dbItems.forEach((item: any) => {
        if (!invoiceItemGroups[item.invoiceId]) {
          invoiceItemGroups[item.invoiceId] = [];
        }
        invoiceItemGroups[item.invoiceId].push(item);
      });

      dbInvoices.forEach((inv: any) => {
        const items = invoiceItemGroups[inv.id] || [];
        const computedTotal = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

        if (Math.abs(computedTotal - Number(inv.totalCost)) > 0.01) {
          totalDiscrepancies.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            currentTotal: inv.totalCost,
            computedTotal
          });
        }

        let hasPending = false;
        let hasReady = false;
        let hasDelivered = false;

        items.forEach((item: any) => {
          if (['new', 'testing', 'repairing', '10', '20', '30', '35', '40'].includes(item.status)) hasPending = true;
          else if (['ready', 'intact', 'unrepairable', 'refused', '50'].includes(item.status)) hasReady = true;
          else if (['delivered', '60'].includes(item.status)) hasDelivered = true;
        });

        let expectedStatus = inv.status;
        if (items.length > 0) {
          if (!hasPending && !hasReady && hasDelivered) {
            expectedStatus = inv.status === 'delivered' ? 'delivered' : '60';
          } else if (hasReady || hasDelivered) {
            expectedStatus = inv.status === 'ready' ? 'ready' : '50';
          } else {
            expectedStatus = inv.status === 'new' ? 'new' : '10';
          }
        }

        if (inv.status !== expectedStatus) {
          statusDiscrepancies.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            currentStatus: inv.status,
            expectedStatus
          });
        }
      });

      const paymentImbalances: any[] = [];
      const txGroupsByInvoiceNum: Record<string, any[]> = {};
      dbTransactions.forEach((tx: any) => {
        if (tx.type === 'income' && tx.invoiceNumber) {
          const invNum = String(tx.invoiceNumber).trim();
          if (!txGroupsByInvoiceNum[invNum]) {
            txGroupsByInvoiceNum[invNum] = [];
          }
          txGroupsByInvoiceNum[invNum].push(tx);
        }
      });

      dbInvoices.forEach((inv: any) => {
        const txs = txGroupsByInvoiceNum[String(inv.invoiceNumber).trim()] || [];
        const computedPaid = txs.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

        if (Math.abs(computedPaid - Number(inv.amountPaid)) > 0.01) {
          paymentImbalances.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName,
            currency: inv.currency,
            amountPaidOnInvoice: inv.amountPaid,
            amountInLedger: computedPaid,
            status: inv.status,
            totalCost: inv.totalCost
          });
        }
      });

      const orphanedItems: any[] = [];
      const invoiceIdsSet = new Set(dbInvoices.map((inv: any) => inv.id));
      dbItems.forEach((item: any) => {
        if (!invoiceIdsSet.has(item.invoiceId)) {
          orphanedItems.push(item);
        }
      });

      const emptyInvoices: any[] = [];
      dbInvoices.forEach((inv: any) => {
        if (!invoiceItemGroups[inv.id] || invoiceItemGroups[inv.id].length === 0) {
          emptyInvoices.push(inv);
        }
      });

      setAuditResults({
        lastChecked: new Date(),
        invoiceCounter: {
          registered: registeredLastInvoice,
          actualMax: maxInvoiceNum,
          conflict: invoiceCounterConflict
        },
        customerCounter: {
          registered: registeredLastCustomer,
          actualMax: maxCustomerNum,
          conflict: customerCounterConflict
        },
        totalDiscrepancies,
        statusDiscrepancies,
        paymentImbalances,
        orphanedItems,
        emptyInvoices
      });
    } catch (e: any) {
      console.error('Audit calculations failed:', e);
    } finally {
      setIsAuditing(false);
    }
  };

  const repairAllDiscrepancies = async () => {
    if (!auditResults) return;
    setRepairProgress({ status: 'running', message: 'جاري تسوية البيانات وتحديث قواعد الفحص التلقائي...' });
    try {
      let step = 1;
      const totalSteps = 6;

      if (auditResults.invoiceCounter.conflict) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] جاري ترفيع عدّاد الفواتير التلقائي ليكون ${auditResults.invoiceCounter.actualMax}...` });
        await setDoc(doc(db, 'settings', 'app'), { lastInvoiceNumber: auditResults.invoiceCounter.actualMax }, { merge: true });
        setInvoiceCounter(auditResults.invoiceCounter.actualMax);
      }
      step++;

      if (auditResults.customerCounter.conflict) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] جاري تصحيح عدّاد هوية العملاء ليكون ${auditResults.customerCounter.actualMax}...` });
        await setDoc(doc(db, 'settings', 'app'), { lastCustomerNumber: auditResults.customerCounter.actualMax }, { merge: true });
      }
      step++;

      if (auditResults.totalDiscrepancies.length > 0) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] إعادة احتساب مجاميع لـ ${auditResults.totalDiscrepancies.length} فواتير...` });
        for (const item of auditResults.totalDiscrepancies) {
          await updateDoc(doc(db, 'invoices', item.id), { totalCost: item.computedTotal });
        }
      }
      step++;

      if (auditResults.statusDiscrepancies.length > 0) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] مزامنة الحالة الفنية لـ ${auditResults.statusDiscrepancies.length} فواتير...` });
        for (const item of auditResults.statusDiscrepancies) {
          await updateDoc(doc(db, 'invoices', item.id), { status: item.expectedStatus });
        }
      }
      step++;

      if (auditResults.paymentImbalances.length > 0) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] موازنة وتسجيل المعاملات المالية المفقودة لـ ${auditResults.paymentImbalances.length} حالة...` });
        for (const item of auditResults.paymentImbalances) {
          if (item.amountInLedger === 0 && item.amountPaidOnInvoice > 0) {
            const txId = `tx_audit_${item.invoiceNumber}_${Math.random().toString(36).substring(2, 6)}`;
            await addDoc(collection(db, 'vault_transactions'), {
              id: txId,
              currency: item.currency,
              amount: Number(item.amountPaidOnInvoice),
              customerName: item.customerName || 'عميل نقدي',
              invoiceNumber: String(item.invoiceNumber),
              userName: user.name || 'المدير العام',
              userNumber: 1,
              userId: user.id || 'primary-admin',
              timestamp: serverTimestamp(),
              type: 'income',
              notes: `قيد تسوية لمطابقة المدفوع بالفاتورة #${item.invoiceNumber}`
            });
          } else if (item.amountInLedger > 0 && item.amountPaidOnInvoice !== item.amountInLedger) {
            let newStatus = item.status;
            if (item.amountInLedger >= item.totalCost) {
              newStatus = 'delivered';
            }
            await updateDoc(doc(db, 'invoices', item.id), { 
              amountPaid: item.amountInLedger,
              status: newStatus
            });
          }
        }
      }
      step++;

      if (auditResults.orphanedItems.length > 0) {
        setRepairProgress({ status: 'running', message: `[${step}/${totalSteps}] حذف وإزالة ${auditResults.orphanedItems.length} قطعة غيار يتيمة...` });
        for (const item of auditResults.orphanedItems) {
          await deleteDoc(doc(db, 'invoice_items', item.id));
        }
      }
      step++;

      setRepairProgress({ status: 'completed', message: 'تم التحديث وتسوية قاعدة الاختلافات بنجاح! جميع أرقام العدادات والمعاملات تتوافق 100% مع سجلات خادم Firebase.' });
      await runDatabaseAudit();
      await refreshStats();
    } catch (e: any) {
      console.error('Auto repair failed:', e);
      setRepairProgress({ status: 'error', message: `حدث خطأ أثناء الإصلاح: ${e.message || e}` });
    }
  };

  const handleSaveSettings = () => {
    const settings = {
      biometricEnabled,
      pinEnabled,
      pinCode,
      autoBackup,
      backupTime,
      backupPath,
      appearance,
      printPaperSize
    };
    localStorage.setItem('snd_settings', JSON.stringify(settings));
    setDoc(doc(db, 'settings', 'app'), { appSettings: settings }, { merge: true });
    alert(t('settings.saved'));
    window.dispatchEvent(new Event('snd_settings_changed'));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), { lastInvoiceNumber: Number(invoiceCounter) }, { merge: true });
      alert(t('settings.saved'));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (confirm(t('common.confirmSignOut') || 'Are you sure you want to sign out?')) {
      localStorage.removeItem('snd_user');
      window.location.reload();
    }
  };

  const resetAllDataTemp = async () => {
    console.log('ResetAllDataTemp started executing');
    try {
      
      setProgress({ active: true, value: 0, label: 'جاري تهيئة النظام...' });

      // Clear Firestore
      const collectionsToClear = ['invoices', 'invoice_items', 'customers', 'maintenance_actions', 'approval_actions', 'engineers', 'vault_transactions', 'inventory_items', 'device_categories', 'device_models'];
      
      for (let i = 0; i < collectionsToClear.length; i++) {
        const colName = collectionsToClear[i];
        setProgress({ active: true, value: (i / collectionsToClear.length) * 50, label: `جاري حذف ${colName}...` });
        
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs;
        
        for (let j = 0; j < docs.length; j += 400) {
          const chunk = docs.slice(j, j + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      
      // Clear Local SQLite
      setProgress({ active: true, value: 50, label: 'جاري تنظيف قاعدة البيانات المحلية...' });
      const tablesToClear = ['invoices', 'invoice_items', 'customers', 'maintenance_actions', 'approval_actions', 'engineers', 'vault_transactions', 'inventory_items', 'device_categories', 'device_models'];
      for (const table of tablesToClear) {
        try {
          console.log(`Clearing table ${table}...`);
          const res = await localDb.run(`DELETE FROM ${table}`);
          console.log(`Table ${table} cleared`, res);
        } catch (e) {
          console.error(`Error clearing table ${table}`, e);
        }
      }
      
      setProgress({ active: true, value: 80, label: 'جاري إعداد النظام...' });
      
      const finalBatch = writeBatch(db);
      finalBatch.set(doc(db, 'settings', 'app'), { lastInvoiceNumber: 0, lastCustomerNumber: 0 }, { merge: true });
      await finalBatch.commit();
      
      setProgress({ active: false, value: 100, label: '' });
      setInvoiceCounter(0);
      await refreshStats();
      alert('تم حذف جميع البيانات بنجاح.');
      window.location.reload(); 
    } catch (e: any) {
      console.error('Error during resetAllDataTemp:', e);
      setProgress({ active: false, value: 0, label: '' });
      alert('Error: ' + e.message);
    }
  };

  const generateExperimentalData = async () => {
    console.log('GenerateExperimentalData started executing');
    try {
        setProgress({ active: true, value: 5, label: 'جاري تنظيف قواعد البيانات القديمة...' });

        // First clean old data to avoid duplicates/integrity errors
        const tablesToClear = ['invoices', 'invoice_items', 'customers', 'maintenance_actions', 'approval_actions', 'engineers', 'vault_transactions', 'inventory_items', 'device_categories', 'device_models'];
        for (const table of tablesToClear) {
          try {
            await localDb.run(`DELETE FROM ${table}`);
          } catch (e) {
            console.error(`Error clearing ${table}`, e);
          }
        }

        setProgress({ active: true, value: 15, label: 'جاري تهيئة تصنيفات الأجهزة والمهندسين والعملاء الجدد...' });

        const now = new Date().toISOString();

        // 1. Categories
        const categoryCols = ['id', 'name', 'createdAt', 'updatedAt'];
        const categoryRows = [
          ['cat_mobile', 'موبايل', now, now],
          ['cat_laptop', 'حاسوب محمول', now, now],
          ['cat_screen', 'شاشة / تلفاز', now, now],
          ['cat_tablet', 'أجهزة لوحية', now, now]
        ];
        
        // 2. Models
        const modelCols = ['id', 'categoryId', 'name', 'createdAt', 'updatedAt'];
        const modelRows = [
          ['model_ip15', 'cat_mobile', 'iPhone 15 Pro Max', now, now],
          ['model_ip13', 'cat_mobile', 'iPhone 13', now, now],
          ['model_s24', 'cat_mobile', 'Samsung S24 Ultra', now, now],
          ['model_p60', 'cat_mobile', 'Huawei P60 Pro', now, now],
          ['model_mac', 'cat_laptop', 'MacBook Pro M3', now, now],
          ['model_think', 'cat_laptop', 'Lenovo ThinkPad', now, now],
          ['model_xps', 'cat_laptop', 'Dell XPS 15', now, now],
          ['model_lg55', 'cat_screen', 'LG OLED 55 Inch', now, now],
          ['model_sam65', 'cat_screen', 'Samsung QLED 65', now, now],
          ['model_ipad', 'cat_tablet', 'iPad Pro 12.9', now, now],
          ['model_tab', 'cat_tablet', 'Samsung Tab S9', now, now]
        ];

        // 3. Engineers
        const engineerCols = ['id', 'name', 'updatedAt'];
        const engineerRows = [
          ['eng_osama', 'المهندس أسامة الحاشدي', now],
          ['eng_ali', 'المهندس علي السقاف', now],
          ['eng_hasan', 'المهندس حسن المرادي', now],
          ['eng_khaled', 'المهندس خالد اليافعي', now]
        ];

        // 4. Customers
        const customerCols = ['id', 'customerNumber', 'name', 'phone1', 'phone2', 'createdAt', 'updatedAt'];
        const customerRows = [
          ['cust_1', 1, 'أحمد بن محمد الجابري', '777111222', '711111222', now, now],
          ['cust_2', 2, 'صالح علي علوان الزبيدي', '777333444', '', now, now],
          ['cust_3', 3, 'مؤسسة الأمل التجارية', '777555666', '01222333', now, now],
          ['cust_4', 4, 'عبد الرحمن بن يحيى الكاف', '777255255', '', now, now],
          ['cust_5', 5, 'صادق حسن بن عقيل', '771234567', '', now, now],
          ['cust_6', 6, 'فؤاد عبد الله العبسي', '773456789', '', now, now],
          ['cust_7', 7, 'بشير محمد اليافعي', '775678901', '', now, now],
          ['cust_8', 8, 'سليمان خالد معوضه', '770123456', '', now, now],
          ['cust_9', 9, 'شركة الحلول الرقمية', '777987654', '', now, now],
          ['cust_10', 10, 'خالد عبد الرزاق عثمان', '772345678', '', now, now],
          ['cust_11', 11, 'منصور وليد اليماني', '774567890', '', now, now],
          ['cust_12', 12, 'يسرى فيصل جرجرة', '778901234', '', now, now],
          ['cust_13', 13, 'ماجد فهد بن شيبان', '770654321', '', now, now],
          ['cust_14', 14, 'خليل إبراهيم الهطاري', '772468013', '', now, now],
          ['cust_15', 15, 'محمد ناصر السعدي', '776543210', '', now, now]
        ];

        // Helper to insert chunks of rows
        const chunkInsert = async (table: string, columns: string[], rows: any[][], chunkSize: number = 20) => {
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
            const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
            const params = chunk.flat();
            await localDb.run(sql, params);
          }
        };

        // Insert primary categories, models, engineers, customers
        await chunkInsert('device_categories', categoryCols, categoryRows);
        await chunkInsert('device_models', modelCols, modelRows);
        await chunkInsert('engineers', engineerCols, engineerRows);
        await chunkInsert('customers', customerCols, customerRows);

        setProgress({ active: true, value: 30, label: 'جاري توليد 100 فاتورة تجريبية بكامل التفاصيل الفنية والمالية...' });

        // Predefined list of fault descriptions to construct realistic data
        const faultOptions = [
          { categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'iPhone 15 Pro Max', faultType: 'كسر بالشاشة الأمامية والغطاء الخلفي', customerProblem: 'الشاشة سوداء تماماً واللمس لا يستجيب والحرارة مرتفعة عند الشحن', engineerReport: 'تبديل شاشة وسوبر أموليد كاملة واستبدال زجاج الظهر', technicalNotes: 'تم الإصلاح وتثبيت الشاشة مجدداً بكفاءة والعودة للعمل', costFactor: 1.2 },
          { categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'Samsung S24 Ultra', faultType: 'رطوبة ومنفذ شحن مخلوع', customerProblem: 'لا يشحن بتاتاً ورطوبة فلاتة الشحن السفلية من السوائل', engineerReport: 'تغيير منفذ الشحن تايب سي وتنظيف رطوبة البورد السفلية بالموجات', technicalNotes: 'تم الإصلاح والشحن الفائق يعمل بنجاح والاتصال مستقر', costFactor: 0.8 },
          { categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'iPhone 13', faultType: 'انخفاض صحة البطارية وتفريغ سريع', customerProblem: 'الجهاز يطفئ فجأة عند الوصول لـ 30%', engineerReport: 'استبدال شيب قياس الطاقة + بطارية أصلية مجددة', technicalNotes: 'تم التركيب والصحة الآن 100% بدون أي رسائل تحذيرية بالكامل', costFactor: 0.6 },
          { categoryId: 'cat_laptop', deviceType: 'حاسوب محمول', deviceName: 'MacBook Pro M3', faultType: 'عطل كرت الشاشة وسخونة المعالج', customerProblem: 'شاشة وميضية رمادية وتجمد تام للنظام عند بدء العمل', engineerReport: 'إعادة لحام شيب كارت الشاشة ريبولينج وتطهير مجرى تدفق الهواء', technicalNotes: 'مستحيل الصيانة للتفحم التكتلي لطبق المذربورد الداخلي مع تلف الممر', costFactor: 2.0 },
          { categoryId: 'cat_laptop', deviceType: 'حاسوب محمول', deviceName: 'Lenovo ThinkPad', faultType: 'ترقية قرص التخزين SSD وتنظيف المروحة', customerProblem: 'بطء شديد وتأخر إقلاع النظام وصوت شخير من المروحة متقطع', engineerReport: 'استبدال القرص القديم بقرص فائق السرعة NVMe PCIe 512GB وصيانة موجه المروحة', technicalNotes: 'تمت الترقية والإقلاع الآن يستغرق 6 ثوانٍ فقط والمروحة هادئة وسلسة', costFactor: 0.5 },
          { categoryId: 'cat_laptop', deviceType: 'حاسوب محمول', deviceName: 'Dell XPS 15', faultType: 'تضرر كيبورد وتلف مخرج الشاحن', customerProblem: 'بعض الأزرار تالفة مع خلل الشاحن وعدم التوصيل الثابت للمدخل الفني', engineerReport: 'استبدال كيبورد جديدة وصيانة وتلحيم مدخل الطاقة وتثبيت الكابل الداخلي', technicalNotes: 'تم الإصلاح والتعزيز بنجاح عالي وحالة الكيبورد ممتازة', costFactor: 1.0 }
        ];

        const systemStatuses = [
          { status: '10', subStatus: '' },                // جديد (New) - 0
          { status: '30', subStatus: 'awaiting_approval' }, // بانتظار الموافقة - 1
          { status: '35', subStatus: 'awaiting_parts' },    // بانتظار قطع الغيار - 2
          { status: '40', subStatus: 'repairing' },         // قيد الصيانة - 3
          { status: '50', subStatus: 'ready' },             // جاهز وسليم - 4
          { status: '50', subStatus: 'intact' },            // فحص سليم بدون صيانة - 5
          { status: '50', subStatus: 'unrepairable' },      // غير قابل للإصلاح - 6
          { status: '50', subStatus: 'refused' },           // مرفوض من العميل - 7
          { status: '60', subStatus: 'ready' },             // تم تسليمه (مصلح) - 8
          { status: '60', subStatus: 'unrepairable' }       // تم تسليمه (غير مصلح) - 9
        ];

        const invoicesRows: any[][] = [];
        const itemsRows: any[][] = [];
        const transRows: any[][] = [];

        // Make invoice index loop from 1 to 100 which creates invoice IDs from 1001 to 1100
        for (let i = 1; i <= 100; i++) {
          const invNum = 1000 + i;
          const invId = `inv_${invNum}`;
          
          // Stagger dates in the last 30 days
          const invDate = new Date();
          invDate.setDate(invDate.getDate() - (100 - i) * 0.3);
          const dateStr = invDate.toISOString();

          // Select customer and currency
          const custIdx = (i - 1) % customerRows.length;
          const custObj = customerRows[custIdx];
          const custId = custObj[0];
          const custName = custObj[2];
          
          let currency = 'SAR';
          if (i % 5 === 0) currency = 'USD';
          else if (i % 2 === 0) currency = 'RY';

          // Determine items for this invoice
          const invoiceItemsList: any[] = [];
          
          if (i === 50) {
            // Special Invoice 1050 with EXACTLY 10 items to cover every possible logical state combination
            // as requested by the user: (repairable, non-repairable, fully safe/sound, customer approved, customer did not approve, etc.)
            const specItems = [
              // 1. New (دخول جديد - يحتاج فحص)
              { status: '10', subStatus: '', categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'iPhone 15 Pro Max', faultType: 'كسر زجاج كاميرات واسع', customerProblem: 'مغبش الكاميرا مشوشة الصنع للصور زجاج خارجي مهشم', cost: 150, eng: '', report: '', notes: 'في انتظار المعاينة', fail: '' },
              // 2. Awaiting Approval (انتظار موافقة العميل)
              { status: '30', subStatus: 'awaiting_approval', categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'Samsung S24 Ultra', faultType: 'انطفاء عند نسبة الشحن 20%', customerProblem: 'الجهاز يفصل باور أثناء تحميل الفيديو ولا يقلم إلا بالشاحن', cost: 250, eng: 'المهندس علي السقاف', report: 'فحص استقراري ومراقبة سحب أمبير البطارية', notes: 'بانتظار موافقة العميل على كلفة استبدال فلاتة الشحن وبوردة الباور السفلي', fail: '' },
              // 3. Awaiting Parts (انتظار قطع الغيار من الخارج)
              { status: '35', subStatus: 'awaiting_parts', categoryId: 'cat_laptop', deviceType: 'حاسوب محمول', deviceName: 'MacBook Pro M3', faultType: 'رطوبة وتصلب مسار التراك باد', customerProblem: 'مؤشر الفأرة مجمد تام وزر لوحة اللمس لا يستجيب للضغط', cost: 600, eng: 'المهندس حسن المرادي', report: 'تنظيف دوائر التراك باد والتجفيف الكهرومغناطيسي', notes: 'جاري استيراد سلك شريط اللمس الموجه وكابل التراك باد من الموديل التالف بالخارج', fail: 'انتظار شريط اللمس المطور وكابل التوصيل الفلوريدي' },
              // 4. Repairing / Under Maintenance (قيد الصيانة حالياً بعد توفر القطعة)
              { status: '40', subStatus: 'repairing', categoryId: 'cat_laptop', deviceType: 'حاسوب محمول', deviceName: 'Lenovo ThinkPad', faultType: 'تضرر مروحة وتصلب معجون تبريد المعالج', customerProblem: 'الجهاز يسخن لدرجة 90 درجة وينطفئ مع صوت مروحة حاد جداً', cost: 400, eng: 'المهندس أسامة الحاشدي', report: 'استبدال المروحة بـ ORIGINAL وتجديد المعجون بالكامل للبروسيسور', notes: 'وصلت مروحة التبريد وهي قيد التركيب وضبط العازل الكهرومائي', fail: '' },
              // 5. Ready - Repaired (جاهز للتسليم ومصلح بنجاح)
              { status: '50', subStatus: 'ready', categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'Huawei P60 Pro', faultType: 'انتفاخ البطارية وتراجع ساعات الدوام', customerProblem: 'البطارية تنقص كلياً بنصف ساعة ودفع غطاء الظهر الخلفي للخارج', cost: 180, eng: 'المهندس علي السقاف', report: 'تغيير بطارية أصلية بسعة عالية وتجديد شريط تثبيت الظهر الدائري للمحمول', notes: 'الجهاز مصلح وجاهز للاستلام وصحة البطارية عادت 100%', fail: '' },
              // 6. Ready - Intact (جاهز - سليم بدون صيانة)
              { status: '50', subStatus: 'intact', categoryId: 'cat_screen', deviceType: 'شاشة / تلفاز', deviceName: 'LG OLED 55 Inch', faultType: 'وميض باللون الأحمر ولا يعرض صورة مع تذبذب طاقة', customerProblem: 'يرفض العرض ويومض باستمرار مع أصوات تكتكة بورد', cost: 50, eng: 'المهندس خالد اليافعي', report: 'سليم تماماً - الخلل بالفولتية من المصدر المغذي لخدمة العميل بالمنزل', notes: 'تم فحص استقرار الجهاز على مولد تيار مستقل وثبات تام للحرارة ولا خلل فني', fail: '' },
              // 7. Ready - Unrepairable (جاهز - غير قابل للإصلاح كلياً)
              { status: '50', subStatus: 'unrepairable', categoryId: 'cat_tablet', deviceType: 'أجهزة لوحية', deviceName: 'iPad Pro 12.9', faultType: 'كسر ذو زاوية بالمذربورد وتلف آيسي المعالج كلياً', customerProblem: 'سقط من الطابق الثالث غاص في المياه ولم يعد يعرض شيء الموت التام', cost: 50, eng: 'المهندس حسن المرادي', report: 'كسر حاد بالطبقات التحتية للمذربورد وتلف طقم آيسيات التحكم الرئيسية وتفحم مسارات الإشارات العالية', notes: 'تعذر كلياً محاولة الإصلاح لشدة الضرر البنيوي باللوحة', fail: 'احتراق المعالج والمسارات الداخلية وتفحم طبقات المذربورد تماماً' },
              // 8. Ready - Refused (جاهز - رفض العميل الإصلاح)
              { status: '50', subStatus: 'refused', categoryId: 'cat_mobile', deviceType: 'موبايل', deviceName: 'iPhone 13', faultType: 'تلف كامل لنظام التعرف على الوجه الفراغي وشاشة مكسورة', customerProblem: 'شاشة مكسورة والمقاييس البيومترية لا تعمل بانتظام', cost: 30, eng: 'المهندس خالد اليافعي', report: 'يحتاج تبديل فلاتات الكاميرا والعمق العاكس وشاشة أمامية وشاسيه ومكونات الفيس آي دي', notes: 'تم تقديم كلفة المقايضة وقطع الغيار ورفض العميل دفع المبلغ لارتفاع سعرها', fail: 'لم يوافق العميل للارتفاع - رفض الإصلاح وفقط استحقاق رسوم الفحص المخفضة' },
              // 9. Delivered (تم تسليمه للعميل ومقبوض قيمتها بنجاح)
              { status: '60', subStatus: 'ready', categoryId: 'cat_tablet', deviceType: 'أجهزة لوحية', deviceName: 'Samsung Tab S9', faultType: 'منفذ شحن مخلوع وتذبذب اللحام', customerProblem: 'لا يشحن تماماً وتركيبه مرتخي مع عدم التوصيل للشبكة الخارجية', cost: 200, eng: 'المهندس أسامة الحاشدي', report: 'إعادة لحام فلات الشحن وتركيب تايب سي وكالة مضغوط بأجهزة الكبس الدقيقة', notes: 'تم التسليم والمقبوض المالي بالعملة المعتمدة ومبروك للعميل سلامة جهازه', fail: '' },
              // 10. New (دخول جديد آخر بجهاز مختلف على نفس التذكرة)
              { status: '10', subStatus: '', categoryId: 'cat_screen', deviceType: 'شاشة / تلفاز', deviceName: 'Samsung QLED 65', faultType: 'خطوط طولية داكنة خفيفة بالرمادي بالطرف', customerProblem: 'ظهور خط طولي ممتد للأسفل بجانب الجبهة اليمنى من الإطار الخارجي', cost: 350, eng: '', report: '', notes: 'مجدول تحت قائمة المعاينة والفحص والتوزيع الفني', fail: '' }
            ];
            invoiceItemsList.push(...specItems);
          } else {
            // Generate 1-3 random items for other invoices
            let itemsCount = 1;
            if (i % 12 === 0) itemsCount = 3;
            else if (i % 7 === 0) itemsCount = 2;

            for (let itemIdx = 0; itemIdx < itemsCount; itemIdx++) {
              // Cycle states of items so they cover everything nicely
              const stateIndex = (i + itemIdx) % systemStatuses.length;
              const curState = systemStatuses[stateIndex];
              const itemStatus = curState.status;
              const itemSubStatus = curState.subStatus;

              // Pick random option template
              const optIdx = (i * 3 + itemIdx) % faultOptions.length;
              const opt = faultOptions[optIdx] as any;

              // Set costs depending on currency
              let itemCost = 15000;
              if (currency === 'SAR') {
                itemCost = Math.round(100 + opt.costFactor * 250 + (itemIdx * 45));
              } else if (currency === 'USD') {
                itemCost = Math.round(30 + opt.costFactor * 60 + (itemIdx * 10));
              } else {
                itemCost = Math.round(12000 + opt.costFactor * 18000 + (itemIdx * 2000));
              }

              // Assigned Engineer
              const engIdx = (i + itemIdx) % engineerRows.length;
              const engName = engineerRows[engIdx][1];

              // Assign realistic texts depending on status code
              let itemEng = '';
              let itemReport = '';
              let itemNotes = '';
              let itemFail = '';

              if (itemStatus === '10') {
                itemEng = '';
                itemReport = '';
                itemNotes = 'بانتظار الفحص والمعاينة الفنية من المهندس المختص';
                itemFail = '';
                itemCost = 0;
              } else if (itemStatus === '30') {
                itemEng = engName;
                itemReport = opt.engineerReport;
                itemNotes = 'بانتظار موافقة العميل على تفاصيل الكلفة وقطع الغيار للتنفيذ';
                itemFail = '';
              } else if (itemStatus === '35') {
                itemEng = engName;
                itemReport = opt.engineerReport;
                itemNotes = 'بانتظار توريد وتوفير قطع الغيار البديلة المعتمدة للمحل';
                itemFail = `انتظار وصول فلاتة الشحن والمكونات اللازمة لـ ${opt.deviceName}`;
              } else if (itemStatus === '40') {
                itemEng = engName;
                itemReport = opt.engineerReport;
                itemNotes = 'تحت الصيانة النشطة - يجرى التلحيم الدقيق وتجميع قطع الغيار بسلامة';
                itemFail = '';
              } else if (itemStatus === '50') {
                itemEng = engName;
                itemReport = opt.engineerReport;
                if (itemSubStatus === 'ready') {
                  itemNotes = opt.technicalNotes;
                } else if (itemSubStatus === 'intact') {
                  itemNotes = 'تم الفحص الدقيق والبطارية ودوائر الباور سليمة 100% ولا حاجة لقطع الصيانة';
                  itemCost = currency === 'SAR' ? 50 : currency === 'USD' ? 10 : 3000;
                } else if (itemSubStatus === 'unrepairable') {
                  itemNotes = 'تعذر الصيانة الفنية الفعالة لهلاك بنيوي بالبورد وممانعات فولت الأوم زيرو';
                  itemFail = 'تلف بوردة ميكروي غير متواجد البديل حالياً';
                  itemCost = 0;
                } else if (itemSubStatus === 'refused') {
                  itemNotes = 'تم المعاينة وقدر العميل أن الكلمة مرتفعة وطلب استرداد الجهاز بدون أعمال صيانة مجرد كشف فقط';
                  itemFail = 'رفض العميل الكلفة المرتفعة واكتفى بطلب التذوق السريع للجهاز';
                  itemCost = 0;
                }
              } else if (itemStatus === '60') {
                itemEng = engName;
                itemReport = opt.engineerReport;
                itemNotes = 'تم الاستلام والدفع وإقرار الفواتير التوازنية بسلامة مفرطة';
                if (itemSubStatus === 'unrepairable' || itemSubStatus === 'refused') {
                  itemCost = 0;
                  itemNotes = 'تم استرداد الجهاز من قبل العميل لتعذر أو إلغاء الصيانة بدون تكليف مالي';
                  itemFail = itemSubStatus === 'refused' ? 'رفض العميل واستلم مجاناً' : 'تعذر الإصلاح واسترجاع الجهاز بدون فائدة';
                }
              }

              const itemObj = {
                status: itemStatus,
                subStatus: itemSubStatus,
                categoryId: opt.categoryId,
                deviceType: opt.deviceType,
                deviceName: opt.deviceName,
                faultType: opt.faultType,
                customerProblem: opt.customerProblem,
                cost: itemCost,
                eng: itemEng,
                report: itemReport,
                notes: itemNotes,
                fail: itemFail
              };
              invoiceItemsList.push(itemObj);
            }
          }

          // Compute totals
          let totalCost = 0;
          let hasDelivered = false;
          let hasPending = false;
          let hasReady = false;

          invoiceItemsList.forEach(item => {
            totalCost += item.cost;
            if (item.status === '60') hasDelivered = true;
            else if (['10', '20', '30', '35', '40'].includes(item.status)) hasPending = true;
            else if (['50'].includes(item.status)) hasReady = true;
          });

          // Compute overall invoice status
          let invStatus = '10';
          if (!hasPending && !hasReady && hasDelivered) {
            invStatus = '60'; // all delivered
          } else if (hasReady || hasDelivered) {
            invStatus = '50'; // ready for delivery or partially ready/delivered
          } else {
            invStatus = '10'; // everything is pending
          }

          // Amount paid
          let amountPaid = 0;
          if (invStatus === '60') {
            amountPaid = totalCost;
          } else if (invStatus === '50') {
            // Partially Paid sometimes
            amountPaid = (i % 3 === 0) ? Math.round(totalCost * 0.4) : 0;
          } else {
            amountPaid = 0;
          }

          const notesText = (i === 50) ? 'فاتورة تجريبية شاملة لجميع الحالات ومستويات الصيانة مخصصة للفحص والاختبار' : `صيانة وفحص مستمر`;

          // Invoice Row: id, invoiceNumber, customerId, customerName, currency, totalCost, amountPaid, status, createdAt, updatedAt, notes
          invoicesRows.push([
            invId,
            String(invNum),
            custId,
            custName,
            currency,
            totalCost,
            amountPaid,
            invStatus,
            dateStr,
            dateStr,
            notesText
          ]);

          // Invoice Items Rows
          invoiceItemsList.forEach((item, itemIdx) => {
            const itemId = `item_${invNum}_${itemIdx + 1}`;
            const devAtStr = (item.status === '60') ? dateStr : '';
            const recName = (item.status === '60') ? custName : '';
            
            itemsRows.push([
              itemId,
              invId,
              item.categoryId,
              item.deviceName,
              String(invNum),
              item.deviceType,
              1, // quantity
              item.faultType,
              'لا يوجد', // deviceNotes
              item.notes, // technicalNotes
              item.cost,
              item.status,
              item.subStatus || '', // subStatus
              'generate_experimental', // source
              item.customerProblem,
              item.report,
              item.fail,
              item.cost, // unitCost
              devAtStr,
              recName,
              'المدير العام', // createdBy
              item.eng, // technician
              dateStr,
              dateStr,
              custId,
              custName
            ]);
          });

          // Vault Transactions
          if (amountPaid > 0) {
            const txId = `tx_${invNum}`;
            transRows.push([
              txId,
              currency,
              amountPaid,
              custName,
              String(invNum),
              'المدير العام',
              1, // userNumber
              'primary-admin',
              dateStr,
              'income',
              `المقبوض من الفاتورة #${invNum}`,
              dateStr
            ]);
          }
        }

        // Add 5 general business expenses to show ledger works perfectly
        const expenseRows = [
          ['tx_exp_1', 'SAR', -350, 'متجر صيانة الفهد', '', 'المدير العام', 1, 'primary-admin', now, 'expense', 'شراء شواحن وملحقات تجريبية لاختبار الإرجاع', now],
          ['tx_exp_2', 'RY', -80000, 'الكهرباء والخدمات', '', 'المدير العام', 1, 'primary-admin', now, 'expense', 'دفع فواتير استهلاك شبكة والمياه لشهر أبريل', now],
          ['tx_exp_3', 'USD', -120, 'المستودع الرئيسي للإلكترونيات', '', 'المدير العام', 1, 'primary-admin', now, 'expense', 'طقم مفكات احترافية وكاويات صيانة أصلية', now],
          ['tx_exp_4', 'SAR', -150, 'شركة النقل السريع', '', 'المدير العام', 1, 'primary-admin', now, 'expense', 'أجور الشحن وتوصيل القطع الموردة', now],
          ['tx_exp_5', 'RY', -45000, 'مكتبة ومستلزمات فنية', '', 'المدير العام', 1, 'primary-admin', now, 'expense', 'شراء مطبوعات صيانة وملصقات الباركود', now]
        ];
        transRows.push(...expenseRows);

        setProgress({ active: true, value: 75, label: 'جاري حفظ الفواتير والمعدات بحزم سريعة لقاعدة البيانات...' });

        // Save everything to SQLite!
        const invoiceCols = ['id', 'invoiceNumber', 'customerId', 'customerName', 'currency', 'totalCost', 'amountPaid', 'status', 'createdAt', 'updatedAt', 'notes'];
        const itemCols = ['id', 'invoiceId', 'categoryId', 'deviceName', 'invoiceNumber', 'deviceType', 'quantity', 'faultType', 'deviceNotes', 'technicalNotes', 'cost', 'status', 'subStatus', 'source', 'customerProblem', 'engineerReport', 'failureReason', 'unitCost', 'deliveredAt', 'recipientName', 'createdBy', 'technician', 'createdAt', 'updatedAt', 'customerId', 'customerName'];
        const transCols = ['id', 'currency', 'amount', 'customerName', 'invoiceNumber', 'userName', 'userNumber', 'userId', 'timestamp', 'type', 'notes', 'updatedAt'];

        // Write to database in robust chunks of 15 to operate far below parameters limits
        await chunkInsert('invoices', invoiceCols, invoicesRows, 15);
        await chunkInsert('invoice_items', itemCols, itemsRows, 15);
        await chunkInsert('vault_transactions', transCols, transRows, 15);

        // Update Counter settings in app config
        await setDoc(doc(db, 'settings', 'app'), { lastInvoiceNumber: 1100, lastCustomerNumber: 15 }, { merge: true });

        setProgress({ active: true, value: 90, label: 'جاري بث التغييرات وتحديث واجهات البرنامج وتوازين المحل...' });

        // Manually trigger local notifications for each table EXACTLY once so the whole app updates smoothly!
        for (const table of ['device_categories', 'device_models', 'engineers', 'customers', 'invoices', 'invoice_items', 'vault_transactions']) {
          const res = await localDb.query(`SELECT * FROM ${table}`);
          localDb.notify(table, res.values || []);
        }

        setProgress({ active: false, value: 100, label: '' });
        setInvoiceCounter(1100);
        await refreshStats();
        alert('تم إضافة 100 فاتورة تجريبية بنجاح! تم تضمين جميع حالات البرنامج وصنع فاتورة رقم 1050 مخصصة لشرح (10) أجهزة بكافة أنواع وخيارات الصيانة.');
    } catch (e: any) {
        console.error('Error during generateExperimentalData:', e);
        setProgress({ active: false, value: 0, label: '' });
        alert('Error: ' + (e.message || e));
    }
  };

  const categories = [
    { id: 'general', title: t('settings.general'), icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'accounting-inputs', title: 'مدخلات العمليات الحسابية', icon: Calculator, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'engineers', title: 'إدارة المهندسين', icon: UserIcon, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'device-management', title: 'إدارة الأجهزة', icon: Cpu, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'categories', title: 'تصنيفات الأجهزة', icon: Tag, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'users', title: t('settings.users'), icon: Smartphone, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'backup', title: t('settings.maintenance'), icon: Database, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'security', title: t('settings.security'), icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 h-full overflow-hidden">
      {/* Progress Overlay */}
      {progress.active && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#1a1a1a] p-6 rounded-3xl border border-white/10 w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-white font-bold mb-4">{progress.label}</h3>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
               <motion.div 
                 className="h-full bg-blue-500"
                 initial={{ width: 0 }}
                 animate={{ width: `${progress.value}%` }}
               />
            </div>
            <p className="text-gray-500 text-xs mt-2">{Math.round(progress.value)}%</p>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((cat) => (
          (cat.id === 'users' && user.role === 'data_entry') ? null : (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setActiveTab(cat.id as any)}
              className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-[1.25rem] border border-white/5 hover:border-white/10 transition-all text-left rtl:text-right group shadow-lg"
            >
              <div className={`p-2.5 ${cat.bg} ${cat.color} rounded-xl group-hover:scale-105 transition-transform`}>
                <cat.icon size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-white">{cat.title}</h3>
                <p className="text-[9px] text-gray-500 mt-0.5">إعدادات القسم وتحكم متقدم</p>
              </div>
              <div className="text-gray-600 group-hover:text-white transition-colors text-sm">
                 {i18n.language === 'ar' ? '←' : '→'}
              </div>
            </motion.button>
          )
        ))}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSignOut}
          className="col-span-full mt-2 flex items-center justify-center gap-2 p-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[1.5rem] border border-red-500/20 transition-all font-bold shadow-lg text-sm group"
        >
          <LogOut size={20} className="group-hover:scale-110 transition-transform" />
          <span>{t('common.signOut')}</span>
        </motion.button>
      </div>

      {/* Independent Window / Modal Overlay */}
      <AnimatePresence>
        {activeTab !== 'main' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] w-full max-w-4xl h-screen sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[2rem] border-0 sm:border sm:border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Unified Header */}
              <div className="flex items-center px-4 py-3 border-b border-white/10 bg-[#121212]/80 backdrop-blur-xl z-20 sticky top-0" dir="rtl">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActiveTab('main')}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
                  >
                    <ArrowLeft size={18} className="rtl:rotate-180" />
                  </button>
                  <div>
                    <h1 className="text-lg font-black text-white m-0 p-0">
                      {activeTab === 'general' && t('settings.general')}
                      {activeTab === 'accounting-inputs' && 'مدخلات العمليات الحسابية'}
                      {activeTab === 'security' && t('settings.security')}
                      {activeTab === 'backup' && t('settings.maintenance')}
                      {activeTab === 'users' && t('settings.users')}
                      {activeTab === 'engineers' && 'إدارة المهندسين'}
                      {activeTab === 'device-management' && 'إدارة الأجهزة'}
                      {activeTab === 'categories' && 'تصنيفات الأجهزة'}
                    </h1>
                  </div>
                </div>
              </div>

              {/* Modal Content - Fixed, No Scroll */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4">
                {activeTab === 'general' && (
                  <div className="space-y-6 pb-8" dir="rtl">
                    {/* Navigation Sub-tabs */}
                    <div className="flex gap-2 border-b border-white/5 pb-3 mb-5">
                      <button
                        type="button"
                        onClick={() => setGeneralSubTab('language')}
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${generalSubTab === 'language' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        اللغة والتحديث
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeneralSubTab('details')}
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${generalSubTab === 'details' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        تفاصيل المحل
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeneralSubTab('advanced')}
                        className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${generalSubTab === 'advanced' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        ضبط متقدم
                      </button>
                    </div>

                    {generalSubTab === 'language' && (
                      <section className="space-y-6 animate-in fade-in duration-200">
                         <div className="p-5 md:p-6 bg-white/5 rounded-[1.5rem] sm:rounded-3xl border border-white/5 space-y-4">
                            <div className="flex items-center justify-between rtl:flex-row-reverse">
                               <h3 className="font-bold text-white text-lg">{t('settings.language')}</h3>
                               <button 
                                 onClick={handleSave}
                                 disabled={saving}
                                 className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg"
                               >
                                 {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                 {t('settings.update')}
                               </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <button 
                                 onClick={() => i18n.changeLanguage('en')}
                                 className={`py-6 rounded-2.5xl border-2 font-bold transition-all ${i18n.language.startsWith('en') ? 'bg-orange-600/10 border-orange-600 text-orange-500 shadow-xl' : 'bg-black/20 border-white/5 text-gray-500 hover:text-white'}`}
                               >
                                 English
                               </button>
                               <button 
                                 onClick={() => i18n.changeLanguage('ar')}
                                 className={`py-6 rounded-2.5xl border-2 font-bold transition-all ${i18n.language.startsWith('ar') ? 'bg-orange-600/10 border-orange-600 text-orange-500 shadow-xl' : 'bg-black/20 border-white/5 text-gray-500 hover:text-white'}`}
                               >
                                 <span className="font-arabic">العربية</span>
                               </button>
                            </div>
                         </div>
                      </section>
                    )}

                    {generalSubTab === 'details' && (
                      <div className="space-y-6 animate-in fade-in duration-200 text-right">
                        {/* Header with Edit Action */}
                        <div className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-white text-lg">تفاصيل ومعلومات المحل</h3>
                            <p className="text-xs text-gray-500 mt-1">تعديل معلومات المحل، طريقة التواصل والشعار العام للمطبوعات</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingShop(!isEditingShop);
                            }}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${isEditingShop ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'}`}
                          >
                            <Edit size={14} />
                            {isEditingShop ? 'إلغاء التعديل' : 'تحرير والبدء بالاعداد'}
                          </button>
                        </div>

                        {/* Details Editable Form */}
                        <div className="p-6 md:p-8 bg-white/5 rounded-3xl border border-white/5 space-y-6">
                          {/* Main Row / Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Shop Name - COMPULSORY */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-gray-400 block">اسم المحل (إجباري) <span className="text-red-500">*</span></label>
                              <div className="relative">
                                <Store className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="text"
                                  required
                                  disabled={!isEditingShop}
                                  value={shopName}
                                  onChange={(e) => setShopName(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3.5 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="عالم الصيانة والتجارة"
                                />
                              </div>
                            </div>

                            {/* Main Phone Number */}
                            <div className="space-y-4 p-4 bg-black/25 rounded-2xl border border-white/5">
                              <label className="text-xs font-bold text-gray-400 block">رقم جوال رئيسي</label>
                              <div className="relative">
                                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="tel"
                                  disabled={!isEditingShop}
                                  value={phone1}
                                  onChange={(e) => setPhone1(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="مثال: 0500000000"
                                />
                              </div>
                              {/* Option Services for Phone 1 */}
                              <div className="flex gap-4 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={phone1Call}
                                    onChange={(e) => setPhone1Call(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز اتصال</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={phone1Whatsapp}
                                    onChange={(e) => setPhone1Whatsapp(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز واتساب</span>
                                </label>
                              </div>
                            </div>

                            {/* Secondary Phone Number */}
                            <div className="space-y-4 p-4 bg-black/25 rounded-2xl border border-white/5">
                              <label className="text-xs font-bold text-gray-400 block">رقم جوال ثانوي</label>
                              <div className="relative">
                                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="tel"
                                  disabled={!isEditingShop}
                                  value={phone2}
                                  onChange={(e) => setPhone2(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="رقم هاتف جوال آخر"
                                />
                              </div>
                              {/* Option Services for Phone 2 */}
                              <div className="flex gap-4 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={phone2Call}
                                    onChange={(e) => setPhone2Call(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز اتصال</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={phone2Whatsapp}
                                    onChange={(e) => setPhone2Whatsapp(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز واتساب</span>
                                </label>
                              </div>
                            </div>

                            {/* Landline Phone Number */}
                            <div className="space-y-4 p-4 bg-black/25 rounded-2xl border border-white/5">
                              <label className="text-xs font-bold text-gray-400 block">رقم التلفون الأرضي</label>
                              <div className="relative">
                                <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="tel"
                                  disabled={!isEditingShop}
                                  value={landline}
                                  onChange={(e) => setLandline(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="مثال: 0110000000"
                                />
                              </div>
                              {/* Option Services for Landline */}
                              <div className="flex gap-4 pt-1">
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={landlineCall}
                                    onChange={(e) => setLandlineCall(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز اتصال</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                  <input
                                    type="checkbox"
                                    disabled={!isEditingShop}
                                    checked={landlineWhatsapp}
                                    onChange={(e) => setLandlineWhatsapp(e.target.checked)}
                                    className="rounded border-white/10 text-orange-500 focus:ring-orange-500 bg-black/40 w-4 h-4"
                                  />
                                  <span>رمز واتساب</span>
                                </label>
                              </div>
                            </div>

                            {/* Email Address */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 block">البريد الإلكتروني</label>
                              <div className="relative">
                                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="email"
                                  disabled={!isEditingShop}
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3.5 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="example@domain.com"
                                />
                              </div>
                            </div>

                            {/* Facebook page */}
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 block">صفحة فيسبوك</label>
                              <div className="relative">
                                <Facebook className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="text"
                                  disabled={!isEditingShop}
                                  value={facebookUrl}
                                  onChange={(e) => setFacebookUrl(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3.5 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="https://facebook.com/yourpage"
                                />
                              </div>
                            </div>

                            {/* Map Location */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-gray-400 block">الموقع على الخريطة</label>
                              <div className="relative">
                                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="text"
                                  disabled={!isEditingShop}
                                  value={mapUrl}
                                  onChange={(e) => setMapUrl(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3.5 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="أو رابط خرائط قوقل مابز"
                                />
                              </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-gray-400 block">العنوان بالتفصيل</label>
                              <div className="relative">
                                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                  type="text"
                                  disabled={!isEditingShop}
                                  value={address}
                                  onChange={(e) => setAddress(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl pr-12 pl-4 py-3.5 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                  placeholder="مثال: صنعاء - شارع حده - عمارة البركة الدور الأول"
                                />
                              </div>
                            </div>

                            {/* Logo Upload */}
                            <div className="space-y-2 md:col-span-2 text-center flex flex-col items-center">
                              <label className="text-xs font-bold text-gray-400 w-full text-right block mb-1">شعار المحل للمطبوعات والتقارير</label>
                              <div className={`relative group mt-2 ${!isEditingShop ? 'opacity-80' : ''}`}>
                                <div className="w-36 h-36 rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-orange-500">
                                  {logoUrl ? (
                                    <img src={logoUrl} alt="الشعار" className="w-full h-full object-contain p-2" />
                                  ) : (
                                    <Upload className="text-gray-600" size={32} />
                                  )}
                                </div>
                                {isEditingShop && (
                                  <>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            setLogoUrl(reader.result as string);
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <div className="absolute -bottom-2 -right-2 p-2 bg-orange-600 rounded-lg shadow-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Upload size={16} />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Bank Accounts */}
                            <div className="md:col-span-2 mt-4">
                              <h3 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-2">الحسابات البنكية (تظهر في الفواتير - اختياري)</h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* YER Bank */}
                                <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-xs">YER</div>
                                    <span className="text-sm font-bold text-gray-300">حساب بنكي ريال</span>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">اسم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankYerName}
                                      onChange={(e) => setBankYerName(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm"
                                      placeholder="مثال: بنك الكريمي - ريال"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">رقم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankYerAccount}
                                      onChange={(e) => setBankYerAccount(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm font-mono text-left"
                                      placeholder="XXX-XXXX-XXXX"
                                      dir="ltr"
                                    />
                                  </div>
                                </div>

                                {/* SAR Bank */}
                                <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-xs">SAR</div>
                                    <span className="text-sm font-bold text-gray-300">حساب بنكي سعودي</span>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">اسم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankSarName}
                                      onChange={(e) => setBankSarName(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm"
                                      placeholder="مثال: بنك الكريمي - سعودي"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">رقم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankSarAccount}
                                      onChange={(e) => setBankSarAccount(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm font-mono text-left"
                                      placeholder="XXX-XXXX-XXXX"
                                      dir="ltr"
                                    />
                                  </div>
                                </div>

                                {/* USD Bank */}
                                <div className="space-y-4 bg-black/20 p-4 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">USD</div>
                                    <span className="text-sm font-bold text-gray-300">حساب بنكي دولار</span>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">اسم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankUsdName}
                                      onChange={(e) => setBankUsdName(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm"
                                      placeholder="مثال: بنك الكريمي - دولار"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 block">رقم الحساب</label>
                                    <input
                                      type="text"
                                      disabled={!isEditingShop}
                                      value={bankUsdAccount}
                                      onChange={(e) => setBankUsdAccount(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm font-mono text-left"
                                      placeholder="XXX-XXXX-XXXX"
                                      dir="ltr"
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-6 space-y-2">
                                <label className="text-xs font-bold text-gray-400 block">اسم صاحب الحسابات البنكية (يظهر بداية سطر الحسابات في الفاتورة)</label>
                                <input
                                  type="text"
                                  disabled={!isEditingShop}
                                  value={bankHolderName}
                                  onChange={(e) => setBankHolderName(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-50 text-sm"
                                  placeholder="اسم صاحب الحساب (مثال: مؤسسة عالم الصيانة)"
                                />
                              </div>
                            </div>

                            {/* Description / Summary of Services */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-gray-400 block">نبذة مختصرة عن المحل وما الخدمات التي يقدمها</label>
                              <textarea
                                disabled={!isEditingShop}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={3}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 focus:border-orange-500 outline-none transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed resize-none text-sm leading-relaxed"
                                placeholder="محل متخصص في الصيانة وبيع التجارة العامة وقطع الغيار..."
                              />
                            </div>

                          </div>

                          {/* Submit Action Block */}
                          <div className="border-t border-white/5 pt-6 flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!shopName.trim()) {
                                  alert("اسم المحل إجباري!");
                                  return;
                                }
                                setSaving(true);
                                try {
                                  const updatedConfig = {
                                    shopName: shopName.trim(),
                                    phone1: phone1.trim(),
                                    phone2: phone2.trim(),
                                    landline: landline.trim(),
                                    phone1Call,
                                    phone1Whatsapp,
                                    phone2Call,
                                    phone2Whatsapp,
                                    landlineCall,
                                    landlineWhatsapp,
                                    facebookUrl: facebookUrl.trim(),
                                    mapUrl: mapUrl.trim(),
                                    email: email.trim(),
                                    bio: bio.trim(),
                                    logoUrl,
                                    address: address.trim(),
                                    bankYerName: bankYerName.trim(),
                                    bankYerAccount: bankYerAccount.trim(),
                                    bankSarName: bankSarName.trim(),
                                    bankSarAccount: bankSarAccount.trim(),
                                    bankUsdName: bankUsdName.trim(),
                                    bankUsdAccount: bankUsdAccount.trim(),
                                    bankHolderName: bankHolderName.trim(),
                                    fiscalYear: new Date().getFullYear().toString(),
                                    startDate: new Date().toISOString().split('T')[0]
                                  };

                                  await setDoc(doc(db, 'settings', 'shop'), updatedConfig, { merge: true });

                                  // Save/Sync to local SQLite table "company_details" as well
                                  try {
                                    await localDb.run(
                                      `INSERT OR REPLACE INTO company_details (
                                        id, shopName, phone1, phone2, landline, 
                                        phone1Call, phone1Whatsapp, phone2Call, phone2Whatsapp, 
                                        landlineCall, landlineWhatsapp, facebookUrl, mapUrl, 
                                        email, bio, logoUrl, address, updatedAt,
                                        bankYerName, bankYerAccount, bankSarName, bankSarAccount, bankUsdName, bankUsdAccount, bankHolderName
                                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                      [
                                        'main_details',
                                        updatedConfig.shopName,
                                        updatedConfig.phone1,
                                        updatedConfig.phone2,
                                        updatedConfig.landline,
                                        updatedConfig.phone1Call ? 1 : 0,
                                        updatedConfig.phone1Whatsapp ? 1 : 0,
                                        updatedConfig.phone2Call ? 1 : 0,
                                        updatedConfig.phone2Whatsapp ? 1 : 0,
                                        updatedConfig.landlineCall ? 1 : 0,
                                        updatedConfig.landlineWhatsapp ? 1 : 0,
                                        updatedConfig.facebookUrl,
                                        updatedConfig.mapUrl,
                                        updatedConfig.email,
                                        updatedConfig.bio,
                                        updatedConfig.logoUrl,
                                        updatedConfig.address,
                                        new Date().toISOString(),
                                        updatedConfig.bankYerName,
                                        updatedConfig.bankYerAccount,
                                        updatedConfig.bankSarName,
                                        updatedConfig.bankSarAccount,
                                        updatedConfig.bankUsdName,
                                        updatedConfig.bankUsdAccount,
                                        updatedConfig.bankHolderName
                                      ]
                                    );
                                  } catch (sqliteErr) {
                                    console.error("Failed to save to SQLite company_details table:", sqliteErr);
                                  }

                                  if (onShopConfigUpdate) {
                                    onShopConfigUpdate(updatedConfig);
                                  }
                                  setIsEditingShop(false);
                                  alert("تم حفظ تفاصيل ومعلومات المحل بنجاح!");
                                } catch (e: any) {
                                  console.error(e);
                                  alert("خطأ أثناء حفظ تفاصيل المحل: " + e.message);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={!isEditingShop || saving}
                              className={`px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-xl transition-all ${
                                !isEditingShop 
                                  ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed opacity-50' 
                                  : 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]'
                              }`}
                            >
                              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                              حفظ المعلومات
                            </button>
                          </div>

                        </div>
                      </div>
                    )}

                    {generalSubTab === 'advanced' && (
                      <div className="space-y-6 animate-in fade-in duration-200 text-right">
                        {/* Header Box */}
                        <div className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-white text-lg">ضبط إعدادات متقدمة</h3>
                            <p className="text-xs text-gray-500 mt-1">تخصيص المظهر العام للنظام وإعدادات الطباعة الافتراضية</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSaveSettings}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition-all"
                          >
                            <Save size={16} />
                            حفظ الإعدادات المتقدمة
                          </button>
                        </div>

                        {/* Form elements inside Card */}
                        <div className="p-5 md:p-8 bg-white/5 rounded-[1.5rem] sm:rounded-3xl border border-white/5 space-y-6">
                          
                          {/* Row 1: المظهر العام */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-white/5">
                            <div>
                               <span className="font-bold text-white text-base">المظهر العام</span>
                               <p className="text-xs text-gray-500 mt-0.5">اختر المظهر المفضل لواجهة المستخدم للنظام</p>
                            </div>
                            <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 self-start sm:self-center">
                               <button
                                 type="button"
                                 onClick={() => setAppearance('normal')}
                                 className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${appearance === 'normal' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                               >
                                 عادي (مضيء)
                               </button>
                               <button
                                 type="button"
                                 onClick={() => setAppearance('dark')}
                                 className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${appearance === 'dark' ? 'bg-orange-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                               >
                                 مظلم (ليلي)
                               </button>
                            </div>
                          </div>

                          {/* Row 2: إعداد الطباعة */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 font-cairo">
                            <div>
                               <span className="font-bold text-white text-base">إعداد الطباعة والورق</span>
                               <p className="text-xs text-gray-500 mt-0.5">تحديد مقاس الورق الافتراضي عند طباعة الفواتير والسندات</p>
                            </div>
                            <div className="flex gap-2">
                               <select
                                 value={printPaperSize}
                                 onChange={(e) => setPrintPaperSize(e.target.value as 'A4' | '80mm')}
                                 className="bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-orange-500/50 appearance-none text-right font-bold pl-8"
                               >
                                  <option value="A4" className="bg-[#1c1c1c]">صفحة كاملة (عريض A4)</option>
                                  <option value="80mm" className="bg-[#1c1c1c]">ورق حراري (لفافة 80mm)</option>
                               </select>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-8 pb-8">
                     <section className="bg-white/5 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 overflow-hidden">
                        <div className="p-5 md:p-8 border-b border-white/5 flex items-center justify-between rtl:flex-row-reverse">
                           <div className="flex items-center gap-3 rtl:flex-row-reverse">
                             <Shield className="text-orange-500" size={24} />
                             <h2 className="font-bold text-xl text-white">{t('settings.security')}</h2>
                           </div>
                           <button 
                             onClick={handleSaveSettings}
                             className="bg-orange-600 hover:bg-orange-700 text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xl"
                           >
                             <Save size={18} /> {t('settings.update')}
                           </button>
                        </div>
                        <div className="p-5 md:p-8 space-y-8 rtl:text-right">
                           <div className="flex items-center justify-between p-5 md:p-6 bg-black/40 rounded-[1.5rem] sm:rounded-[2rem] border border-white/5">
                             <div className="flex items-center gap-4">
                               <div className="p-4 bg-orange-600/10 text-orange-500 rounded-2xl"><Fingerprint size={32}/></div>
                               <div>
                                 <p className="font-black text-white text-lg">{t('settings.biometricLock')}</p>
                                 <p className="text-xs text-gray-500">تسجيل دخول آمن بواسطة البصمة أو الوجه</p>
                                 <DeviceSupportWarning type="biometric" />
                               </div>
                             </div>
                             <label className="relative inline-flex items-center cursor-pointer scale-125 mx-4">
                               <input 
                                 type="checkbox" 
                                 checked={biometricEnabled} 
                                 onChange={async (e) => {
                                   const checked = e.target.checked;
                                   if (checked) {
                                     const info = await Device.getInfo();
                                     if (info.platform === 'web') {
                                       alert('البصمة غير مدعومة في متصفح الويب. يرجى استخدام PIN بدلاً من ذلك.');
                                       return;
                                     }
                                     const bio = await NativeBiometric.isAvailable();
                                     if (!bio.isAvailable) {
                                       alert('جهازك لا يدعم التحقق البيومتري أو لم يتم إعداده.');
                                       return;
                                     }
                                   }
                                   setBiometricEnabled(checked);
                                 }} 
                                 className="sr-only peer" 
                               />
                               <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                             </label>
                           </div>

                           <div className="space-y-6">
                             <div className="flex items-center justify-between p-6 bg-black/40 rounded-[2rem] border border-white/5">
                               <div className="flex items-center gap-4">
                                 <div className="p-4 bg-orange-600/10 text-orange-500 rounded-2xl"><Lock size={32}/></div>
                                 <div>
                                   <p className="font-black text-white text-lg">{t('settings.pinLock')}</p>
                                   <p className="text-xs text-gray-500">قفل التطبيق برمز حماية (PIN) خاص</p>
                                 </div>
                               </div>
                               <label className="relative inline-flex items-center cursor-pointer scale-125 mx-4">
                                 <input type="checkbox" checked={pinEnabled} onChange={(e) => setPinEnabled(e.target.checked)} className="sr-only peer" />
                                 <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                               </label>
                             </div>
                             
                             {pinEnabled && (
                               <motion.div 
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 className="p-5 md:p-8 bg-black/60 rounded-[1.5rem] sm:rounded-[2.5rem] border border-orange-500/30 text-center space-y-6"
                               >
                                 <label className="text-xs text-orange-500 font-black uppercase tracking-widest">تحديد الرمز السري الجديد</label>
                                 <div className="max-w-[240px] mx-auto">
                                   <input 
                                     type="password" 
                                     maxLength={4}
                                     value={pinCode}
                                     onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                                     placeholder="****"
                                     className="w-full bg-black border-2 border-white/10 rounded-2xl px-6 py-5 text-center text-5xl tracking-[0.4em] focus:border-orange-500 outline-none text-white font-mono shadow-2xl"
                                   />
                                 </div>
                                 <p className="text-[10px] text-gray-500">سيتم طلب هذا الرمز عند فتح التطبيق</p>
                               </motion.div>
                             )}
                           </div>
                        </div>
                     </section>
                  </div>
                )}

                {activeTab === 'backup' && (
                  <div className="space-y-3 pb-4">
                    {backupSubTab === 'list' ? (
                      <div className="space-y-2">
                        {/* Stats Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setBackupSubTab('stats')}
                          className="w-full bg-white/5 text-white p-3.5 rounded-[1.2rem] border border-white/10 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">إحصائيات وقاعدة البيانات</h3>
                             <div className="mt-1 space-y-0.5">
                                <div className="flex items-center justify-end gap-2 text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                   <span>{statsData.invoices + statsData.customers + statsData.maintenance}</span>
                                   <span>:إجمالي السجلات</span>
                                   <RefreshCw size={8} className="text-gray-500" />
                                </div>
                                <div className="flex items-center justify-end gap-2 text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                   <span>{((statsData.invoices + statsData.customers + statsData.maintenance) * 0.012).toFixed(3)} MB</span>
                                   <span>:الحجم الكلي</span>
                                   <RefreshCw size={8} className="text-gray-500" />
                                </div>
                             </div>
                          </div>
                          <div className="p-2.5 bg-blue-600/10 text-blue-500 rounded-xl">
                             <Database size={22} />
                          </div>
                        </motion.button>

                        {/* Audit & Repair Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => {
                            setBackupSubTab('audit');
                            runDatabaseAudit();
                          }}
                          className="w-full bg-orange-600/10 text-orange-500 p-3.5 rounded-[1.2rem] border border-orange-500/20 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo text-orange-450">مربع تدقيق ومطابقة البيانات (Audit)</h3>
                             <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-0.5">فحص ومعالجة التضاربات بين عدادات البرنامج وسجلات قاعدة البيانات</p>
                          </div>
                          <div className="p-2.5 bg-orange-600/15 text-orange-500 rounded-xl group-hover:scale-105 transition-transform">
                             <Shield size={22} />
                          </div>
                        </motion.button>

                        {/* Backup Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setBackupSubTab('backup_manual')}
                          className="w-full bg-white/5 text-white p-3.5 rounded-[1.2rem] border border-white/10 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">النسخ الاحتياطي</h3>
                             <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">نسخ محلي وتلقائي للبيانات</p>
                          </div>
                          <div className="p-2.5 bg-purple-600/10 text-purple-500 rounded-xl">
                             <Database size={22} />
                          </div>
                        </motion.button>

                        {/* Export Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setBackupSubTab('export')}
                          className="w-full bg-white/5 text-white p-3.5 rounded-[1.2rem] border border-white/10 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">تصدير بلاس</h3>
                             <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">تصدير شامل ومنظم للسجلات</p>
                          </div>
                          <div className="p-2.5 bg-emerald-600/10 text-emerald-500 rounded-xl">
                             <Download size={22} />
                          </div>
                        </motion.button>

                        {/* Import Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setBackupSubTab('import')}
                          className="w-full bg-white/5 text-white p-3.5 rounded-[1.2rem] border border-white/10 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">الاستيراد والاستعادة</h3>
                             <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">استعادة أو دمج بيانات سابقة</p>
                          </div>
                          <div className="p-2.5 bg-orange-600/10 text-orange-500 rounded-xl">
                             <Upload size={22} />
                          </div>
                        </motion.button>

                        {/* Archive Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setBackupSubTab('archive')}
                          className="w-full bg-white/5 text-white p-3.5 rounded-[1.2rem] border border-white/10 flex items-center gap-3 shadow-xl relative group overflow-hidden"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">أرشفة الملفات</h3>
                             <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">مسح وتفريغ السجلات المنتهية</p>
                          </div>
                          <div className="p-2.5 bg-gray-600/10 text-gray-500 rounded-xl">
                             <Archive size={22} />
                          </div>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Experimental Data clicked');
                            generateExperimentalData();
                          }}
                          className="w-full bg-blue-500/10 text-blue-500 p-3.5 rounded-[1.2rem] border border-blue-500/20 flex items-center gap-3 shadow-xl mb-2"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">بيانات تجريبية</h3>
                             <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5 select-none">Experimental Data</p>
                          </div>
                          <div className="p-2.5 bg-blue-500 text-white rounded-xl">
                             <Database size={22} />
                          </div>
                        </motion.button>
                        {/* Reset Block */}
                        <motion.button
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Reset System clicked');
                            resetAllDataTemp();
                          }}
                          className="w-full bg-red-500/10 text-red-500 p-3.5 rounded-[1.2rem] border border-red-500/20 flex items-center gap-3 shadow-xl mt-1"
                        >
                          <div className="flex-1 rtl:text-right">
                             <h3 className="text-base font-bold font-cairo">تهيئة النظام</h3>
                             <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-0.5 select-none">Factory Wipe</p>
                          </div>
                          <div className="p-2.5 bg-red-500 text-white rounded-xl">
                             <RotateCcw size={22} />
                          </div>
                        </motion.button>
                      </div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                         <button 
                           onClick={() => setBackupSubTab('list')}
                           className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2 rtl:flex-row-reverse"
                         >
                            <RefreshCw className="rotate-90" size={14} />
                            <span className="font-bold text-xs">العودة للقائمة</span>
                         </button>

                         {backupSubTab === 'backup_manual' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 overflow-hidden shadow-2xl">
                               <div className="p-5 md:p-8 border-b border-white/5 bg-gradient-to-br from-emerald-600/10 to-transparent flex items-center justify-between rtl:flex-row-reverse">
                                  <div className="flex items-center gap-4 rtl:flex-row-reverse">
                                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg ring-2 ring-emerald-600/20">
                                      <Database size={24} />
                                    </div>
                                    <div className="rtl:text-right">
                                      <h2 className="font-mono text-xl font-black text-white uppercase tracking-tighter">النسخ الاحتياطي</h2>
                                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-0.5">Control Panel</p>
                                    </div>
                                  </div>
                               </div>
                               <div className="p-5 md:p-8 space-y-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div className="p-5 bg-black/40 rounded-[1.5rem] border border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                           <div className="flex items-center gap-3">
                                              <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl"><Clock size={24} /></div>
                                              <span className="font-bold text-sm text-white">النسخ التلقائي</span>
                                           </div>
                                           <label className="relative inline-flex items-center cursor-pointer scale-110">
                                              <input type="checkbox" checked={autoBackup} onChange={e => setAutoBackup(e.target.checked)} className="sr-only peer" />
                                              <div className="w-12 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
                                           </label>
                                        </div>
                                        {autoBackup && (
                                           <div className="space-y-2 pt-2 border-t border-white/5">
                                              <label className="text-[9px] text-gray-400 uppercase font-black tracking-widest block rtl:text-right">وقت النسخ</label>
                                              <input type="time" value={backupTime} onChange={e => setBackupTime(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-2xl font-mono text-center focus:border-emerald-500 outline-none" />
                                           </div>
                                        )}
                                     </div>
                                     <div className="p-5 bg-black/40 rounded-[1.5rem] border border-white/5 space-y-4">
                                        <div className="flex items-center gap-3">
                                           <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl"><HardDrive size={24} /></div>
                                           <span className="font-bold text-sm text-white">مسار التخزين</span>
                                        </div>
                                        <input type="text" readOnly value={backupPath} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-gray-400 truncate" />
                                     </div>
                                  </div>
                                  <button onClick={handleSaveSettings} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-[1.5rem] font-bold text-base shadow-2xl transition-all active:scale-95">حفظ الإعدادات</button>
                               </div>
                            </section>
                         )}

                         {backupSubTab === 'export' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 p-5 text-center space-y-4">
                               <div className="p-4 bg-emerald-600/10 text-emerald-500 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                                  <Download size={28} />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black text-white font-cairo">تصدير بلاس</h3>
                                  <p className="text-gray-500 mt-1 text-[10px]">تجهيز ملف شامل لجميع بيانات النظام بتنسيق JSON</p>
                               </div>
                               <button className="bg-white text-black px-6 py-2.5 rounded-lg font-black text-xs hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 mx-auto">
                                  <Download size={16} />
                                  <span>بدء التصـدير</span>
                               </button>
                            </section>
                         )}

                         {backupSubTab === 'import' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 p-5 text-center space-y-4">
                               <div className="p-4 bg-orange-600/10 text-orange-500 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                                  <Upload size={28} />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black text-white font-cairo">الاستيراد والاستعادة</h3>
                                  <p className="text-gray-500 mt-1 text-[10px]">اختر ملف النسخة الاحتياطية لاستعادة السجلات</p>
                               </div>
                               <div className="max-w-xs mx-auto border border-dashed border-white/20 p-4 rounded-xl hover:border-orange-500/50 transition-colors cursor-pointer group">
                                  <FileText className="mx-auto text-gray-600 group-hover:text-orange-500 transition-colors" size={32} />
                                  <p className="mt-2 text-[9px] text-gray-500">اختر الملف من الذاكرة</p>
                               </div>
                            </section>
                         )}

                         {backupSubTab === 'archive' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 p-5 text-center space-y-4">
                               <div className="p-4 bg-gray-600/10 text-gray-400 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                                  <Archive size={28} />
                               </div>
                               <div>
                                  <h3 className="text-xl font-black text-white font-cairo">أرشفة الملفات</h3>
                                  <p className="text-gray-500 mt-1 text-[10px]">نقل السجلات القديمة المنتهية لقاعدة بيانات الأرشيف</p>
                               </div>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-sm mx-auto">
                                  <div className="p-2.5 bg-black/40 rounded-lg border border-white/5">
                                     <p className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">أرشفة قبل</p>
                                     <input type="date" className="bg-transparent text-white font-bold outline-none text-xs" />
                                  </div>
                                  <button className="bg-white/10 text-white font-black rounded-lg px-4 py-2 hover:bg-white/20 transition-all text-[10px]">تفعيل الأرشفة</button>
                               </div>
                            </section>
                         )}

                         {backupSubTab === 'stats' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 p-4 space-y-4">
                               <div className="flex items-center gap-3 rtl:flex-row-reverse">
                                  <div className="p-3 bg-blue-600 text-white rounded-lg shadow-xl"><Database size={20} /></div>
                                  <div className="rtl:text-right">
                                     <h3 className="text-lg font-black text-white font-cairo">تفاصيل قاعدة البيانات</h3>
                                     <p className="text-[8px] text-gray-500">فحص الحالة وتوافر البيانات</p>
                                  </div>
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                  {[
                                     { label: 'الفواتير المسجلة', value: statsData.invoices, icon: FileText, color: 'text-blue-500' },
                                     { label: 'العملاء المسجلين', value: statsData.customers, icon: Smartphone, color: 'text-purple-500' },
                                     { label: 'عمليات الصيانة', value: statsData.maintenance, icon: RefreshCw, color: 'text-orange-500' },
                                     { label: 'رقم الفاتورة القادمة', value: invoiceCounter + 1, icon: Shield, color: 'text-emerald-500' },
                                  ].map((stat, i) => (
                                     <div key={i} className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col items-center text-center gap-1.5">
                                        <stat.icon className={stat.color} size={16} />
                                        <span className="text-sm font-black text-white">{stat.value}</span>
                                        <span className="text-[7px] text-gray-500 uppercase font-black">{stat.label}</span>
                                     </div>
                                  ))}
                               </div>
                            </section>
                         )}

                         {backupSubTab === 'audit' && (
                            <section className="bg-white/5 rounded-[1.5rem] border border-white/10 p-5 space-y-6 rtl:text-right text-gray-200">
                              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                                  <div className="p-3 bg-orange-600/15 text-orange-500 rounded-xl">
                                    <Shield size={24} />
                                  </div>
                                  <div className="rtl:text-right">
                                    <h3 className="text-lg font-bold text-white font-cairo">تدقيق ومطابقة السجلات الفعلية (Interactive Database Audit)</h3>
                                    <p className="text-xs text-gray-400">تحقق ومقارنة العدادات المسجلة في واجهة الإعدادات والعمليات المالية مع سجلات خادم قاعدة البيانات</p>
                                  </div>
                                </div>
                                <button 
                                  onClick={runDatabaseAudit} 
                                  disabled={isAuditing}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                                >
                                  <RefreshCw size={14} className={isAuditing ? "animate-spin" : ""} />
                                  <span>تحديث الفحص</span>
                                </button>
                              </div>

                              {isAuditing ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-4">
                                  <RefreshCw size={36} className="animate-spin text-orange-500" />
                                  <p className="text-sm text-gray-400 font-bold">جاري تشغيل خوارزميات الفحص والمطابقة لجميع عناصر قاعدة البيانات...</p>
                                </div>
                              ) : auditResults ? (
                                <div className="space-y-6">
                                  {repairProgress.message && (
                                    <div className={`p-4 rounded-2xl border text-xs font-bold ${
                                      repairProgress.status === 'running' ? 'bg-orange-600/10 border-orange-500/30 text-orange-400 font-mono' :
                                      repairProgress.status === 'completed' ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 font-bold' :
                                      repairProgress.status === 'error' ? 'bg-red-600/10 border-red-500/30 text-red-400 font-bold' : 'bg-white/5 border-white/10 text-white'
                                    }`}>
                                      <p>{repairProgress.message}</p>
                                    </div>
                                  )}

                                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gradient-to-r from-orange-600/10 to-amber-600/5 rounded-2.5xl border border-orange-500/15 gap-4">
                                    <div className="text-right flex-1 select-none">
                                      <p className="text-white font-black text-sm">تسوية وتصحيح التضاربات تلقائياً</p>
                                      <p className="text-xs text-gray-400 mt-1">تقوم الأداة بمطابقة العدادات، موازنة حركات الصندوق المتصلة بالفواتير الحالية، وتسوية وتصفية مجاميع وعلاقات الفواتير بكبسة زر واحدة.</p>
                                    </div>
                                    <button
                                      onClick={repairAllDiscrepancies}
                                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-2xl font-black text-xs shadow-xl transition-all text-center shrink-0"
                                    >
                                      إصلاح وتصحيح التضاربات تلقائياً
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">عداد تسلسل الفواتير</span>
                                        {auditResults.invoiceCounter.conflict ? (
                                          <span className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black">تضارب مكتشف</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <div className="text-xs space-y-1 text-gray-400 text-right">
                                        <p>العداد المسجل بالإعدادات: <strong className="text-white font-mono">{auditResults.invoiceCounter.registered}</strong></p>
                                        <p>أعلى رقم فاتورة فعلي باللائحة: <strong className="text-white font-mono">{auditResults.invoiceCounter.actualMax}</strong></p>
                                      </div>
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">عداد تسلسل أرقام العملاء</span>
                                        {auditResults.customerCounter.conflict ? (
                                          <span className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black">تضارب مكتشف</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <div className="text-xs space-y-1 text-gray-400 text-right">
                                        <p>العداد المسجل بالإعدادات: <strong className="text-white font-mono">{auditResults.customerCounter.registered}</strong></p>
                                        <p>أعلى رقم تسلسلي للعملاء باللائحة: <strong className="text-white font-mono">{auditResults.customerCounter.actualMax}</strong></p>
                                      </div>
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">مطابقة قيمة الفاتورة ومجاميع الأجهزة</span>
                                        {auditResults.totalDiscrepancies.length > 0 ? (
                                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black">{auditResults.totalDiscrepancies.length} تباينات</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400">يتحقق من دقة اجمالي سعر الفاتورة الأم مقارنة بمجموع تكلفة أجهزة الصيانة المسجلة بداخلها.</p>
                                      {auditResults.totalDiscrepancies.length > 0 && (
                                        <div className="max-h-24 overflow-y-auto space-y-1.5 p-2 bg-black/40 rounded-xl font-mono text-[10px] text-red-300 text-right">
                                          {auditResults.totalDiscrepancies.map((d: any, idx: number) => (
                                            <p key={idx}>فاتورة #{d.invoiceNumber}: الفاتورة ({d.currentTotal}) ↔ المجموع الحقيقي ({d.computedTotal})</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">مطابقة الحالات والوضع الفني للعمليات</span>
                                        {auditResults.statusDiscrepancies.length > 0 ? (
                                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-black">{auditResults.statusDiscrepancies.length} اختلافات</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400">فحص ملخص الفاتورة الخارجي ومطابقته بذكاء بمراحل الصيانة الفنية الفردية الملحقة.</p>
                                      {auditResults.statusDiscrepancies.length > 0 && (
                                        <div className="max-h-24 overflow-y-auto space-y-1.5 p-2 bg-black/30 rounded-xl font-mono text-[10px] text-amber-300 text-right">
                                          {auditResults.statusDiscrepancies.map((d: any, idx: number) => (
                                            <p key={idx}>فاتورة #{d.invoiceNumber}: مسجل ({d.currentStatus}) ↔ الفعلي ({d.expectedStatus})</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">تطابق الصندوق والمدفوعات</span>
                                        {auditResults.paymentImbalances.length > 0 ? (
                                          <span className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black">{auditResults.paymentImbalances.length} عدم تطابق</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-400">مقارنة وتدقيق المدفوعات المسجلة بالفاتورة مقابل القيود المقبوضة فعلياً في صندوق الخزينة الحقيقية.</p>
                                      {auditResults.paymentImbalances.length > 0 && (
                                        <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 bg-black/30 rounded-xl font-mono text-[10px] text-red-300 text-right">
                                          {auditResults.paymentImbalances.map((d: any, idx: number) => (
                                            <p key={idx}>فاتورة #{d.invoiceNumber}: الفاتورة ({d.amountPaidOnInvoice}) ↔ المقبوض بالصندوق ({d.amountInLedger})</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">السجلات اليتيمة والتالفة</span>
                                        {(auditResults.orphanedItems.length > 0 || auditResults.emptyInvoices.length > 0) ? (
                                          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-black">تباينات مكتشفة</span>
                                        ) : (
                                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black">سليم</span>
                                        )}
                                      </div>
                                      <div className="text-xs space-y-1 text-gray-400 text-right">
                                        <p>قطع غيار صيانة يتيمة بلا فواتير رئيسية: <strong className="text-white font-mono">{auditResults.orphanedItems.length}</strong></p>
                                        <p>فواتير فارغة كلياً بلا أجهزة مسجلة: <strong className="text-white font-mono">{auditResults.emptyInvoices.length}</strong></p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-12 text-gray-500 select-none">
                                   يرجى النقر فوق "تحديث الفحص" لبدء مراجعة قواعد البيانات والعمليات المتراكمة وتحقيق السلامة.
                                </div>
                              )}
                            </section>
                          )}
                      </motion.div>
                    )}
                  </div>
                )}

                {activeTab === 'users' && (activeTab !== 'main') && (
                  <div className="pb-8">
                    <UserManagement currentUser={user} />
                  </div>
                )}

                {activeTab === 'engineers' && (
                   <EngineersTable />
                )}

                {activeTab === 'device-management' && (
                   <DeviceManagement user={user} onBack={() => setActiveTab('main')} />
                )}

                {activeTab === 'accounting-inputs' && (
                   <AccountingInputs />
                )}

                {activeTab === 'categories' && (
                   <CategoriesTable />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeviceSupportWarning({ type }: { type: 'biometric' | 'pin' }) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const info = await Device.getInfo();
      if (info.platform === 'web' && type === 'biometric') {
        setSupported(false);
        return;
      }
      if (type === 'biometric') {
        try {
          const bio = await NativeBiometric.isAvailable();
          setSupported(bio.isAvailable);
        } catch {
          setSupported(false);
        }
      } else {
        setSupported(true);
      }
    };
    check();
  }, [type]);

  if (supported === false) {
    return (
      <p className="text-[10px] text-red-400 font-bold mt-1 animate-pulse">
        ⚠️ هذا الجهاز لا يدعم {type === 'biometric' ? 'البصمة' : 'PIN'}
      </p>
    );
  }
  return null;
}
