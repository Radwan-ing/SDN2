import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from '../firebase';
import { Trash2, Plus, Search, Tag, Edit, Smartphone, LayoutGrid } from 'lucide-react';

export default function CategoriesTable() {
  const [activeTab, setActiveTab] = useState<'categories' | 'models'>('categories');
  
  // Categories State
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [catNameInput, setCatNameInput] = useState('');
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Models State
  const [models, setModels] = useState<{ id: string; name: string; categoryId: string; categoryName: string }[]>([]);
  const [selectedCatIdForModel, setSelectedCatIdForModel] = useState<string>('');
  const [modelNameInput, setModelNameInput] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'device_categories'), (snapshot) => {
      const cats = snapshot.docs.map(d => ({ id: d.id, name: d.data().name } as any));
      setCategories(cats);
      if (cats.length > 0 && !selectedCatIdForModel) {
        setSelectedCatIdForModel(cats[0].id);
      }
    });

    const unsubMod = onSnapshot(collection(db, 'device_models'), (snapshot) => {
      setModels(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    return () => {
      unsubCat();
      unsubMod();
    };
  }, []);

  // --- Category Handlers ---
  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) return;
    const newId = catNameInput.trim().replace(/\//g, '_');
    
    if (editingCatId) {
      if (editingCatId !== newId) {
        // Delete old and create new to reflect the ID change
        await deleteDoc(doc(db, 'device_categories', editingCatId));
      }
      await setDoc(doc(db, 'device_categories', newId), {
        name: catNameInput.trim(),
        createdAt: serverTimestamp()
      });
      setEditingCatId(null);
    } else {
      await setDoc(doc(db, 'device_categories', newId), {
        name: catNameInput.trim(),
        createdAt: serverTimestamp()
      });
    }
    setCatNameInput('');
  };

  const deleteCategory = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا النوع؟ جميع الأجهزة المرتبطة به قد تتأثر.')) {
      await deleteDoc(doc(db, 'device_categories', id));
      if (selectedCatIdForModel === id) {
        setSelectedCatIdForModel('');
      }
    }
  };

  const editCategory = (cat: {id: string, name: string}) => {
    setEditingCatId(cat.id);
    setCatNameInput(cat.name);
  };

  // --- Model Handlers ---
  const handleSaveModel = async () => {
    if (!modelNameInput.trim() || !selectedCatIdForModel) return;
    
    const cat = categories.find(c => c.id === selectedCatIdForModel);
    if (!cat) return;

    const newModelId = `${selectedCatIdForModel}_${modelNameInput.trim().replace(/\//g, '_')}`;

    if (editingModelId) {
      if (editingModelId !== newModelId) {
        await deleteDoc(doc(db, 'device_models', editingModelId));
      }
      await setDoc(doc(db, 'device_models', newModelId), {
        name: modelNameInput.trim(),
        categoryId: selectedCatIdForModel,
        categoryName: cat.name,
        createdAt: serverTimestamp()
      });
      setEditingModelId(null);
    } else {
      await setDoc(doc(db, 'device_models', newModelId), {
        name: modelNameInput.trim(),
        categoryId: selectedCatIdForModel,
        categoryName: cat.name,
        createdAt: serverTimestamp()
      });
    }
    setModelNameInput('');
  };

  const deleteModel = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الجهاز؟')) {
      await deleteDoc(doc(db, 'device_models', id));
    }
  };

  const editModel = (model: {id: string, name: string, categoryId: string}) => {
    setEditingModelId(model.id);
    setModelNameInput(model.name);
    setSelectedCatIdForModel(model.categoryId);
  };


  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(catSearchTerm.toLowerCase()));
  const filteredModels = models.filter(m => m.categoryId === selectedCatIdForModel);

  return (
    <div className="space-y-6 rtl:text-right">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/5 pb-2">
        <button 
          onClick={() => { setActiveTab('categories'); }}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'categories' ? 'border-b-2 border-orange-500 text-orange-500 bg-white/5' : 'text-gray-400 hover:text-white'}`}
        >
          <LayoutGrid size={16} />
          إدارة أنواع الأجهزة
        </button>
        <button 
          onClick={() => { setActiveTab('models'); }}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'models' ? 'border-b-2 border-orange-500 text-orange-500 bg-white/5' : 'text-gray-400 hover:text-white'}`}
        >
          <Smartphone size={16} />
          إدارة الأجهزة
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              {editingCatId ? <Edit className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={18} /> : <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />}
              <input 
                type="text" 
                value={catNameInput}
                onChange={(e) => setCatNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-orange-500 text-sm"
                placeholder="اسم النوع الجديد..."
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleSaveCategory}
                className={`${editingCatId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-6 py-3 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap`}
              >
                {editingCatId ? 'تعديل النوع' : 'إضافة نوع'}
              </button>
              {editingCatId && (
                <button 
                  onClick={() => { setEditingCatId(null); setCatNameInput(''); }}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              value={catSearchTerm}
              onChange={(e) => setCatSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 outline-none text-xs text-white"
              placeholder="بحث في أنواع الأجهزة..."
            />
          </div>

          <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                  <th className="px-6 py-4 text-right leading-loose">نوع الجهاز</th>
                  <th className="px-6 py-4 text-center leading-loose">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                          <Tag size={14} />
                        </div>
                        <span className="font-bold whitespace-nowrap">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 flex justify-center gap-2">
                      <button 
                        onClick={() => editCategory(cat)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white rounded-lg transition-all"
                        title="تعديل"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => deleteCategory(cat.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                      لا توجد أنواع مسجلة حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'models' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-1/3">
               <select 
                 value={selectedCatIdForModel}
                 onChange={(e) => setSelectedCatIdForModel(e.target.value)}
                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500 text-sm font-bold text-white"
               >
                 <option value="" disabled> -- اختر النوع أولاً -- </option>
                 {categories.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
            </div>
            <div className="flex-1 relative">
              {editingModelId ? <Edit className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500" size={18} /> : <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />}
              <input 
                type="text" 
                value={modelNameInput}
                onChange={(e) => setModelNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveModel()}
                disabled={!selectedCatIdForModel}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-orange-500 text-sm disabled:opacity-50"
                placeholder="اسم الجهاز الجديد (الموديل)..."
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleSaveModel}
                disabled={!selectedCatIdForModel}
                className={`${editingModelId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap disabled:opacity-50`}
              >
                {editingModelId ? 'تعديل الجهاز' : 'إضافة جهاز'}
              </button>
              {editingModelId && (
                <button 
                  onClick={() => { setEditingModelId(null); setModelNameInput(''); }}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </div>

          <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                  <th className="px-6 py-4 text-right leading-loose">اسم الجهاز / الموديل</th>
                  <th className="px-6 py-4 text-center leading-loose">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {!selectedCatIdForModel ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                      يرجى اختيار النوع لعرض الأجهزة المرتبطة به.
                    </td>
                  </tr>
                ) : filteredModels.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-orange-500/80">
                      لا توجد أجهزة مضافة تحت هذا النوع حتى الآن.
                    </td>
                  </tr>
                ) : (
                  filteredModels.map((model) => (
                    <tr key={model.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                            <Smartphone size={14} />
                          </div>
                          <span className="font-bold whitespace-nowrap">{model.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 flex justify-center gap-2">
                        <button 
                          onClick={() => editModel(model)}
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all"
                          title="تعديل"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => deleteModel(model.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

