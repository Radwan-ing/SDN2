import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from '../firebase';
import { Trash2, UserPlus, Search, User } from 'lucide-react';

export default function EngineersTable() {
  const [engineers, setEngineers] = useState<{ id: string; name: string; updatedAt?: any }[]>([]);
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'engineers'), (snapshot) => {
      setEngineers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return () => unsubscribe();
  }, []);

  const addEngineer = async () => {
    if (!newName.trim()) return;
    const id = newName.trim().replace(/\//g, '_');
    await setDoc(doc(db, 'engineers', id), {
      name: newName.trim(),
      updatedAt: serverTimestamp()
    });
    setNewName('');
  };

  const deleteEngineer = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المهندس؟')) {
      await deleteDoc(doc(db, 'engineers', id));
    }
  };

  const filtered = engineers.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 rtl:text-right">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEngineer()}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-orange-500 text-sm"
            placeholder="اسم المهندس الجديد..."
          />
        </div>
        <button 
          onClick={addEngineer}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold transition-all text-sm shadow-lg whitespace-nowrap"
        >
          إضافة مهندس
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 outline-none text-xs"
          placeholder="بحث في المهندسين..."
        />
      </div>

      <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-gray-500 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
              <th className="px-6 py-4 text-right">الاسم</th>
              <th className="px-6 py-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((eng) => (
              <tr key={eng.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 text-orange-500 rounded-lg">
                      <User size={14} />
                    </div>
                    <span className="font-bold text-white">{eng.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 flex justify-center">
                  <button 
                    onClick={() => deleteEngineer(eng.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-6 py-12 text-center text-gray-500">
                  لا يوجد مهندسين مسجلين حالياً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
