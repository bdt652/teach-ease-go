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
import { ArrowLeft, Shield, UserPlus, Trash2, Loader2, Plus, Upload, FileSpreadsheet, AlertCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'admin' | 'teacher' | 'student';

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
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*')
    ]);

    if (profilesRes.data) {
      setProfiles(profilesRes.data);
    }
    if (rolesRes.data) {
      setUserRoles(rolesRes.data as UserRole[]);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (canAccess) {
      fetchData();
    }
  }, [canAccess]);

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
                {isAdmin ? 'Quản lý Users' : 'Quản lý học sinh'}
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
        <Card>
          <CardHeader>
            <CardTitle>Danh sách Users</CardTitle>
            <CardDescription>
              {isAdmin ? 'Quản lý vai trò của users trong hệ thống' : 'Xem danh sách users trong hệ thống'}
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Hướng dẫn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><Badge variant="destructive">Admin</Badge> - Có toàn quyền quản lý hệ thống và tạo tất cả loại tài khoản</p>
            <p><Badge>Giáo viên</Badge> - Có thể tạo lớp, quản lý buổi học, chấm điểm và tạo tài khoản học sinh</p>
            <p><Badge variant="secondary">Học sinh</Badge> - Có thể xem buổi học và nộp bài</p>
            {isAdmin && <p className="mt-4">Click vào badge role để xóa role đó.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}