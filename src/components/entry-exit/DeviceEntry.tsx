import { sharePdfFile } from '../../lib/shareHelper';
import { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Save, 
  CircleDollarSign,
  User,
  Phone,
  HardDrive,
  AlertTriangle,
  Info,
  CheckCircle,
  Loader2,
  ChevronRight,
  X,
  MapPin,
  Facebook,
  Smartphone,
  MessageCircle,
  Printer,
  Share2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeDocumentStyles, sanitizeElementInlineStyles, cleanOklchInStyleText } from '../../lib/html2canvasHelper';
import BankAccountsFooter from '../BankAccountsFooter';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  runTransaction,
  writeBatch,
  onSnapshot
} from '../../firebase';
import { db } from '../../firebase';
import { Customer, Invoice, InvoiceItem, User as SystemUser, VaultTransaction } from '../../types';
import { handleFirestoreError } from '../../lib/error-handler';
import { OperationType } from '../../types';
import { useTranslation } from 'react-i18next';
import { localDb } from '../../lib/local-db';

export default function DeviceEntry({ onBack, user }: { onBack: () => void, user: SystemUser }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deviceCategories, setDeviceCategories] = useState<{ id: string; name: string }[]>([]);
  const [deviceModels, setDeviceModels] = useState<{ id: string; name: string; categoryName?: string }[]>([]);
  const [noPhone, setNoPhone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ invoiceNumber: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [shopConfig, setShopConfig] = useState<any>(null);
  const [currentOutput, setCurrentOutput] = useState<any>(null);

  // Form State
  const [customer, setCustomer] = useState({ name: '', phone1: '', phone2: '', notes: '' });
  const [keyboardMode, setKeyboardMode] = useState<Record<string, 'none' | 'text'>>({});
  const isRefocusing = useRef<Record<string, boolean>>({});
  const focusInitiated = useRef<Record<string, boolean>>({});
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  
  const [activeAutocomplete, setActiveAutocomplete] = useState<{index: number, type: 'deviceType' | 'deviceName'} | null>(null);

  const [notes, setNotes] = useState('لا يوجد');
  const [currency, setCurrency] = useState<'USD' | 'SAR' | 'YER'>('USD');
  const [items, setItems] = useState<(Partial<InvoiceItem> & { unitCost?: number | '' })[]>([]);
  
  const initialDeviceState = { deviceType: '', deviceName: '', quantity: 1, faultType: 'يحتاج صيانة', deviceNotes: 'لا يوجد', technicalNotes: '', status: '10', cost: 0, technician: '' };
  const [currentDevice, setCurrentDevice] = useState<Partial<InvoiceItem> & { unitCost?: number | '' }>(initialDeviceState);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    // 1. App settings for real-time invoice number
    const unsubscribeAppSettings = onSnapshot(doc(db, 'settings', 'app'), (docSnap) => {
      const data = docSnap.data();
      const last = Number(data?.lastInvoiceNumber) || 0;
      setInvoiceNumber(`${last + 1}`);
    });

    // 2. Shop settings for company details (logo, name, phones, etc)
    const loadShopConfig = async () => {
      try {
        // Try Firebase first
        const docSnap = await getDoc(doc(db, 'settings', 'shop'));
        if (docSnap.exists()) {
          setShopConfig(docSnap.data());
          return;
        }

        // Fallback to SQLite company_details
        const localRes = await localDb.query("SELECT * FROM company_details LIMIT 1");
        if (localRes.values && localRes.values.length > 0) {
          setShopConfig(localRes.values[0]);
        }
      } catch (err) {
        console.error("Error loading shop config:", err);
      }
    };

    const unsubscribeShopSettings = onSnapshot(doc(db, 'settings', 'shop'), (docSnap) => {
      if (docSnap.exists()) {
        setShopConfig(docSnap.data());
      }
    });

    loadShopConfig();

    // Fetch customers for search
    const fetchCustomers = async () => {
      const s = await getDocs(collection(db, 'customers'));
      setExistingCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    };
    fetchCustomers();

    // Fetch categories
    const unsubscribeCats = onSnapshot(collection(db, 'device_categories'), (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setDeviceCategories(cats);
    });

    // Fetch models
    const unsubscribeModels = onSnapshot(collection(db, 'device_models'), (snapshot) => {
      setDeviceModels(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    return () => {
      unsubscribeAppSettings();
      unsubscribeShopSettings();
      unsubscribeCats();
      unsubscribeModels();
    };
  }, []);

  const [pendingNewDevices, setPendingNewDevices] = useState<{categories: string[], models: string[]} | null>(null);

  const handlePreAddDeviceToTable = () => {
    if (!currentDevice.deviceType?.trim() || !currentDevice.deviceName?.trim() || !currentDevice.faultType?.trim() || !currentDevice.quantity || currentDevice.quantity < 1) return;

    const cat = currentDevice.deviceType?.trim();
    const mod = currentDevice.deviceName?.trim();
    
    let isNewCat = cat && !deviceCategories.some(c => c.name === cat);
    let isNewMod = mod && !deviceModels.some(m => m.name === mod);

    if (isNewCat || isNewMod) {
      setPendingNewDevices({ 
        categories: isNewCat ? [cat] : [], 
        models: isNewMod ? [mod] : [] 
      });
      return;
    }
    
    addDeviceToTable();
  };

  const addDeviceToTable = () => {
    if (!currentDevice.deviceType?.trim() || !currentDevice.deviceName?.trim() || !currentDevice.faultType?.trim() || !currentDevice.quantity || currentDevice.quantity < 1) return;
    
    if (editingIndex !== null) {
      setItems(currentItems => {
        const newItems = [...currentItems];
        newItems[editingIndex] = { ...currentDevice };
        return newItems;
      });
      setEditingIndex(null);
    } else {
      setItems([...items, { ...currentDevice }]);
    }
    setCurrentDevice(initialDeviceState);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setCurrentDevice(initialDeviceState);
    }
  };

  const editItem = (index: number) => {
    setEditingIndex(index);
    setCurrentDevice({ ...items[index] });
  };

  const handlePreviewInit = () => {
    if (!customer.name) {
      setErrorMsg(t('addInvoice.errorNameReq'));
      return;
    }
    
    if (!noPhone && !customer.phone1) {
      setErrorMsg(t('addInvoice.errorPhoneReq'));
      return;
    }

    if (items.length === 0 || items.some(i => !i.deviceType || !i.faultType)) {
      setErrorMsg(t('addInvoice.errorItemsReq'));
      return;
    }

    setShowPreview(true);
  };

  const handleSaveFinal = async (action: 'commit' | 'print' | 'whatsapp') => {
    setPendingNewDevices(null);
    setLoading(true);
    let finalAssignedInvoiceNumber = invoiceNumber;

    try {
      const settingsRef = doc(db, 'settings', 'app');
      const settingsDoc = await getDoc(settingsRef);
      
      let lastInvoiceNumber = 0;
      if (settingsDoc.exists()) {
        lastInvoiceNumber = Number(settingsDoc.data()?.lastInvoiceNumber) || 0;
      }
      finalAssignedInvoiceNumber = `${lastInvoiceNumber + 1}`;
      let settingsUpdates: any = { lastInvoiceNumber: lastInvoiceNumber + 1 };

      const batch = writeBatch(db);

      // 1. Handle Customer
      let finalCustomerId = selectedCustomerId;
      if (!finalCustomerId) {
        let lastCustomerNumber = 0;
        if (settingsDoc.exists()) {
          lastCustomerNumber = Number(settingsDoc.data()?.lastCustomerNumber) || 0;
        }
        const finalCustomerNumber = lastCustomerNumber + 1;

        const customerRef = doc(collection(db, 'customers'));
        batch.set(customerRef, {
          customerNumber: finalCustomerNumber,
          name: customer.name,
          phone1: noPhone ? 'لا يوجد' : customer.phone1,
          phone2: customer.phone2,
          createdAt: serverTimestamp()
        });
        finalCustomerId = customerRef.id;
        
        settingsUpdates.lastCustomerNumber = finalCustomerNumber;
      }

      // 2. Handle Invoice
      const invoiceTotal = 0;
      const invoiceRef = doc(collection(db, 'invoices'));
      batch.set(invoiceRef, {
        invoiceNumber: finalAssignedInvoiceNumber,
        customerId: finalCustomerId,
        customerName: customer.name,
        currency: currency,
        totalCost: invoiceTotal,
        amountPaid: 0,
        status: '10',
        notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Handle Items
      for (const item of items) {
        const itemRef = doc(collection(db, 'invoice_items'));
        const cleanItem = {
          invoiceId: invoiceRef.id,
          invoiceNumber: finalAssignedInvoiceNumber,
          customerId: finalCustomerId,
          customerName: customer.name,
          categoryId: '', // We don't have catId strictly until we find it
          deviceType: item.deviceType || 'مجهول',
          deviceName: item.deviceName || '',
          quantity: Number(item.quantity) || 1,
          customerProblem: item.faultType || 'يحتاج صيانة',
          deviceNotes: item.deviceNotes || 'لا يوجد',
          cost: 0,
          status: '10',
          technician: '',
          createdAt: serverTimestamp(),
          createdBy: user?.name || 'System'
        };
        batch.set(itemRef, cleanItem);

        // Auto-add new category
        let currentCatName = item.deviceType?.trim();
        let catId = '';
        if (currentCatName) {
           catId = currentCatName.replace(/\//g, '_');
           const catRef = doc(db, 'device_categories', catId);
           batch.set(catRef, { name: currentCatName, createdAt: serverTimestamp() }, { merge: true });
        }

        // Auto-add new model under the category
        let currentModelName = item.deviceName?.trim();
        if (currentModelName && catId) {
           const modelId = `${catId}_${currentModelName.replace(/\//g, '_')}`;
           const modelRef = doc(db, 'device_models', modelId);
           batch.set(modelRef, { 
             categoryId: catId, 
             categoryName: currentCatName, 
             name: currentModelName, 
             createdAt: serverTimestamp() 
           }, { merge: true });
        }
      }

      // 4. Update Settings
      batch.set(settingsRef, settingsUpdates, { merge: true });

      await batch.commit();

      // Update the local invoiceNumber temporarily so PDF captures the correct number
      setInvoiceNumber(finalAssignedInvoiceNumber);

      // Wait a moment for React to render the new invoice number
      await new Promise(resolve => setTimeout(resolve, 0));

      if (action === 'print' || action === 'whatsapp') {
        const outputRef = await addDoc(collection(db, 'document_outputs'), {
          document_id: invoiceRef.id,
          document_number: finalAssignedInvoiceNumber,
          output_type: action === 'print' ? 'PRINT' : 'Share',
          output_datetime: serverTimestamp(),
          user_id: user?.id || 'System' // Assumes user has an id or use name if id is not robust
        });

        setCurrentOutput({
          id: outputRef.id,
          user_id: (user as any)?.uid || user?.id || user?.name || 'System',
          output_datetime: new Date()
        });

        // Wait a moment for React to render the output block
        await new Promise(resolve => setTimeout(resolve, 100));

        const originalStyle = document.createElement('style');
        originalStyle.innerHTML = `
          @media print {
        @page { size: auto; margin: 0; }
            body * { visibility: hidden !important; }
            #print-report-area, #print-report-area * { visibility: visible !important; }
            #print-report-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
          margin: 0 !important;
          padding: 10mm !important;
              color: #000000 !important;
              background-color: #ffffff !important;
            }
          }
        `;

        if (action === 'print') {
          document.head.appendChild(originalStyle);
          window.print();
          document.head.removeChild(originalStyle);
        } else if (action === 'whatsapp') {
          const element = document.getElementById('print-report-area');
          if (element) {
            const originalGetComputedStyle = window.getComputedStyle;
            let tempEl: HTMLDivElement | null = null;
            try {
              tempEl = document.createElement('div');
              tempEl.style.display = 'none';
              document.body.appendChild(tempEl);

              const convertToRgb = (color: string) => {
                if (!color || (!color.includes('oklch') && !color.includes('oklab'))) return color;
                try {
                  if (!tempEl) return 'rgb(0, 0, 0)';
                  tempEl.style.color = '';
                  tempEl.style.color = color;
                  const rgb = originalGetComputedStyle.call(window, tempEl).color;
                  if (rgb && !rgb.includes('oklch') && !rgb.includes('oklab')) {
                    return rgb;
                  }
                  return 'rgb(0, 0, 0)';
                } catch (e) {
                  return 'rgb(0, 0, 0)';
                }
              };

              const customGetComputedStyle = (el: Element, pseudoElt?: string | null) => {
                const style = originalGetComputedStyle.call(window, el, pseudoElt);
                return new Proxy(style, {
                  get(target: any, prop: string) {
                    const val = target[prop];
                    if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                      return convertToRgb(val);
                    }
                    if (typeof val === 'function') {
                      return function(...args: any[]) {
                        const res = val.apply(target, args);
                        if (typeof res === 'string' && (res.includes('oklch') || res.includes('oklab'))) {
                          return convertToRgb(res);
                        }
                        return res;
                      };
                    }
                    return val;
                  }
                });
              };

              window.getComputedStyle = customGetComputedStyle as any;

              await sanitizeDocumentStyles();
              sanitizeElementInlineStyles(element);

              let clonedAreaHeight = 842;
              const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                  const styles = clonedDoc.querySelectorAll('style');
                  styles.forEach((style) => {
                    if (style.textContent && (style.textContent.includes('oklch') || style.textContent.includes('oklab'))) {
                      style.textContent = cleanOklchInStyleText(style.textContent);
                    }
                  });

                  const win = clonedDoc.defaultView;
                  if (win) {
                    win.getComputedStyle = customGetComputedStyle;
                  }

                  const clonedArea = clonedDoc.getElementById('print-report-area');
                  if (clonedArea) {
                    clonedAreaHeight = clonedArea.offsetHeight || 800;
                    clonedArea.style.backgroundColor = '#ffffff';
                    clonedArea.style.color = '#111827';
                    clonedArea.style.padding = '35px';
                    clonedArea.style.borderRadius = '0px';
                    clonedArea.style.boxShadow = 'none';
                    clonedArea.style.direction = 'rtl';
                    clonedArea.style.fontFamily = 'Cairo, system-ui, sans-serif';

                    const allElements = clonedArea.querySelectorAll('*');
                    allElements.forEach((el: any) => {
                      el.style.letterSpacing = 'normal';
                      el.style.setProperty('letter-spacing', 'normal', 'important');

                      let classes = el.className || '';
                      if (typeof classes === 'string' && classes) {
                        if (classes.includes('text-emerald-') || classes.includes('text-green-600')) el.style.color = '#059669';
                        if (classes.includes('text-red-') || classes.includes('text-rose-')) el.style.color = '#e11d48';
                        if (classes.includes('text-orange-')) el.style.color = '#ea580c';
                        if (classes.includes('text-gray-900') || classes.includes('text-black')) el.style.color = '#111827';
                        if (classes.includes('text-gray-500') || classes.includes('text-gray-600')) el.style.color = '#4b5563';
                        if (classes.includes('text-blue-600')) el.style.color = '#2563eb';
                        if (classes.includes('bg-gray-50')) el.style.backgroundColor = '#f9fafb';
                        if (classes.includes('bg-gray-100')) el.style.backgroundColor = '#f3f4f6';
                        if (classes.includes('bg-gray-200')) el.style.backgroundColor = '#e5e7eb';
                      }
                    });
                  }
                }
              });

              const imgData = canvas.toDataURL('image/jpeg', 0.8);
              const mmWidth = 210;
              const mmHeight = (clonedAreaHeight * 0.264583) + 20;

              const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
              });

              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              let heightLeft = pdfHeight;
              let position = 0;

              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
              heightLeft -= pdf.internal.pageSize.getHeight();

              while (heightLeft > 0.5) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                heightLeft -= pdf.internal.pageSize.getHeight();
              }
              
              const formattedDate = new Date().toISOString().split('T')[0];
              const filename = `سند إستلام أجهزة للصيانة_${customer.name}_${formattedDate}.pdf`;
              pdf.save(filename);

              let message = `*فاتورة دخول أجهزة* 📄\n\n`;
              message += `عزيزي العميل *${customer.name}* المحترم،\n`;
              message += `تجد أدناه الفاتورة الخاصة باستلام أجهزتكم رقم *${finalAssignedInvoiceNumber}*:\n\n`;
              message += `- *رقم الفاتورة:* ${finalAssignedInvoiceNumber}\n\n`;
              message += `*الأجهزة المستلمة:*\n`;
              items.forEach((item, index) => {
                message += `\n_${index + 1}. *${item.deviceType} - ${item.deviceName || ''}*_\n`;
                message += `   • المشكلة: ${item.faultType || '-'}\n`;
              });
              message += `\nيسعدنا خدمتكم دائمًا. شكرًا لتعاملكم معنا!`;

              let sharedNatively = false;
              try {
        const pdfBlob = pdf.output('blob');
        sharedNatively = await sharePdfFile(pdfBlob, filename, message);
      } catch (shareErr) {
                console.warn('Native sharing failed, falling back to WhatsApp redirect', shareErr);
              }

              if (!sharedNatively) {
                const cleanPhone = customer.phone1 && /^[0-9+]+$/.test(customer.phone1.replace(/\s+/g, ''))
                  ? customer.phone1.replace(/\s+/g, '')
                  : '';
                const encodedMessage = encodeURIComponent(message);
                const url = cleanPhone
                  ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
                  : `https://wa.me/?text=${encodedMessage}`;
                window.open(url, '_blank');
              }
            } catch (err) {
              console.error('Failed to generate or share PDF', err);
            } finally {
              window.getComputedStyle = originalGetComputedStyle;
              if (tempEl && tempEl.parentNode) {
                tempEl.parentNode.removeChild(tempEl);
              }
            }
          }
        }
      }

      // Success Handling
      setSuccessInfo({ invoiceNumber: finalAssignedInvoiceNumber });

      // Reset form on success
      setCustomer({ name: '', phone1: '', phone2: '', notes: '' });
      setItems([]);
      setCurrentDevice(initialDeviceState);
      setEditingIndex(null);
      setNotes('');
      setNoPhone(false);
      setShowPreview(false);
      setInvoiceNumber((Number(finalAssignedInvoiceNumber) + 1).toString());
      
    } catch (error: any) {
      setErrorMsg(`Error saving: ${error.message || error}`);
      handleFirestoreError(error, OperationType.WRITE, 'invoices/items');
    } finally {
      setLoading(false);
    }
  };

  const canSave = customer.name.trim() !== '' && 
    (noPhone || customer.phone1.trim() !== '') && 
    items.length > 0 && 
    items.every(i => 
      i.deviceType?.trim() !== '' && 
      i.faultType?.trim() !== '' &&
      i.quantity !== '' && i.quantity !== undefined && Number(i.quantity) >= 1
    );

  return (
    <div className="w-full pb-32">
      {/* Error Modal */}
      {errorMsg && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setErrorMsg(null)}></div>
          <div className="relative bg-[#1a1a1a] p-8 w-full max-w-sm rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6 text-center">
             <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={40} />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black">{t('addInvoice.errorTitle')}</h3>
                <p className="text-gray-400 text-sm">{errorMsg}</p>
             </div>
             <button onClick={() => setErrorMsg(null)} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all border border-white/10">
               {t('addInvoice.cancel')}
             </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successInfo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSuccessInfo(null)}></div>
          <div className="relative bg-[#1a1a1a] p-8 w-full max-w-sm rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6 text-center">
             <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto border-4 border-green-500/20">
                <CheckCircle size={48} className="stroke-[3]" />
             </div>
             <div className="space-y-4">
                <h3 className="text-2xl font-black">تم حفظ الفاتورة بنجاح</h3>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <p className="text-gray-400 text-sm mb-1">{t('addInvoice.ticketNumber')}</p>
                  <p className="text-5xl font-mono font-black text-orange-500">{successInfo.invoiceNumber}</p>
                </div>
             </div>
             <div className="pt-2">
               <button onClick={() => setSuccessInfo(null)} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95">
                 إغلاق ومتابعة
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {pendingNewDevices && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPendingNewDevices(null)}></div>
          <div className="relative bg-[#1a1a1a] p-6 w-full max-w-sm rounded-[2rem] border border-orange-500/30 font-sans flex flex-col text-right">
             <h3 className="text-xl font-black text-white mb-2">تأكيد الإضافة</h3>
             <p className="text-gray-400 text-sm font-bold mb-4">هذه البيانات غير مسجلة مسبقاً، هل أنت متأكد أنك تريد إضافتها للنظام؟</p>
             
             {pendingNewDevices.categories.length > 0 && (
               <div className="mb-4">
                 <h4 className="text-orange-500 text-xs font-black mb-1">الأنواع الجديدة:</h4>
                 <div className="flex flex-wrap gap-2">
                    {pendingNewDevices.categories.map(c => <span key={c} className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs text-white">{c}</span>)}
                 </div>
               </div>
             )}

             {pendingNewDevices.models.length > 0 && (
               <div className="mb-4">
                 <h4 className="text-orange-500 text-xs font-black mb-1">الموديلات/الأجهزة الجديدة:</h4>
                 <div className="flex flex-wrap gap-2">
                    {pendingNewDevices.models.map(m => <span key={m} className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs text-white">{m}</span>)}
                 </div>
               </div>
             )}

             <div className="flex gap-3 mt-2">
               <button onClick={() => { addDeviceToTable(); setPendingNewDevices(null); }} className="flex-1 bg-orange-600 hover:bg-orange-700 font-bold py-3 text-white rounded-xl">نعم، إضافة للجدول</button>
               <button onClick={() => setPendingNewDevices(null)} className="flex-1 bg-white/10 hover:bg-white/20 font-bold py-3 text-white rounded-xl">إلغاء التعديل</button>
             </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col pointer-events-auto" dir="rtl">
          {/* Top Actions Bar */}
          <div className="flex justify-between items-center bg-black/50 p-4 border-b border-white/10 shrink-0 flex-wrap gap-4 print:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-slate-200 border border-slate-300 rounded-xl text-slate-900 hover:bg-slate-300 font-bold transition-all flex items-center gap-2 text-sm shadow-md"
              >
                <ArrowLeft size={16} className="rtl:rotate-180" />
                العودة للتعديل
              </button>
              <h2 className="text-white font-bold hidden sm:block">فاتورة دخول أجهزه - #{invoiceNumber}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveFinal('commit')}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)]"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                حفظ وترحيل
              </button>
              <button
                onClick={() => handleSaveFinal('print')}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Printer size={16} />
                حفظ وطباعة مباشرة
              </button>
              <button
                onClick={() => handleSaveFinal('whatsapp')}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(5,150,105,0.3)] disabled:opacity-50"
              >
                <MessageCircle size={16} />
                حفظ وتصدير للواتس
              </button>
            </div>
          </div>

          {/* Printable A4 Container */}
          <div className="flex-1 overflow-x-auto bg-black p-4 md:p-8 pb-24 text-right w-full">
            <div id="print-report-area" className="p-8 bg-white text-gray-900 print:p-0 print:bg-white print:text-black w-[794px] min-h-fit mx-auto flex flex-col relative shrink-0 font-cairo text-right" dir="rtl">
              {/* Header Layout */}
              <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-4">
                {/* Right Corner: Shop Name */}
                <div className="text-right flex-1 pt-1">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight font-cairo whitespace-nowrap">{shopConfig?.shopName || 'عالم الصيانة والتجارة'}</h2>
                  <div className="text-sm font-black text-gray-900 tracking-tight leading-tight mt-1.5 font-cairo">قسم الصيانة</div>
                  <div className="mt-2 space-y-1">
                    {(shopConfig?.phone1 || shopConfig?.phone2) && (
                      <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                        <span>تلفون :</span>
                        <span dir="ltr" className="font-mono">
                          {shopConfig?.phone1}
                          {shopConfig?.phone1 && shopConfig?.phone2 && ' - '}
                          {shopConfig?.phone2}
                        </span>
                        <div className="flex items-center gap-1 mr-1.5">
                          <Smartphone size={10} className="text-gray-700" />
                          {(shopConfig?.phone1Whatsapp || shopConfig?.phone2Whatsapp) && (
                            <MessageCircle size={10} className="text-green-600" />
                          )}
                        </div>
                      </div>
                    )}
                    {shopConfig?.landline && (
                      <div className="text-[10px] font-bold text-gray-800 flex items-center justify-start gap-1.5 w-fit">
                        <span>ثابت :</span>
                        <span dir="ltr" className="font-mono">{shopConfig.landline}</span>
                        <div className="flex items-center gap-1 mr-1.5">
                          <Phone size={10} className="text-gray-700" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Center: Title / Logo */}
                <div className="text-center flex-[1.2] flex flex-col items-center justify-center">
                  {shopConfig?.logoUrl ? (
                    <img 
                      src={shopConfig.logoUrl} 
                      alt="Logo" 
                      className="h-16 max-w-[150px] object-contain mb-1.5" 
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-12 h-12 border border-dashed border-gray-300 rounded-xl mb-1.5 flex items-center justify-center text-gray-400 text-[10px] font-bold">شعار المحل</div>
                  )}
                  <h1 className="text-lg font-black text-gray-900 tracking-tight border-2 border-gray-900 px-4 py-1.5 rounded-lg inline-block bg-gray-50/50">فاتورة دخول أجهزة</h1>
                </div>

                {/* Left Corner: Invoice Info */}
                <div className="text-left flex-1 space-y-1 pt-1 bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                    <span>رقم المستند:</span>
                    <span className="font-mono text-gray-900">{invoiceNumber}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4">
                    <span>التاريخ:</span>
                    <span className="font-mono text-gray-900">{new Date().toISOString().slice(0,10).replace(/-/g, '/')}</span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                    <span>وقت الإصدار:</span>
                    <span className="font-mono text-gray-900" dir="ltr">
                      {new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-700 flex justify-between gap-4 border-t border-gray-200 pt-1 mt-1">
                    <span>المستخدم:</span>
                    <span className="font-mono text-gray-900">1</span>
                  </div>
                </div>
              </div>

              {/* Bank Accounts - if any (placeholder for consistency) */}
              {/* <div className="mb-4 text-xs">...</div> */}

              {/* Customer Info Box */}
              <div className="bg-gray-100 p-3 rounded-lg mb-4 border border-gray-300 flex justify-between items-center px-6">
                <div className="text-sm font-black text-gray-900">
                  <span className="text-xs text-gray-600 ml-2">العميل:</span>
                  {customer.name}
                </div>
                <div className="text-sm font-black text-gray-900">
                  <span className="text-xs text-gray-600 ml-2">الجوال:</span>
                  <span className="font-mono" dir="ltr">{noPhone ? 'لا يوجد هاتف' : customer.phone1}</span>
                  {customer.phone2 && (
                    <span className="font-mono text-gray-600 mr-2" dir="ltr">({customer.phone2})</span>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-center border-2 border-black mb-6">
                <thead className="bg-white text-black border-b-2 border-black">
                  <tr>
                    <th className="py-2 px-3 border border-black text-sm font-bold w-12 text-center">مسلسل</th>
                    <th className="py-2 px-3 border border-black text-sm font-bold text-right" style={{minWidth: '200px'}}>اسم النوع/اسم الجهاز</th>
                    <th className="py-2 px-3 border border-black text-sm font-bold text-right w-1/3 text-center">المشكلة من وجهة نظر العميل</th>
                    <th className="py-2 px-3 border border-black text-sm font-bold text-right w-1/4 text-center">تفاصيل</th>
                    <th className="py-2 px-3 border border-black text-sm font-bold w-16 text-center">العدد</th>
                  </tr>
                </thead>
                <tbody className="text-black font-bold">
                  {items.map((item, index) => (
                    <tr key={index} className="border-b border-black">
                      <td className="py-3 px-3 border-l border-black text-xs text-center">{index + 1}</td>
                      <td className="py-3 px-3 border-l border-black text-right whitespace-nowrap text-sm">
                        {item.deviceType} - <span className="text-gray-600 text-[10px]">{item.deviceName}</span>
                      </td>
                      <td className="py-3 px-3 border-l border-black text-xs text-right whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">{item.faultType || '-'}</td>
                      <td className="py-3 px-3 border-l border-black text-xs text-right whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">{item.deviceNotes || '-'}</td>
                      <td className="py-3 px-3 text-sm font-bold text-center">{item.quantity}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 border-t-2 border-black">
                    <td colSpan={4} className="py-3 px-4 border-l border-black text-left font-black text-sm">اجمالي الأجهزة المستلمة</td>
                    <td className="py-3 px-3 text-sm font-black text-center">{items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</td>
                  </tr>
                </tbody>
              </table>

              {notes && (
                <div className="text-xs text-gray-700 font-bold mb-6 flex gap-2">
                  <span className="text-black">ملاحظات الفاتورة:</span> {notes}
                </div>
              )}

              {/* Footer Section */}
              <div className="mt-8">
                <div className="border-t border-black/20 mb-6"></div>

                <div className="flex justify-between items-start text-xs font-bold text-gray-900 leading-loose mb-6 px-4">
                   {/* Right Side (أقصى اليمين) */}
                   <div className="text-right space-y-1">
                      <p>يرجى الاحتفاظ بهذا السند وإحضاره لاستلام الاجهزة</p>
                      <p>المحل غير مسؤول عن هذه الأجهزة بعد مرور شهرين</p>
                      <p className="pt-6 font-black">توقيع العميل / ........................................</p>
                   </div>

                   {/* Left Side (أقصى الشمال) */}
                   <div className="text-left space-y-1">
                      <p>سوف يتم موافاتكم بتكاليف الصيانة بعد عملية الفحص</p>
                      <p className="pt-8">اسم المختص / ....................... التوقيع / .......................</p>
                   </div>
                </div>

                <div className="border-t-[3px] border-black mt-2 mb-1 border-solid"></div>
                
                {(shopConfig?.address || shopConfig?.facebookUrl) && (
                  <div className="flex flex-row items-center justify-between text-[10px] font-bold text-black font-cairo py-1 mt-0">
                    {shopConfig?.address && (
                      <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                         <MapPin size={12} className="text-gray-600" />
                         <span className="text-gray-900">{shopConfig.address}</span>
                      </div>
                    )}
                    
                    {shopConfig?.facebookUrl && (
                      <div className="flex items-center gap-1.5 justify-center flex-row-reverse text-center w-max">
                        <Facebook size={12} className="text-blue-600" />
                        <span dir="ltr" className="text-gray-900">{shopConfig.facebookUrl}</span>
                      </div>
                    )}
                  </div>
                )}

                <BankAccountsFooter shopConfig={shopConfig} currentOutput={currentOutput} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Unified Header */}
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/20" dir="rtl">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all">
                <ArrowLeft size={18} className="rtl:rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-black text-white flex items-center gap-2 m-0 p-0">
               {t('addInvoice.title')}
               <span className="text-[10px] bg-orange-600/10 text-orange-500 font-bold px-2 py-0.5 rounded border border-orange-500/20">#{invoiceNumber || '...'}</span>
            </h2>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-3xl border border-white/5 shadow-2xl flex flex-col overflow-hidden">
          <div className="flex-1 p-0 space-y-0">
            {/* Unified Form Block */}
            <section className="p-4 md:p-5 space-y-4" dir="rtl">
                
                {/* Customer and Notes Section combined rows */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Customer Section */}
                <div className="col-span-1 lg:col-span-2 space-y-3">
                  <div className="flex flex-row items-center justify-between pb-2 border-b border-white/5 mb-3 gap-2">
                     <h3 className="font-bold text-white text-sm flex items-center gap-2 shrink-0">
                       <User size={16} className="text-orange-500" />
                       تفاصيل العميل
                     </h3>
                     
                     <div className="flex flex-row items-center justify-end gap-3 shrink-0 flex-wrap">
                      <label className="flex items-center gap-1 cursor-pointer group">
                        <input type="radio" value="USD" checked={currency === 'USD'} onChange={(e) => setCurrency(e.target.value as 'USD' | 'SAR' | 'YER')} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer mb-0.5" />
                        <span className={`text-[10px] font-bold transition-colors ${currency === 'USD' ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>دولار </span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer group">
                        <input type="radio" value="SAR" checked={currency === 'SAR'} onChange={(e) => setCurrency(e.target.value as 'USD' | 'SAR' | 'YER')} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer mb-0.5" />
                        <span className={`text-[10px] font-bold transition-colors ${currency === 'SAR' ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>سعودي </span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer group">
                        <input type="radio" value="YER" checked={currency === 'YER'} onChange={(e) => setCurrency(e.target.value as 'USD' | 'SAR' | 'YER')} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer mb-0.5" />
                        <span className={`text-[10px] font-bold transition-colors ${currency === 'YER' ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>ريال </span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-24 shrink-0">{t('addInvoice.fullName')}</label>
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            inputMode={keyboardMode.customerName || 'none'}
                            value={customer.name}
                            onChange={(e) => {
                              setCustomer({ ...customer, name: e.target.value });
                              setShowCustomerSearch(true);
                            }}
                            onClick={(e) => {
                              if (focusInitiated.current.customerName) {
                                focusInitiated.current.customerName = false;
                              } else if (keyboardMode.customerName !== 'text') {
                                isRefocusing.current.customerName = true;
                                setKeyboardMode(p => ({...p, customerName: 'text'}));
                                const target = e.currentTarget;
                                target.blur();
                                setTimeout(() => {
                                  target.focus();
                                  isRefocusing.current.customerName = false;
                                }, 50);
                              }
                            }}
                            onFocus={(e) => {
                              setShowCustomerSearch(true);
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              focusInitiated.current.customerName = true;
                            }}
                            onBlur={() => {
                              if (isRefocusing.current.customerName) return;
                              setTimeout(() => {
                                setShowCustomerSearch(false);
                                focusInitiated.current.customerName = false;
                                setKeyboardMode(p => ({...p, customerName: 'none'}));
                              }, 200);
                            }}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 outline-none transition-all text-sm font-bold text-white text-right"
                            placeholder={t('addInvoice.enterOrSearch')}
                          />
                        </div>
                      </div>
                      
                      {showCustomerSearch && (
                         <div className="absolute top-full right-0 left-0 ml-16 mt-1 w-[calc(100%-6rem)] bg-[#1a1a1a] border border-white/10 rounded-2xl z-50 shadow-2xl overflow-hidden max-h-60">
                            <div className="overflow-y-auto max-h-48 text-right">
                              {existingCustomers
                                .filter(c => !customer.name || (c.name && c.name.toLowerCase().includes(customer.name.toLowerCase())))
                                .map(c => (
                                  <button 
                                    key={c.id}
                                    className="w-full text-right px-4 py-3 hover:bg-orange-600/10 transition-colors border-b border-white/5 group flex items-center justify-between"
                                    onClick={() => {
                                      setCustomer({ name: c.name, phone1: c.phone1, phone2: c.phone2 || '', notes: c.notes || '' });
                                      setSelectedCustomerId(c.id || null);
                                      setShowCustomerSearch(false);
                                    }}
                                  >
                                     <div className="text-right">
                                       <p className="font-bold text-white group-hover:text-orange-500">{c.name}</p>
                                       <p className="text-xs text-gray-500">{c.phone1}</p>
                                     </div>
                                     <ChevronRight size={14} className="text-gray-700 rotate-180" />
                                  </button>
                                ))
                              }
                            </div>
                            {customer.name && !existingCustomers.some(c => c.name?.toLowerCase() === customer.name.toLowerCase()) && (
                              <button 
                                className="w-full text-right px-4 py-3 bg-orange-600 text-white text-xs font-black uppercase flex items-center justify-center gap-2"
                                onClick={() => {
                                  setSelectedCustomerId(null);
                                  setShowCustomerSearch(false);
                                }}
                              >
                                <Plus size={14} /> {t('addInvoice.addAsNew', { name: customer.name })}
                              </button>
                            )}
                         </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-between w-24 shrink-0">
                        <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right">{t('addInvoice.primaryPhone')}</label>
                        <button 
                          onClick={() => {
                            setNoPhone(!noPhone);
                            if (!noPhone) setCustomer({ ...customer, phone1: '' });
                          }}
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border transition-all ${noPhone ? 'bg-orange-600 border-orange-500 text-white' : 'bg-white/5 border-white/10 text-gray-500'}`}
                        >
                          بدون
                        </button>
                      </div>
                      <div className={`relative flex-1 ${noPhone ? 'opacity-30 pointer-events-none' : ''}`}>
                        <input 
                          type="tel" 
                          dir="ltr"
                          value={customer.phone1}
                          onChange={(e) => setCustomer({ ...customer, phone1: e.target.value.replace(/\D/g, '') })}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 flex-1 focus:border-orange-500 outline-none text-sm font-mono text-white text-right"
                          placeholder="7xxxxxxxx"
                          required={!noPhone}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 uppercase font-black tracking-widest w-24 shrink-0 text-right">{t('addInvoice.secondaryPhone')}</label>
                      <input 
                        type="tel" 
                        dir="ltr"
                        value={customer.phone2}
                        onChange={(e) => setCustomer({ ...customer, phone2: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 flex-1 focus:border-orange-500 outline-none text-sm font-mono text-white text-right"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 uppercase font-black tracking-widest w-24 shrink-0 text-right flex items-center gap-1">
                        الملاحظات
                      </label>
                      <input 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 flex-1 focus:border-orange-500 outline-none text-white text-sm text-right"
                        placeholder="لا يوجد..."
                      />
                    </div>
                  </div>
                  {customer.notes && selectedCustomerId && (
                    <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10 w-full">
                       <p className="text-[10px] text-gray-500 uppercase font-black block text-right">ملاحظات و تفاصيل العميل السابقة</p>
                       <p className="text-sm text-gray-300 font-bold mt-1 text-right">{customer.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Devices Section embedded in the same block */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                 <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <HardDrive size={18} className="text-orange-500" />
                      إضافة جهاز جديد للفاتورة
                    </h3>
                 </div>

                 {/* Adding/Editing Device Form */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-black/20 rounded-2xl border border-white/5 text-right">
                    <div className="relative flex items-center gap-3">
                       <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-20 shrink-0">نوع الجهاز *</label>
                       <div className="relative flex-1">
                         <input 
                           inputMode={keyboardMode.deviceType || 'none'}
                           value={currentDevice.deviceType || ''}
                           onChange={(e) => {
                             setCurrentDevice({ ...currentDevice, deviceType: e.target.value, deviceName: '' });
                             setActiveAutocomplete({ index: 0, type: 'deviceType' });
                           }}
                           onClick={(e) => {
                             setActiveAutocomplete({ index: 0, type: 'deviceType' });
                             if (focusInitiated.current.deviceType) {
                                focusInitiated.current.deviceType = false;
                              } else if (keyboardMode.deviceType !== 'text') {
                               isRefocusing.current.deviceType = true;
                               setKeyboardMode(p => ({...p, deviceType: 'text'}));
                               const target = e.currentTarget;
                               target.blur();
                               setTimeout(() => {
                                 target.focus();
                                 isRefocusing.current.deviceType = false;
                               }, 50);
                             }
                           }}
                           onFocus={(e) => {
                              setActiveAutocomplete({ index: 0, type: 'deviceType' });
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              focusInitiated.current.deviceType = true;
                            }}
                           onBlur={() => {
                             if (isRefocusing.current.deviceType) return;
                             setTimeout(() => {
                                setActiveAutocomplete(prev => prev?.type === 'deviceType' ? null : prev);
                                focusInitiated.current.deviceType = false;
                              }, 200);
                             setTimeout(() => setKeyboardMode(p => ({...p, deviceType: 'none'})), 200);
                           }}
                           className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 outline-none text-sm font-bold text-white text-right"
                           placeholder="اكتب أو ابحث..."
                         />
                         {activeAutocomplete?.type === 'deviceType' && (() => {
                            const currentVal = currentDevice.deviceType || '';
                            const isExact = deviceCategories.some(c => c.name === currentVal);
                            const list = (isExact && currentVal !== '') ? deviceCategories : deviceCategories.filter(cat => cat.name.toLowerCase().includes(currentVal.toLowerCase()));
                            
                            return (
                              <div className="absolute top-[calc(100%+0.25rem)] right-0 w-full bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                                {list.length > 0 ? list.map(cat => (
                                  <button
                                   key={cat.id}
                                   className="w-full text-right px-4 py-2 hover:bg-white/5 text-xs text-white"
                                   onMouseDown={(e) => {
                                     e.preventDefault();
                                     setCurrentDevice({ ...currentDevice, deviceType: cat.name, deviceName: '' });
                                     setActiveAutocomplete(null);
                                   }}
                                  >
                                     {cat.name}
                                  </button>
                                )) : (
                                  <div className="w-full text-right px-4 py-3 bg-orange-600/10 text-orange-500 font-bold text-[10px] flex items-center gap-2">
                                     <Plus size={14} /> {currentVal ? `النوع "${currentVal}" يضاف كجديد` : 'اكتب نوع جديد لاضافته...'}
                                  </div>
                                )}
                              </div>
                            );
                         })()}
                       </div>
                    </div>

                    <div className="relative flex items-center gap-3">
                       <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-20 shrink-0">اسم الجهاز</label>
                       <div className="relative flex-1">
                         <input 
                           inputMode={keyboardMode.deviceName || 'none'}
                           value={currentDevice.deviceName || ''}
                           onChange={(e) => {
                             setCurrentDevice({ ...currentDevice, deviceName: e.target.value });
                             setActiveAutocomplete({ index: 0, type: 'deviceName' });
                           }}
                           onClick={(e) => {
                             setActiveAutocomplete({ index: 0, type: 'deviceName' });
                             if (focusInitiated.current.deviceName) {
                                focusInitiated.current.deviceName = false;
                              } else if (keyboardMode.deviceName !== 'text') {
                               isRefocusing.current.deviceName = true;
                               setKeyboardMode(p => ({...p, deviceName: 'text'}));
                               const target = e.currentTarget;
                               target.blur();
                               setTimeout(() => {
                                 target.focus();
                                 isRefocusing.current.deviceName = false;
                               }, 50);
                             }
                           }}
                           onFocus={(e) => {
                              setActiveAutocomplete({ index: 0, type: 'deviceName' });
                              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              focusInitiated.current.deviceName = true;
                            }}
                           onBlur={() => {
                             if (isRefocusing.current.deviceName) return;
                             setTimeout(() => {
                                setActiveAutocomplete(prev => prev?.type === 'deviceName' ? null : prev);
                                focusInitiated.current.deviceName = false;
                              }, 200);
                             setTimeout(() => setKeyboardMode(p => ({...p, deviceName: 'none'})), 200);
                           }}
                           className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 outline-none text-sm text-white text-right"
                           placeholder="ابحث او اكتب..."
                         />
                         {activeAutocomplete?.type === 'deviceName' && (() => {
                            const currentVal = currentDevice.deviceName || '';
                            const availableModels = currentDevice.deviceType ? deviceModels.filter(m => m.categoryName === currentDevice.deviceType || m.categoryId === currentDevice.deviceType.replace(/\//g, '_')) : [];
                            const isExact = availableModels.some(m => m.name === currentVal);
                            const list = (isExact && currentVal !== '') ? availableModels : availableModels.filter(m => m.name.toLowerCase().includes(currentVal.toLowerCase()));
                            
                            return (
                              <div className="absolute top-[calc(100%+0.25rem)] right-0 w-full bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-40 overflow-y-auto">
                                {list.length > 0 ? list.map(model => (
                                  <button
                                   key={model.id}
                                   className="w-full text-right px-4 py-2 hover:bg-white/5 text-xs text-white flex flex-col"
                                   onMouseDown={(e) => {
                                     e.preventDefault();
                                     const updates: Record<string, any> = { deviceName: model.name };
                                     if(model.categoryName && !currentDevice.deviceType) updates.deviceType = model.categoryName;
                                     setCurrentDevice({ ...currentDevice, ...updates });
                                     setActiveAutocomplete(null);
                                   }}
                                  >
                                     <span>{model.name}</span>
                                     {!currentDevice.deviceType && <span className="text-[10px] text-orange-500">{model.categoryName}</span>}
                                  </button>
                                )) : (
                                  <div className="w-full text-right px-4 py-3 bg-orange-600/10 text-orange-500 font-bold text-[10px] flex items-center gap-2">
                                     <Plus size={14} /> {currentVal && currentDevice.deviceType ? `الموديل "${currentVal}" يضاف كجديد` : !currentDevice.deviceType ? 'يرجى اختيار نوع الجهاز أولاً...' : 'اكتب اسم جهاز جديد لاضافته...'}
                                  </div>
                                )}
                              </div>
                            );
                         })()}
                       </div>
                    </div>

                    <div className="flex items-center gap-3">
                       <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-16 shrink-0 lg:w-16">العدد</label>
                       <input 
                         type="text"
                         inputMode="numeric"
                         pattern="[0-9]*"
                         dir="ltr"
                         lang="en"
                         onFocus={(e) => e.target.select()}
                         value={Number.isNaN(Number(currentDevice.quantity)) ? '' : currentDevice.quantity}
                         onChange={(e) => {
                           const val = e.target.value.replace(/[^0-9]/g, '');
                           setCurrentDevice({...currentDevice, quantity: val === '' ? '' : Math.max(1, parseInt(val)) });
                         }}
                         className="w-full bg-black border border-white/10 rounded-xl px-2 py-2 focus:border-orange-500 outline-none text-center font-mono font-black text-white text-sm flex-1"
                       />
                    </div>

                    <div className="flex items-center gap-3 lg:col-span-2">
                       <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-20 shrink-0">شكوى العميل *</label>
                       <input 
                         value={currentDevice.faultType || ''}
                         onChange={(e) => setCurrentDevice({...currentDevice, faultType: e.target.value })}
                         onFocus={(e) => {
                            e.target.select();
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         }}
                         className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 outline-none text-sm text-white text-right flex-1"
                         placeholder="يحتاج صيانة..."
                       />
                    </div>

                    <div className="flex items-center gap-3 lg:col-span-3">
                       <label className="text-xs text-gray-500 uppercase font-black tracking-widest text-right w-20 shrink-0">تفاصيل</label>
                       <input 
                         value={currentDevice.deviceNotes || ''}
                         onChange={(e) => setCurrentDevice({...currentDevice, deviceNotes: e.target.value })}
                         onFocus={(e) => {
                            e.target.select();
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         }}
                         className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 focus:border-orange-500 outline-none text-sm text-white text-right flex-1"
                         placeholder="مثال: ريموت كنترول، كابل طاقة، خدوش في الشاشة"
                       />
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-row justify-end gap-3 mt-2 border-t border-white/5 pt-3">
                       <button
                         onClick={() => {
                           setCurrentDevice(initialDeviceState);
                           setEditingIndex(null);
                         }}
                         className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-colors"
                       >
                         إلغاء / تفريغ
                       </button>
                       <button
                         onClick={handlePreAddDeviceToTable}
                         disabled={!currentDevice.deviceType?.trim() || !currentDevice.deviceName?.trim() || !currentDevice.faultType?.trim() || !currentDevice.quantity || currentDevice.quantity < 1}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${(!currentDevice.deviceType?.trim() || !currentDevice.deviceName?.trim() || !currentDevice.faultType?.trim() || !currentDevice.quantity || currentDevice.quantity < 1) ? 'bg-orange-600/30 text-white/50 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20'}`}
                       >
                         {editingIndex !== null ? 'تعديل' : 'إضافة الجهاز'}
                         {editingIndex !== null ? undefined : <Plus size={14}/>}
                       </button>
                    </div>
                 </div>

                 {/* Temporary Table (Items List) */}
                 {items.length > 0 && (
                   <div className="mt-6 border border-white/10 rounded-2xl overflow-hidden">
                     <div className="bg-orange-600/10 px-4 py-3 text-sm font-bold text-orange-500 border-b border-white/5">الأجهزة المضافة للجدول ({items.length})</div>
                     <div className="w-full overflow-x-auto">
                        <table className="w-full text-right text-white" dir="rtl">
                          <thead className="bg-black/40 border-b border-white/10">
                            <tr>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 w-12 text-center">#</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 w-48">نوع الجهاز</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 w-48">اسم الجهاز</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 w-20 text-center">العدد</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 min-w-[200px]">المشكلة من وجهة نظر العميل</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 min-w-[200px]">ملاحظات</th>
                              <th className="py-3 px-4 text-[10px] uppercase tracking-widest text-gray-500 w-24 text-center">اجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {items.map((item, index) => (
                              <tr key={index} className="hover:bg-white/5 transition-colors group bg-black/20">
                                <td className="py-3 px-4 text-sm font-black text-gray-600 text-center">{index + 1}</td>
                                <td className="py-3 px-4 text-sm font-bold text-white whitespace-nowrap"><div className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 inline-block">{item.deviceType || '-'}</div></td>
                                <td className="py-3 px-4 text-sm text-gray-300 whitespace-nowrap"><div className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 inline-block">{item.deviceName || '-'}</div></td>
                                <td className="py-3 px-4 text-sm font-mono text-white text-center font-bold"><div className="px-2 py-1 bg-white/5 rounded-lg border border-white/5 inline-block w-full">{item.quantity}</div></td>
                                <td className="py-3 px-4 text-sm text-gray-300 max-w-[200px] whitespace-nowrap"><div className="truncate py-1 inline-block w-full" title={item.faultType}>{item.faultType || '-'}</div></td>
                                <td className="py-3 px-4 text-sm text-gray-400 max-w-[200px] whitespace-nowrap"><div className="truncate py-1 inline-block w-full" title={item.deviceNotes}>{item.deviceNotes || '-'}</div></td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => editItem(index)}
                                      className={`p-2 rounded-xl transition-all ${editingIndex === index ? 'bg-orange-500 text-white' : 'bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white'}`}
                                      title="تعديل هذا الجهاز"
                                    >
                                      <span className="text-xs font-bold">تعديل</span>
                                    </button>
                                    <button 
                                      onClick={() => removeItem(index)}
                                      className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                                      title="حذف هذا الجهاز"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                   </div>
                 )}
              </div>

               {/* Action Bar */}
               <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3" dir="rtl">
                   <div className="flex items-center gap-3">
                      <div className="bg-white/5 text-gray-400 font-bold px-3 py-2 rounded-xl text-xs font-mono border border-white/10 shrink-0">
                        {Array.from(new Set(items.map(i => i.deviceType).filter(Boolean))).length} نوع
                      </div>
                      <div className="bg-white/5 text-gray-400 font-bold px-3 py-2 rounded-xl text-xs font-mono border border-white/10 shrink-0">
                        {items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} جهاز
                      </div>
                      <button 
                        onClick={handlePreviewInit}
                        disabled={!canSave || loading || items.length === 0}
                        className="px-8 py-3 rounded-xl font-black text-sm bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Save size={16} />
                        <span>عرض الفاتورة للمراجعة</span>
                      </button>
                   </div>
               </div>
          </section>
        </div>

      </div>
    </div>
    </div>
  );
}
