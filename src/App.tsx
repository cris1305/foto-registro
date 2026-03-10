import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  User, 
  LogIn, 
  LogOut, 
  Shield, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ChevronLeft,
  Search,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
interface UserData {
  id: number;
  nombre: string;
  cedula: string;
  puesto: string;
  foto_biometrica: string;
}

type Role = 'user' | 'admin' | null;

// --- Dashboard View Component ---

const DashboardView = ({ setView, ai, setSuccess, setError, success, error }: any) => {
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara automáticamente.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const identifyAndRegister = async (tipo: 'entrada' | 'salida') => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Fetch all users for comparison
      const usersRes = await fetch('/api/users');
      const users: UserData[] = await usersRes.json();
      
      if (users.length === 0) {
        throw new Error("No hay usuarios registrados en el sistema.");
      }

      // 2. Capture frame
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const capturedImage = canvasRef.current.toDataURL('image/jpeg').split(',')[1];

      // 3. Identification with Gemini
      const prompt = `Identifica a la persona en la captura en vivo comparándola con la lista de usuarios registrados. 
      Responde solo con un objeto JSON: { "match": boolean, "cedula": string | null, "confidence": number }. 
      Si encuentras una coincidencia clara (>0.8), proporciona su cédula.`;
      
      const userParts = users.map(u => ({
        inlineData: { mimeType: "image/jpeg", data: u.foto_biometrica.split(',')[1] || u.foto_biometrica },
      }));

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              ...userParts.map((p, i) => ({ text: `Usuario ${i} (Cédula: ${users[i].cedula}):` })),
              ...userParts,
              { text: "Captura en vivo:" },
              { inlineData: { mimeType: "image/jpeg", data: capturedImage } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const identification = JSON.parse(result.text);

      if (identification.match && identification.confidence > 0.8 && identification.cedula) {
        // 4. Register action
        const regRes = await fetch('/api/register-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cedula: identification.cedula, tipo })
        });
        
        const regData = await regRes.json();
        if (regRes.ok) {
          setSuccess(`¡${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada para ${regData.user.nombre}!`);
          setTimeout(() => setSuccess(null), 5000);
        } else {
          setError(regData.error);
        }
      } else {
        setError("No se pudo identificar a la persona. Asegúrese de estar registrado.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <header className="p-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BioCheck Live</h1>
        </div>
        <Button variant="outline" onClick={() => setView('login')} className="rounded-full px-8">
          Cerrar Sesión
        </Button>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="relative aspect-[4/5] bg-zinc-900 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-90" />
          
          {/* Scanning Effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-72 h-96 border-2 border-white/20 rounded-[4rem] relative">
                <motion.div 
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-[2px] bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]"
                />
              </div>
            </div>
            <div className="absolute top-8 left-8">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 backdrop-blur-md rounded-full border border-emerald-500/30">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Biometric Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-12">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold tracking-tighter leading-none">Identificación en Tiempo Real</h2>
            <p className="text-zinc-400 text-lg font-medium max-w-md">
              Posicione su rostro frente al escáner y seleccione la acción correspondiente.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white rounded-[3rem] shadow-sm border border-zinc-100">
            <Button 
              className="flex-1 py-8 text-xl rounded-[2.2rem] bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              disabled={loading}
              onClick={() => identifyAndRegister('entrada')}
            >
              {loading ? <Loader2 className="animate-spin" /> : <div className="flex items-center gap-3"><LogIn size={28} /> Registrar Entrada</div>}
            </Button>
            
            <Button 
              className="flex-1 py-8 text-xl rounded-[2.2rem] bg-zinc-900 hover:bg-black shadow-lg shadow-black/20 transition-all active:scale-95"
              disabled={loading}
              onClick={() => identifyAndRegister('salida')}
            >
              {loading ? <Loader2 className="animate-spin" /> : <div className="flex items-center gap-3"><LogOut size={28} /> Registrar Salida</div>}
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-600"
              >
                <XCircle size={28} />
                <p className="font-bold uppercase tracking-tight text-sm">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4 text-emerald-600"
              >
                <CheckCircle2 size={28} />
                <p className="font-bold uppercase tracking-tight text-sm">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// --- Main App Component ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: any) => {
  const variants: any = {
    primary: 'bg-black text-white hover:bg-zinc-800 shadow-lg shadow-black/10',
    secondary: 'bg-white text-black border border-zinc-200 hover:bg-zinc-50 shadow-sm',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    outline: 'border border-zinc-200 text-zinc-500 hover:text-black hover:bg-zinc-50'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`neo-button px-6 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="space-y-2 w-full">
    {label && <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] ml-1">{label}</label>}
    <input
      {...props}
      className="w-full px-5 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-black/5 focus:border-black transition-all placeholder:text-zinc-300"
    />
  </div>
);

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'admin'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Admin View State
  const [users, setUsers] = useState<UserData[]>([]);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ nombre: '', cedula: '', puesto: '', foto_biometrica: '' });
  const [isAdminCameraActive, setIsAdminCameraActive] = useState(false);
  const adminVideoRef = useRef<HTMLVideoElement>(null);
  const adminCanvasRef = useRef<HTMLCanvasElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (role === 'admin') {
      fetchUsers();
    }
  }, [role]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setRole(data.role);
        setView(data.role === 'admin' ? 'admin' : 'dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };



  const startAdminCamera = async () => {
    setIsAdminCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (adminVideoRef.current) {
        adminVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("No se pudo acceder a la cámara del administrador.");
      setIsAdminCameraActive(false);
    }
  };

  const stopAdminCamera = () => {
    if (adminVideoRef.current && adminVideoRef.current.srcObject) {
      const stream = adminVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      adminVideoRef.current.srcObject = null;
    }
    setIsAdminCameraActive(false);
  };

  const captureAdminPhoto = () => {
    if (!adminVideoRef.current || !adminCanvasRef.current) return;
    const context = adminCanvasRef.current.getContext('2d');
    adminCanvasRef.current.width = adminVideoRef.current.videoWidth;
    adminCanvasRef.current.height = adminVideoRef.current.videoHeight;
    context?.drawImage(adminVideoRef.current, 0, 0);
    const capturedImage = adminCanvasRef.current.toDataURL('image/jpeg');
    
    if (isAddingUser) {
      setNewUser({ ...newUser, foto_biometrica: capturedImage });
    } else if (editingUser) {
      setEditingUser({ ...editingUser, foto_biometrica: capturedImage });
    }
    stopAdminCamera();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setIsAddingUser(false);
        setNewUser({ nombre: '', cedula: '', puesto: '', foto_biometrica: '' });
        stopAdminCamera();
        fetchUsers();
      }
    } catch (err) {
      setError("Error al guardar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      });
      if (res.ok) {
        setEditingUser(null);
        stopAdminCamera();
        fetchUsers();
      }
    } catch (err) {
      setError("Error al actualizar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (err) {
      setError("Error al eliminar");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Renderers ---

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px] space-y-10"
        >
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-black rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-black/20">
              <Shield className="text-white w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight">BioCheck</h1>
              <p className="text-zinc-400 font-medium">Security & Access Control</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border border-zinc-100">
            <div className="space-y-4">
              <Input 
                label="Usuario" 
                placeholder="admin o user" 
                value={username}
                onChange={(e: any) => setUsername(e.target.value)}
                required
              />
              <Input 
                label="Contraseña" 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-red-500 text-xs font-bold uppercase tracking-wider text-center"
              >
                {error}
              </motion.p>
            )}
            <Button type="submit" className="w-full py-4 text-lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Acceder'}
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <DashboardView 
        setView={setView} 
        ai={ai} 
        setSuccess={setSuccess} 
        setError={setError} 
        success={success} 
        error={error} 
      />
    );
  }

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <nav className="bg-white/80 backdrop-blur-md border-b border-zinc-100 px-8 py-5 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                <Shield className="text-white w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold tracking-tight">BioCheck Admin</h1>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">System Control</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-8 w-[1px] bg-zinc-100" />
              <Button variant="outline" onClick={() => setView('login')} className="rounded-full px-8 text-xs font-bold uppercase tracking-widest">
                Logout
              </Button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-8 md:p-12 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-4xl font-bold tracking-tight">Directorio</h2>
              <p className="text-zinc-400 font-medium">Gestión de personal y perfiles biométricos</p>
            </div>
            <Button onClick={() => setIsAddingUser(true)} className="rounded-full px-10 py-4 shadow-xl shadow-black/10">
              <UserPlus size={20} /> Registrar Nuevo
            </Button>
          </div>

          <div className="bg-white rounded-[3rem] border border-zinc-100 overflow-hidden shadow-2xl shadow-black/[0.02]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-10 py-6 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Personal</th>
                    <th className="px-10 py-6 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Identificación</th>
                    <th className="px-10 py-6 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Cargo</th>
                    <th className="px-10 py-6 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {users.map(user => (
                    <tr key={user.id} className="group hover:bg-zinc-50/50 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <img 
                              src={user.foto_biometrica || 'https://picsum.photos/seed/user/100/100'} 
                              alt={user.nombre}
                              className="w-14 h-14 rounded-2xl object-cover bg-zinc-100 shadow-md border-2 border-white"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Biometric Profile Active" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-zinc-900 block">{user.nombre}</span>
                            <span className="text-xs text-zinc-400 font-medium">ID: #{user.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="font-mono text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-lg">
                          {user.cedula}
                        </span>
                      </td>
                      <td className="px-10 py-6">
                        <span className="px-4 py-1.5 bg-zinc-50 border border-zinc-100 rounded-full text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                          {user.puesto}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingUser(user)}
                            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-white hover:shadow-md rounded-xl transition-all border border-transparent hover:border-zinc-100"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-10 py-24 text-center">
                        <div className="space-y-4 text-zinc-300">
                          <Search size={48} className="mx-auto opacity-20" />
                          <p className="text-sm font-medium">No se encontraron registros en la base de datos.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Modals */}
        <AnimatePresence>
          {(isAddingUser || editingUser) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] overflow-hidden border border-white/20"
              >
                <div className="p-10 border-b border-zinc-50 flex justify-between items-center bg-zinc-50/50">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold tracking-tight">{isAddingUser ? 'Nuevo Perfil' : 'Editar Perfil'}</h3>
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Biometric Data Entry</p>
                  </div>
                  <button onClick={() => { setIsAddingUser(false); setEditingUser(null); stopAdminCamera(); }} className="w-12 h-12 flex items-center justify-center hover:bg-white rounded-2xl transition-all shadow-sm border border-zinc-100">
                    <XCircle className="text-zinc-400" size={24} />
                  </button>
                </div>
                
                <form onSubmit={isAddingUser ? handleAddUser : handleUpdateUser} className="p-10 space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <Input 
                      label="Nombre" 
                      placeholder="Ej. Juan Pérez"
                      value={isAddingUser ? newUser.nombre : editingUser?.nombre}
                      onChange={(e: any) => isAddingUser ? setNewUser({...newUser, nombre: e.target.value}) : setEditingUser({...editingUser!, nombre: e.target.value})}
                      required
                    />
                    <Input 
                      label="Cédula" 
                      placeholder="Ej. 1-2345-6789"
                      value={isAddingUser ? newUser.cedula : editingUser?.cedula}
                      onChange={(e: any) => isAddingUser ? setNewUser({...newUser, cedula: e.target.value}) : setEditingUser({...editingUser!, cedula: e.target.value})}
                      required
                    />
                  </div>
                  <Input 
                    label="Puesto" 
                    placeholder="Ej. Desarrollador Senior"
                    value={isAddingUser ? newUser.puesto : editingUser?.puesto}
                    onChange={(e: any) => isAddingUser ? setNewUser({...newUser, puesto: e.target.value}) : setEditingUser({...editingUser!, puesto: e.target.value})}
                    required
                  />
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Referencia Biométrica</label>
                    
                    <div className="bg-zinc-50 rounded-[2.5rem] p-8 border border-zinc-100 space-y-6">
                      <div className="flex justify-center">
                        <div className="relative w-48 h-48 bg-white rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl group">
                          {isAdminCameraActive ? (
                            <div className="w-full h-full relative">
                              <video 
                                ref={adminVideoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-[2.2rem] pointer-events-none" />
                            </div>
                          ) : (isAddingUser ? newUser.foto_biometrica : editingUser?.foto_biometrica) ? (
                            <img 
                              src={isAddingUser ? newUser.foto_biometrica : editingUser?.foto_biometrica} 
                              className="w-full h-full object-cover" 
                              alt="Preview"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-200">
                              <Camera size={64} strokeWidth={1} />
                            </div>
                          )}
                          
                          {isAdminCameraActive && (
                            <button
                              type="button"
                              onClick={captureAdminPhoto}
                              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all active:scale-90 z-10"
                            >
                              <Camera size={24} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-center gap-3">
                        {!isAdminCameraActive ? (
                          <button
                            type="button"
                            onClick={startAdminCamera}
                            className="px-6 py-3 bg-black text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-2"
                          >
                            <Camera size={16} /> Tomar Foto
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopAdminCamera}
                            className="px-6 py-3 bg-zinc-200 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-300 transition-all"
                          >
                            Cancelar Cámara
                          </button>
                        )}
                        
                        <input 
                          type="file" 
                          id="file-upload"
                          accept="image/*" 
                          className="hidden"
                          onChange={(e) => handleFileChange(e, (base64) => {
                            isAddingUser ? setNewUser({...newUser, foto_biometrica: base64}) : setEditingUser({...editingUser!, foto_biometrica: base64});
                          })}
                        />
                        <label htmlFor="file-upload" className="px-6 py-3 bg-white border border-zinc-200 text-zinc-600 rounded-full text-xs font-bold uppercase tracking-widest cursor-pointer hover:bg-zinc-50 transition-all shadow-sm flex items-center gap-2">
                          <Plus size={16} /> Subir Archivo
                        </label>
                      </div>
                      
                      <p className="text-center text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                        Capture o suba una foto frontal clara para el reconocimiento facial
                      </p>
                    </div>
                  </div>
                  <canvas ref={adminCanvasRef} className="hidden" />

                  <div className="pt-6 flex gap-4">
                    <Button variant="outline" className="flex-1 py-4 rounded-2xl" onClick={() => { setIsAddingUser(false); setEditingUser(null); stopAdminCamera(); }}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="flex-1 py-4 rounded-2xl" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin" /> : 'Guardar Perfil'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}
