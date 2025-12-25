import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Search, Link, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  user_id: string;
  full_name: string | null;
  email: string;
  isEnrolled: boolean;
}

interface AddStudentDialogProps {
  classId: string;
  className: string;
  classCode: string;
  enrolledStudentIds: string[];
  onStudentAdded: () => void;
}

export default function AddStudentDialog({ 
  classId, 
  className, 
  classCode,
  enrolledStudentIds, 
  onStudentAdded 
}: AddStudentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  
  // Search by email
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<Student | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Select from list
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [filterText, setFilterText] = useState('');
  
  // Invite link
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Adding state
  const [isAdding, setIsAdding] = useState(false);

  // Generate invite link
  useEffect(() => {
    if (isOpen) {
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/join/${classCode}`);
    }
  }, [isOpen, classCode]);

  // Fetch all students when "list" tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      fetchAllStudents();
    }
  }, [isOpen, activeTab]);

  const fetchAllStudents = async () => {
    setIsLoadingStudents(true);
    
    // Get all users with student role
    const { data: studentRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'student');
    
    if (rolesError) {
      toast.error('Không thể tải danh sách học sinh');
      setIsLoadingStudents(false);
      return;
    }

    if (!studentRoles || studentRoles.length === 0) {
      setAllStudents([]);
      setIsLoadingStudents(false);
      return;
    }

    const studentIds = studentRoles.map(r => r.user_id);

    // Get profiles for these students
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', studentIds);

    if (profilesError) {
      toast.error('Không thể tải thông tin học sinh');
      setIsLoadingStudents(false);
      return;
    }

    const students: Student[] = (profiles || []).map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: '', // We don't have access to auth.users email from client
      isEnrolled: enrolledStudentIds.includes(p.user_id)
    }));

    setAllStudents(students);
    setIsLoadingStudents(false);
  };

  const handleSearchByEmail = async () => {
    if (!searchEmail.trim()) {
      setSearchError('Vui lòng nhập email');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    // We can't search auth.users directly, so we need to use edge function or RPC
    // For now, let's search in profiles by matching with user metadata
    // This is a limitation - we'll need to store email in profiles or use edge function
    
    // Alternative: Search using the create-user edge function approach
    // For now, let's show a message that this feature needs the edge function
    
    toast.error('Chức năng tìm kiếm theo email cần cấu hình thêm. Vui lòng dùng "Chọn từ danh sách" hoặc "Mời bằng link".');
    setIsSearching(false);
  };

  const handleAddStudent = async (userId: string) => {
    setIsAdding(true);
    
    const { error } = await supabase
      .from('class_enrollments')
      .insert({
        class_id: classId,
        user_id: userId
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('Học sinh đã có trong lớp');
      } else {
        toast.error('Không thể thêm học sinh: ' + error.message);
      }
    } else {
      toast.success('Đã thêm học sinh vào lớp');
      onStudentAdded();
      
      // Update local state
      setAllStudents(prev => prev.map(s => 
        s.user_id === userId ? { ...s, isEnrolled: true } : s
      ));
    }
    
    setIsAdding(false);
  };

  const handleAddSelectedStudents = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Vui lòng chọn ít nhất một học sinh');
      return;
    }

    setIsAdding(true);
    
    const enrollments = selectedStudents.map(userId => ({
      class_id: classId,
      user_id: userId
    }));

    const { error } = await supabase
      .from('class_enrollments')
      .insert(enrollments);

    if (error) {
      if (error.code === '23505') {
        toast.error('Một số học sinh đã có trong lớp');
      } else {
        toast.error('Không thể thêm học sinh: ' + error.message);
      }
    } else {
      toast.success(`Đã thêm ${selectedStudents.length} học sinh vào lớp`);
      onStudentAdded();
      setSelectedStudents([]);
      
      // Update local state
      setAllStudents(prev => prev.map(s => 
        selectedStudents.includes(s.user_id) ? { ...s, isEnrolled: true } : s
      ));
    }
    
    setIsAdding(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success('Đã sao chép link mời');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép link');
    }
  };

  const toggleStudentSelection = (userId: string) => {
    setSelectedStudents(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredStudents = allStudents.filter(s => 
    !s.isEnrolled && 
    (filterText === '' || 
      s.full_name?.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Thêm học sinh
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm học sinh vào lớp</DialogTitle>
          <DialogDescription>
            Thêm học sinh vào lớp {className}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search className="h-4 w-4 mr-1" />
              Tìm kiếm
            </TabsTrigger>
            <TabsTrigger value="list">
              <UserPlus className="h-4 w-4 mr-1" />
              Danh sách
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link className="h-4 w-4 mr-1" />
              Link mời
            </TabsTrigger>
          </TabsList>

          {/* Search by Email Tab */}
          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="search-email">Email học sinh</Label>
              <div className="flex gap-2">
                <Input
                  id="search-email"
                  type="email"
                  placeholder="student@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
                <Button onClick={handleSearchByEmail} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {searchError && <p className="text-sm text-destructive">{searchError}</p>}
            </div>

            {searchResult && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{searchResult.full_name || 'Không tên'}</p>
                    <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                  </div>
                  {searchResult.isEnrolled ? (
                    <span className="text-sm text-muted-foreground">Đã trong lớp</span>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => handleAddStudent(searchResult.user_id)}
                      disabled={isAdding}
                    >
                      {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Thêm'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Lưu ý: Chức năng tìm kiếm theo email cần cấu hình thêm. Vui lòng dùng tab "Danh sách" hoặc "Link mời".
            </p>
          </TabsContent>

          {/* Select from List Tab */}
          <TabsContent value="list" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="filter-students">Lọc theo tên</Label>
              <Input
                id="filter-students"
                placeholder="Nhập tên học sinh..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>

            {isLoadingStudents ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Đang tải danh sách...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {allStudents.length === 0 
                  ? 'Chưa có học sinh nào trong hệ thống' 
                  : filterText 
                    ? 'Không tìm thấy học sinh phù hợp'
                    : 'Tất cả học sinh đã có trong lớp'}
              </div>
            ) : (
              <>
                <ScrollArea className="h-[250px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Tên học sinh</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.user_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.includes(student.user_id)}
                              onCheckedChange={() => toggleStudentSelection(student.user_id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {student.full_name || 'Không tên'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddStudent(student.user_id)}
                              disabled={isAdding}
                            >
                              Thêm
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {selectedStudents.length > 0 && (
                  <Button 
                    className="w-full" 
                    onClick={handleAddSelectedStudents}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Thêm {selectedStudents.length} học sinh đã chọn
                  </Button>
                )}
              </>
            )}
          </TabsContent>

          {/* Invite Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Link mời tham gia lớp</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Chia sẻ link này cho học sinh. Họ sẽ cần đăng nhập để tham gia lớp.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">Hoặc chia sẻ mã lớp:</p>
              <div className="flex items-center gap-2">
                <code className="bg-background px-3 py-2 rounded text-lg font-mono">
                  {classCode}
                </code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(classCode);
                    toast.success('Đã sao chép mã lớp');
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Học sinh nhập mã này tại trang tham gia lớp
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
