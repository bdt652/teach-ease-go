import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Shield, UserPlus, Trash2, Loader2, Plus, Upload, FileSpreadsheet, AlertCircle, Check, X, Settings, Save, Key, RefreshCw, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'teacher' | 'student';

interface FeedbackConfig {
  id: string;
  config_key: string;
  config_value: string;
  description: string | null;
}

interface ApiKey {
  id: string;
  provider: string;
  api_key: string;
  name: string | null;
  is_active: boolean;
  is_limited: boolean;
  limited_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface UserActionLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: any;
  page: string | null;
  user_agent: string | null;
  ip_address: string | null;
  session_id: string | null;
  environment: string;
  timestamp: string;
}

interface ImportUser {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading, hasRole } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('student');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Create user form
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole | ''>('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Import users
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importUsers, setImportUsers] = useState<ImportUser[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feedback config
  const [feedbackConfigs, setFeedbackConfigs] = useState<FeedbackConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<FeedbackConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKeyValue, setNewApiKeyValue] = useState('');
  const [isAddingApiKey, setIsAddingApiKey] = useState(false);
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);

  // Password change
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // User Action Logs
  const [userActionLogs, setUserActionLogs] = useState<UserActionLog[]>([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsActionFilter, setLogsActionFilter] = useState('all');
  const [logsDateFilter, setLogsDateFilter] = useState('all');

  const isAdmin = hasRole('admin');
  const isTeacher = hasRole('teacher');
  const canAccess = isAdmin || isTeacher;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && user && !canAccess) {
      toast.error('Bạn không có quyền truy cập trang này');
      navigate('/dashboard');
    }
  }, [user, loading, canAccess, navigate]);

  const fetchData = async () => {
    const [profilesRes, rolesRes, configsRes, apiKeysRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*'),
      supabase.from('feedback_config').select('*').order('config_key'),
      isAdmin ? supabase.from('api_keys').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('user_action_logs').select('*').order('timestamp', { ascending: false }).limit(1000) : Promise.resolve({ data: [] })
    ]);

    if (profilesRes.data) {
      setProfiles(profilesRes.data);
    }
    if (rolesRes.data) {
      setUserRoles(rolesRes.data as UserRole[]);
    }
    if (configsRes.data) {
      setFeedbackConfigs(configsRes.data as FeedbackConfig[]);
    }
    if (apiKeysRes.data) {
      setApiKeys(apiKeysRes.data as ApiKey[]);
    }
    if (logsRes.data) {
      setUserActionLogs(logsRes.data as UserActionLog[]);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (canAccess) {
      fetchData();
    }
  }, [canAccess, isAdmin]);

  const getUserRoles = (userId: string): AppRole[] => {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const handleAddRole = async () => {
    if (!selectedUser || !isAdmin) return;

    setIsAddingRole(true);

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUser.user_id,
        role: selectedRole
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User đã có role này rồi');
      } else {
        toast.error('Không thể thêm role: ' + error.message);
      }
    } else {
      toast.success(`Đã thêm role ${selectedRole} cho ${selectedUser.full_name || 'user'}`);
      fetchData();
      setIsDialogOpen(false);
    }

    setIsAddingRole(false);
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (!isAdmin) {
      toast.error('Chỉ admin mới có thể xóa role');
      return;
    }
    if (!confirm(`Xác nhận xóa role ${role}?`)) return;

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);

    if (error) {
      toast.error('Không thể xóa role: ' + error.message);
    } else {
      toast.success('Đã xóa role');
      fetchData();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserEmail || !newUserPassword) {
      toast.error('Vui lòng nhập email và mật khẩu');
      return;
    }

    if (newUserPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    // Teachers can only create students
    if (!isAdmin && isTeacher && newUserRole && newUserRole !== 'student') {
      toast.error('Giáo viên chỉ có thể tạo tài khoản học sinh');
      return;
    }

    setIsCreatingUser(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserFullName,
          role: newUserRole || undefined
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Đã tạo tài khoản cho ${newUserEmail}`);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setNewUserRole('');
      setIsCreateUserOpen(false);
      
      // Refresh data
      setTimeout(() => fetchData(), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo tài khoản');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast.error('File CSV không hợp lệ');
      return;
    }

    // Skip header row
    const users: ImportUser[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length >= 2) {
        const email = cols[0];
        const password = cols[1];
        const fullName = cols[2] || '';
        let role: AppRole = 'student';
        
        if (cols[3]) {
          const r = cols[3].toLowerCase();
          if (r === 'admin' && isAdmin) role = 'admin';
          else if (r === 'teacher' && isAdmin) role = 'teacher';
          else role = 'student';
        }

        // Validate email
        if (email && email.includes('@') && password && password.length >= 6) {
          users.push({ email, password, fullName, role, status: 'pending' });
        }
      }
    }

    if (users.length === 0) {
      toast.error('Không tìm thấy user hợp lệ trong file');
      return;
    }

    setImportUsers(users);
  };

  const handleImport = async () => {
    if (importUsers.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    const updatedUsers = [...importUsers];
    let successCount = 0;

    for (let i = 0; i < updatedUsers.length; i++) {
      const u = updatedUsers[i];
      try {
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: u.email,
            password: u.password,
            fullName: u.fullName,
            role: u.role
          }
        });

        if (error || data?.error) {
          updatedUsers[i] = { ...u, status: 'error', error: data?.error || error?.message };
        } else {
          updatedUsers[i] = { ...u, status: 'success' };
          successCount++;
        }
      } catch (err) {
        updatedUsers[i] = { ...u, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
      }

      setImportUsers([...updatedUsers]);
      setImportProgress(Math.round(((i + 1) / updatedUsers.length) * 100));
    }

    setIsImporting(false);
    toast.success(`Đã import ${successCount}/${updatedUsers.length} tài khoản`);
    
    setTimeout(() => fetchData(), 1000);
  };

  const resetImport = () => {
    setImportUsers([]);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveConfig = async (config: FeedbackConfig) => {
    setIsSavingConfig(true);
    const { error } = await supabase
      .from('feedback_config')
      .update({ config_value: config.config_value })
      .eq('id', config.id);

    if (error) {
      toast.error('Không thể lưu cấu hình: ' + error.message);
    } else {
      toast.success('Đã lưu cấu hình');
      setEditingConfig(null);
      fetchData();
    }
    setIsSavingConfig(false);
  };

  const getConfigLabel = (key: string) => {
    const labels: Record<string, string> = {
      class_name: 'Tên lớp học',
      age_range: 'Độ tuổi học sinh',
      teacher_pronoun: 'Xưng hô giáo viên',
      student_pronoun: 'Gọi học sinh',
      batch_prompt: 'Prompt nhận xét hàng loạt',
      individual_prompt: 'Prompt nhận xét từng học sinh',
    };
    return labels[key] || key;
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'teacher': return 'default';
      case 'student': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'teacher': return 'Giáo viên';
      case 'student': return 'Học sinh';
      default: return role;
    }
  };

  // API Key management
  const handleAddApiKey = async () => {
    if (!newApiKeyValue.trim()) {
      toast.error('Vui lòng nhập API key');
      return;
    }

    setIsAddingApiKey(true);
    const { error } = await supabase
      .from('api_keys')
      .insert({
        provider: 'gemini',
        api_key: newApiKeyValue.trim(),
        name: newApiKeyName.trim() || null,
      });

    if (error) {
      toast.error('Không thể thêm API key: ' + error.message);
    } else {
      toast.success('Đã thêm API key');
      setNewApiKeyName('');
      setNewApiKeyValue('');
      setIsApiKeyDialogOpen(false);
      fetchData();
    }
    setIsAddingApiKey(false);
  };

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast.error('Không thể cập nhật: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleResetApiKeyLimit = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_limited: false, limited_at: null })
      .eq('id', id);

    if (error) {
      toast.error('Không thể reset: ' + error.message);
    } else {
      toast.success('Đã reset trạng thái limit');
      fetchData();
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Xác nhận xóa API key này?')) return;

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Không thể xóa: ' + error.message);
    } else {
      toast.success('Đã xóa API key');
      fetchData();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserForPassword) return;

    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsChangingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('update-user-password', {
        body: {
          userId: selectedUserForPassword.user_id,
          newPassword: newPassword
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Đã thay đổi mật khẩu cho ${selectedUserForPassword.full_name || 'user'}`);
      setIsChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setSelectedUserForPassword(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể thay đổi mật khẩu');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 10) return '****';
    return key.slice(0, 6) + '...' + key.slice(-4);
  };

  if (loading || !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">
                Quản trị hệ thống
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Import Button */}
            <Dialog open={isImportOpen} onOpenChange={(open) => {
              setIsImportOpen(open);
              if (!open) resetImport();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Users từ CSV</DialogTitle>
                  <DialogDescription>
                    File CSV cần có các cột: email, password, fullName (tùy chọn), role (tùy chọn)
                    {!isAdmin && <span className="text-destructive"> - Giáo viên chỉ có thể tạo tài khoản học sinh</span>}
                  </DialogDescription>
                </DialogHeader>

                {importUsers.length === 0 ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">Chọn file CSV để import</p>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                    <div className="bg-muted p-4 rounded-lg text-sm">
                      <p className="font-medium mb-2">Định dạng CSV mẫu:</p>
                      <code className="text-xs block bg-background p-2 rounded">
                        email,password,fullName,role<br/>
                        student1@example.com,password123,Nguyen Van A,student<br/>
                        student2@example.com,password456,Tran Thi B,student
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Tìm thấy {importUsers.length} tài khoản
                      </p>
                      <Button variant="ghost" size="sm" onClick={resetImport}>
                        Chọn file khác
                      </Button>
                    </div>

                    <ScrollArea className="h-[300px] border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Họ tên</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importUsers.map((u, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">{u.email}</TableCell>
                              <TableCell>{u.fullName || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={getRoleBadgeVariant(u.role)}>
                                  {getRoleLabel(u.role)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {u.status === 'pending' && (
                                  <span className="text-muted-foreground">Chờ import</span>
                                )}
                                {u.status === 'success' && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <Check className="h-4 w-4" /> Thành công
                                  </span>
                                )}
                                {u.status === 'error' && (
                                  <span className="flex items-center gap-1 text-destructive" title={u.error}>
                                    <X className="h-4 w-4" /> Lỗi
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    {isImporting && (
                      <div className="space-y-2">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${importProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                          Đang import... {importProgress}%
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                        Đóng
                      </Button>
                      <Button 
                        onClick={handleImport} 
                        disabled={isImporting || importUsers.every(u => u.status === 'success')}
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Đang import...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Import {importUsers.filter(u => u.status === 'pending').length} tài khoản
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Create User Button */}
            <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Tạo tài khoản mới
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tạo tài khoản mới</DialogTitle>
                  <DialogDescription>
                    {isAdmin ? 'Tạo tài khoản cho giáo viên hoặc học sinh' : 'Tạo tài khoản cho học sinh'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email *</Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="email@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Mật khẩu *</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Tối thiểu 6 ký tự"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-fullname">Họ và tên</Label>
                    <Input
                      id="new-fullname"
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-role">Vai trò</Label>
                    <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole | '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn vai trò" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Học sinh</SelectItem>
                        {isAdmin && (
                          <>
                            <SelectItem value="teacher">Giáo viên</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                      Hủy
                    </Button>
                    <Button type="submit" disabled={isCreatingUser}>
                      {isCreatingUser ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Tạo tài khoản
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">Quản lý Users</TabsTrigger>
            <TabsTrigger value="feedback-config">
              <Settings className="h-4 w-4 mr-2" />
              Cấu hình AI
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="api-keys">
                  <Key className="h-4 w-4 mr-2" />
                  API Keys
                </TabsTrigger>
                <TabsTrigger value="user-logs">
                  <FileText className="h-4 w-4 mr-2" />
                  User Logs
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quản lý Users</CardTitle>
                <CardDescription>
                  {isAdmin ? 'Quản lý vai trò và mật khẩu của users trong hệ thống' : 'Xem danh sách users trong hệ thống'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có user nào trong hệ thống
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Họ tên</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Ngày tạo</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Mật khẩu</TableHead>
                        {isAdmin && <TableHead>Hành động</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => {
                        const roles = getUserRoles(profile.user_id);
                        return (
                          <TableRow key={profile.id}>
                            <TableCell className="font-medium">
                              {profile.full_name || 'Chưa cập nhật'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {profile.user_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(profile.created_at).toLocaleDateString('vi-VN')}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {roles.length === 0 ? (
                                  <span className="text-muted-foreground text-sm">Chưa có role</span>
                                ) : (
                                  roles.map((role) => (
                                    <Badge
                                      key={role}
                                      variant={getRoleBadgeVariant(role)}
                                      className={isAdmin ? 'cursor-pointer' : ''}
                                      onClick={isAdmin ? () => handleRemoveRole(profile.user_id, role) : undefined}
                                    >
                                      {getRoleLabel(role)}
                                      {isAdmin && <Trash2 className="h-3 w-3 ml-1" />}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Dialog open={isChangePasswordOpen && selectedUserForPassword?.id === profile.id} onOpenChange={(open) => {
                                setIsChangePasswordOpen(open);
                                if (open) {
                                  setSelectedUserForPassword(profile);
                                  setNewPassword('');
                                  setConfirmPassword('');
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Key className="h-4 w-4 mr-2" />
                                    Đổi
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Đổi mật khẩu cho {profile.full_name || 'user'}</DialogTitle>
                                    <DialogDescription>
                                      Nhập mật khẩu mới cho tài khoản này
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleChangePassword} className="space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="new-password">Mật khẩu mới *</Label>
                                      <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="Tối thiểu 6 ký tự"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="confirm-password">Xác nhận mật khẩu *</Label>
                                      <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="Nhập lại mật khẩu"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button type="button" variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
                                        Hủy
                                      </Button>
                                      <Button type="submit" disabled={isChangingPassword}>
                                        {isChangingPassword ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Đang đổi...
                                          </>
                                        ) : (
                                          <>
                                            <Key className="h-4 w-4 mr-2" />
                                            Đổi mật khẩu
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Dialog open={isDialogOpen && selectedUser?.id === profile.id} onOpenChange={(open) => {
                                  setIsDialogOpen(open);
                                  if (open) setSelectedUser(profile);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <UserPlus className="h-4 w-4 mr-1" />
                                      Thêm role
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Thêm role cho {profile.full_name || 'user'}</DialogTitle>
                                      <DialogDescription>
                                        Chọn vai trò muốn gán
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Chọn role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="admin">Admin</SelectItem>
                                          <SelectItem value="teacher">Giáo viên</SelectItem>
                                          <SelectItem value="student">Học sinh</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                          Hủy
                                        </Button>
                                        <Button onClick={handleAddRole} disabled={isAddingRole}>
                                          {isAddingRole ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          ) : (
                                            <UserPlus className="h-4 w-4 mr-2" />
                                          )}
                                          Thêm role
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hướng dẫn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><Badge variant="destructive">Admin</Badge> - Có toàn quyền quản lý hệ thống và tạo tất cả loại tài khoản</p>
                <p><Badge>Giáo viên</Badge> - Có thể tạo lớp, quản lý buổi học, chấm điểm và tạo tài khoản học sinh</p>
                <p><Badge variant="secondary">Học sinh</Badge> - Có thể xem buổi học và nộp bài</p>
                <p className="mt-4 font-medium">Chức năng:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Click vào badge role để xóa role đó (chỉ Admin)</li>
                  <li>Sử dụng nút "Đổi" để thay đổi mật khẩu user</li>
                  <li>Sử dụng nút "Thêm role" để gán vai trò mới</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback-config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Cấu hình AI Feedback
                </CardTitle>
                <CardDescription>
                  Tùy chỉnh prompt và thông tin lớp học cho chức năng tạo nhận xét AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : feedbackConfigs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chưa có cấu hình nào
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Short configs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {feedbackConfigs
                        .filter(c => !c.config_key.includes('prompt'))
                        .map((config) => (
                          <div key={config.id} className="space-y-2">
                            <Label htmlFor={config.config_key}>{getConfigLabel(config.config_key)}</Label>
                            <div className="flex gap-2">
                              <Input
                                id={config.config_key}
                                value={editingConfig?.id === config.id ? editingConfig.config_value : config.config_value}
                                onChange={(e) => setEditingConfig({ ...config, config_value: e.target.value })}
                                onFocus={() => setEditingConfig(config)}
                                className="flex-1"
                              />
                              {editingConfig?.id === config.id && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveConfig(editingConfig)}
                                  disabled={isSavingConfig}
                                >
                                  {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>
                            {config.description && (
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Prompt configs */}
                    <div className="space-y-6 pt-4 border-t">
                      {feedbackConfigs
                        .filter(c => c.config_key.includes('prompt'))
                        .map((config) => (
                          <div key={config.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={config.config_key}>{getConfigLabel(config.config_key)}</Label>
                              {editingConfig?.id === config.id && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveConfig(editingConfig)}
                                  disabled={isSavingConfig}
                                >
                                  {isSavingConfig ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                  )}
                                  Lưu
                                </Button>
                              )}
                            </div>
                            <Textarea
                              id={config.config_key}
                              value={editingConfig?.id === config.id ? editingConfig.config_value : config.config_value}
                              onChange={(e) => setEditingConfig({ ...config, config_value: e.target.value })}
                              onFocus={() => setEditingConfig(config)}
                              rows={12}
                              className="font-mono text-sm"
                            />
                            {config.description && (
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            )}
                          </div>
                        ))}
                    </div>

                    <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                      <p className="font-medium">Biến placeholder có thể dùng trong prompt:</p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li><code className="bg-background px-1 rounded">{'{class_name}'}</code> - Tên lớp học</li>
                        <li><code className="bg-background px-1 rounded">{'{age_range}'}</code> - Độ tuổi học sinh</li>
                        <li><code className="bg-background px-1 rounded">{'{teacher_pronoun}'}</code> - Xưng hô giáo viên</li>
                        <li><code className="bg-background px-1 rounded">{'{student_pronoun}'}</code> - Gọi học sinh</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="api-keys" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Quản lý API Keys
                      </CardTitle>
                      <CardDescription>
                        Thêm nhiều Gemini API keys để tự động rotation khi hết limit
                      </CardDescription>
                    </div>
                    <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Thêm API Key
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Thêm API Key mới</DialogTitle>
                          <DialogDescription>
                            Lấy API key từ Google AI Studio: https://aistudio.google.com/apikey
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="api-key-name">Tên (tùy chọn)</Label>
                            <Input
                              id="api-key-name"
                              placeholder="Ví dụ: Key 1, Personal, ..."
                              value={newApiKeyName}
                              onChange={(e) => setNewApiKeyName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="api-key-value">API Key *</Label>
                            <Input
                              id="api-key-value"
                              type="password"
                              placeholder="AIzaSy..."
                              value={newApiKeyValue}
                              onChange={(e) => setNewApiKeyValue(e.target.value)}
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsApiKeyDialogOpen(false)}>
                              Hủy
                            </Button>
                            <Button onClick={handleAddApiKey} disabled={isAddingApiKey}>
                              {isAddingApiKey ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4 mr-2" />
                              )}
                              Thêm
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingData ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Chưa có API key nào</p>
                      <p className="text-sm">Thêm API key để sử dụng chức năng AI</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên</TableHead>
                          <TableHead>API Key</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Lần dùng cuối</TableHead>
                          <TableHead>Số lần dùng</TableHead>
                          <TableHead>Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apiKeys.map((key) => (
                          <TableRow key={key.id}>
                            <TableCell className="font-medium">
                              {key.name || 'Không tên'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {maskApiKey(key.api_key)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {key.is_limited ? (
                                  <Badge variant="destructive">Limited</Badge>
                                ) : key.is_active ? (
                                  <Badge variant="default">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {key.last_used_at 
                                ? new Date(key.last_used_at).toLocaleString('vi-VN')
                                : 'Chưa dùng'}
                            </TableCell>
                            <TableCell>{key.usage_count}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleApiKey(key.id, key.is_active)}
                                  title={key.is_active ? 'Tắt' : 'Bật'}
                                >
                                  {key.is_active ? 'Tắt' : 'Bật'}
                                </Button>
                                {key.is_limited && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleResetApiKeyLimit(key.id)}
                                    title="Reset limit"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteApiKey(key.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <div className="mt-6 bg-muted p-4 rounded-lg text-sm space-y-2">
                    <p className="font-medium">Cách hoạt động:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li>Hệ thống sẽ tự động chọn key ít dùng nhất</li>
                      <li>Khi key hết limit (429), sẽ tự động chuyển sang key tiếp theo</li>
                      <li>Key bị limit sẽ tự động được reset sau 1 phút</li>
                      <li>Nếu không có key trong database, hệ thống sẽ dùng GEMINI_API_KEY từ env</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="user-logs" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      User Action Logs
                    </CardTitle>
                    <CardDescription>
                      Theo dõi tất cả hành động của người dùng trong hệ thống
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Tìm kiếm theo email, action..."
                            value={logsSearch}
                            onChange={(e) => setLogsSearch(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <Select value={logsActionFilter} onValueChange={setLogsActionFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Lọc theo action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả actions</SelectItem>
                          <SelectItem value="AUTH">Authentication</SelectItem>
                          <SelectItem value="CLASS">Class actions</SelectItem>
                          <SelectItem value="SESSION">Session actions</SelectItem>
                          <SelectItem value="SUBMISSION">Submissions</SelectItem>
                          <SelectItem value="FILE">File actions</SelectItem>
                          <SelectItem value="NAVIGATION">Navigation</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={logsDateFilter} onValueChange={setLogsDateFilter}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Thời gian" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tất cả</SelectItem>
                          <SelectItem value="today">Hôm nay</SelectItem>
                          <SelectItem value="week">Tuần này</SelectItem>
                          <SelectItem value="month">Tháng này</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={fetchData}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Logs Table */}
                    {loadingData ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : userActionLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có logs nào</p>
                        <p className="text-sm">Logs sẽ xuất hiện khi users thực hiện các hành động</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Thời gian</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>IP Address</TableHead>
                              <TableHead>Page</TableHead>
                              <TableHead>Environment</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userActionLogs
                              .filter(log => {
                                // Search filter
                                if (logsSearch) {
                                  const searchLower = logsSearch.toLowerCase();
                                  if (!log.user_email?.toLowerCase().includes(searchLower) &&
                                      !log.action.toLowerCase().includes(searchLower) &&
                                      !log.page?.toLowerCase().includes(searchLower)) {
                                    return false;
                                  }
                                }

                                // Action filter
                                if (logsActionFilter !== 'all') {
                                  if (logsActionFilter === 'AUTH' && !log.action.startsWith('AUTH_')) return false;
                                  if (logsActionFilter === 'CLASS' && !log.action.startsWith('CLASS_')) return false;
                                  if (logsActionFilter === 'SESSION' && !log.action.startsWith('SESSION_')) return false;
                                  if (logsActionFilter === 'SUBMISSION' && !log.action.startsWith('SUBMISSION_')) return false;
                                  if (logsActionFilter === 'FILE' && !log.action.startsWith('FILE_')) return false;
                                  if (logsActionFilter === 'NAVIGATION' && log.action !== 'NAVIGATION') return false;
                                }

                                // Date filter
                                if (logsDateFilter !== 'all') {
                                  const logDate = new Date(log.timestamp);
                                  const now = new Date();

                                  if (logsDateFilter === 'today') {
                                    if (logDate.toDateString() !== now.toDateString()) return false;
                                  } else if (logsDateFilter === 'week') {
                                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                                    if (logDate < weekAgo) return false;
                                  } else if (logsDateFilter === 'month') {
                                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                                    if (logDate < monthAgo) return false;
                                  }
                                }

                                return true;
                              })
                              .map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="font-mono text-sm">
                                    {new Date(log.timestamp).toLocaleString('vi-VN', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <div className="font-medium">
                                        {log.user_email || 'Anonymous'}
                                      </div>
                                      {log.user_id && (
                                        <div className="text-xs text-muted-foreground">
                                          ID: {log.user_id.slice(0, 8)}...
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        log.action.startsWith('AUTH_') ? 'default' :
                                        log.action.startsWith('CLASS_') ? 'secondary' :
                                        log.action.startsWith('SESSION_') ? 'outline' :
                                        log.action.startsWith('SUBMISSION_') ? 'destructive' :
                                        'secondary'
                                      }
                                    >
                                      {log.action}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {log.ip_address || 'Unknown'}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {log.page || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={log.environment === 'production' ? 'default' : 'secondary'}>
                                      {log.environment}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}

                    {userActionLogs.length > 0 && (
                      <div className="mt-4 text-sm text-muted-foreground text-center">
                        Hiển thị {userActionLogs.filter(log => {
                          // Same filtering logic as above
                          if (logsSearch) {
                            const searchLower = logsSearch.toLowerCase();
                            if (!log.user_email?.toLowerCase().includes(searchLower) &&
                                !log.action.toLowerCase().includes(searchLower) &&
                                !log.page?.toLowerCase().includes(searchLower)) {
                              return false;
                            }
                          }
                          if (logsActionFilter !== 'all') {
                            if (logsActionFilter === 'AUTH' && !log.action.startsWith('AUTH_')) return false;
                            if (logsActionFilter === 'CLASS' && !log.action.startsWith('CLASS_')) return false;
                            if (logsActionFilter === 'SESSION' && !log.action.startsWith('SESSION_')) return false;
                            if (logsActionFilter === 'SUBMISSION' && !log.action.startsWith('SUBMISSION_')) return false;
                            if (logsActionFilter === 'FILE' && !log.action.startsWith('FILE_')) return false;
                            if (logsActionFilter === 'NAVIGATION' && log.action !== 'NAVIGATION') return false;
                          }
                          if (logsDateFilter !== 'all') {
                            const logDate = new Date(log.timestamp);
                            const now = new Date();
                            if (logsDateFilter === 'today' && logDate.toDateString() !== now.toDateString()) return false;
                            if (logsDateFilter === 'week') {
                              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                              if (logDate < weekAgo) return false;
                            }
                            if (logsDateFilter === 'month') {
                              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                              if (logDate < monthAgo) return false;
                            }
                          }
                          return true;
                        }).length} / {userActionLogs.length} logs
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
      </main>
    </div>
  );
}