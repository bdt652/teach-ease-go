import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  FileText,
  Calendar,
  Award,
  Target,
  Clock,
  Download,
  RefreshCw,
  PieChart,
  Activity
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, subWeeks, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';

interface AnalyticsData {
  totalUsers: number;
  totalClasses: number;
  totalSessions: number;
  totalSubmissions: number;
  activeSessions: number;
  recentSubmissions: number;
  averageGrade: number | null;
  submissionRate: number;
  classStats: {
    class_id: string;
    class_name: string;
    class_code: string;
    student_count: number;
    session_count: number;
    submission_count: number;
    average_grade: number | null;
  }[];
  userGrowth: { date: string; new_users: number }[];
  submissionTrends: { date: string; submission_count: number }[];
  gradeDistribution: { grade_range: string; count: number }[];
  recentActivity: {
    type: 'submission' | 'class_created' | 'user_joined';
    description: string;
    timestamp: string;
  }[];
}

export default function AnalyticsDashboard() {
  const { user, hasRole } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const isAdmin = hasRole('admin');
  const isTeacher = hasRole('teacher');

  // Only allow admin and teacher to access analytics
  if (!isAdmin && !isTeacher) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Bạn không có quyền truy cập trang này</p>
        </div>
      </div>
    );
  }

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        case '90d':
          startDate = subDays(now, 90);
          break;
        default:
          startDate = subDays(now, 30);
      }

      // Fetch all data in parallel
      const [
        usersRes,
        classesRes,
        submissionsRes,
        classStatsRes,
        userGrowthRes,
        submissionTrendsRes
      ] = await Promise.all([
        // Total users
        supabase.from('profiles').select('id', { count: 'exact' }),

        // Total classes (filter by teacher if not admin)
        isAdmin
          ? supabase.from('classes').select('id', { count: 'exact' })
          : supabase.from('classes').select('id', { count: 'exact' }).eq('teacher_id', user?.id),

        // Total submissions
        supabase.from('submissions').select('id, score', { count: 'exact' }),

        // Class statistics with student counts and submission counts
        supabase.rpc('get_class_statistics', {
          teacher_id_filter: isAdmin ? null : user?.id
        }),

        // User growth over time
        supabase.rpc('get_user_growth_stats', {
          days_back: timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
        }),

        // Submission trends
        supabase.rpc('get_submission_trends', {
          days_back: timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
        })
      ]);

      // Handle sessions count separately due to async logic
      let sessionsRes;
      if (isAdmin) {
        sessionsRes = await supabase.from('sessions').select('id', { count: 'exact' });
      } else {
        const { data: teacherClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', user?.id);

        const classIds = teacherClasses?.map(c => c.id) || [];
        if (classIds.length > 0) {
          sessionsRes = await supabase
            .from('sessions')
            .select('id', { count: 'exact' })
            .in('class_id', classIds);
        } else {
          sessionsRes = { count: 0 };
        }
      }

      // Calculate metrics
      const totalUsers = usersRes.count || 0;
      const totalClasses = classesRes.count || 0;
      const totalSessions = sessionsRes.count || 0;
      const totalSubmissions = submissionsRes.count || 0;

      // Active sessions
      const activeSessionsRes = await supabase
        .from('sessions')
        .select('id', { count: 'exact' })
        .eq('is_active', true);

      const activeSessions = activeSessionsRes.count || 0;

      // Recent submissions (last 24 hours)
      const yesterday = subDays(now, 1);
      const recentSubmissionsRes = await supabase
        .from('submissions')
        .select('id', { count: 'exact' })
        .gte('submitted_at', yesterday.toISOString());

      const recentSubmissions = recentSubmissionsRes.count || 0;

      // Average grade
      const { data: gradedSubmissions } = await supabase
        .from('submissions')
        .select('score')
        .not('score', 'is', null);

      const averageGrade = gradedSubmissions && gradedSubmissions.length > 0
        ? gradedSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0) / gradedSubmissions.length
        : null;

      // Submission rate (submissions / expected submissions)
      const submissionRate = totalSessions > 0 ? (totalSubmissions / (totalSessions * 30)) * 100 : 0; // Assuming 30 students per class avg

      // Class statistics
      const classStats = classStatsRes.data || [];

      // User growth data from RPC
      const userGrowth = (Array.isArray(usersRes.data) ? usersRes.data : []) as unknown as { date: string; new_users: number }[];

      // Submission trends from RPC
      const submissionTrends = (Array.isArray(submissionsRes.data) ? submissionsRes.data : []) as unknown as { date: string; submission_count: number }[];

      // Grade distribution
      const { data: gradeData } = await supabase.rpc('get_grade_distribution');
      const gradeDistribution = (gradeData as { grade_range: string; count: number }[]) || [
        { grade_range: 'A (9-10)', count: 0 },
        { grade_range: 'B (7-8.9)', count: 0 },
        { grade_range: 'C (5-6.9)', count: 0 },
        { grade_range: 'D (0-4.9)', count: 0 },
      ];

      // Recent activity (mock data for now)
      const recentActivity = [
        {
          type: 'submission' as const,
          description: 'Có bài nộp mới trong lớp Python Cơ bản',
          timestamp: new Date().toISOString()
        },
        {
          type: 'class_created' as const,
          description: 'Lớp học mới "JavaScript Nâng cao" được tạo',
          timestamp: subDays(new Date(), 1).toISOString()
        },
        {
          type: 'user_joined' as const,
          description: '5 học sinh mới tham gia hệ thống',
          timestamp: subDays(new Date(), 2).toISOString()
        }
      ];

      setData({
        totalUsers,
        totalClasses,
        totalSessions,
        totalSubmissions,
        activeSessions,
        recentSubmissions,
        averageGrade,
        submissionRate,
        classStats,
        userGrowth,
        submissionTrends,
        gradeDistribution,
        recentActivity
      });

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast.error('Không thể tải dữ liệu thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, user?.id, isAdmin]);

  const StatCard = ({ title, value, description, icon: Icon, trend }: {
    title: string;
    value: string | number;
    description?: string;
    icon: any;
    trend?: { value: number; isPositive: boolean };
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend.isPositive ? '+' : ''}{trend.value}% so với kỳ trước
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Không thể tải dữ liệu thống kê</p>
          <Button onClick={fetchAnalyticsData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Thống kê hệ thống</h1>
          <p className="text-muted-foreground">
            Tổng quan về hoạt động của hệ thống EduCode
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
            <TabsList>
              <TabsTrigger value="7d">7 ngày</TabsTrigger>
              <TabsTrigger value="30d">30 ngày</TabsTrigger>
              <TabsTrigger value="90d">90 ngày</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={fetchAnalyticsData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng người dùng"
          value={data.totalUsers}
          description="Người dùng đã đăng ký"
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Tổng lớp học"
          value={data.totalClasses}
          description="Lớp học đã tạo"
          icon={BookOpen}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Tổng buổi học"
          value={data.totalSessions}
          description={`${data.activeSessions} buổi đang mở`}
          icon={Calendar}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Tổng bài nộp"
          value={data.totalSubmissions}
          description={`${data.recentSubmissions} bài trong 24h qua`}
          icon={FileText}
          trend={{ value: 20, isPositive: true }}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Điểm trung bình
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.averageGrade ? data.averageGrade.toFixed(1) : 'N/A'}
            </div>
            <Progress
              value={data.averageGrade ? (data.averageGrade / 10) * 100 : 0}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Trên thang điểm 10
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tỷ lệ nộp bài
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.submissionRate.toFixed(1)}%
            </div>
            <Progress value={data.submissionRate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Bài nộp / Buổi học
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Hoạt động gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentActivity.slice(0, 3).map((activity, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'submission' ? 'bg-green-500' :
                    activity.type === 'class_created' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), 'HH:mm dd/MM', { locale: vi })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="classes">Thống kê lớp học</TabsTrigger>
          <TabsTrigger value="trends">Xu hướng</TabsTrigger>
          <TabsTrigger value="grades">Phân bố điểm</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chi tiết lớp học</CardTitle>
              <CardDescription>
                Thống kê chi tiết cho từng lớp học
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.classStats.map((classStat) => (
                  <div key={classStat.class_code} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">{classStat.class_code}</Badge>
                        <h4 className="font-medium">{classStat.class_name}</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">{classStat.student_count}</span> học sinh
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{classStat.session_count}</span> buổi học
                        </div>
                        <div>
                          <span className="font-medium text-foreground">{classStat.submission_count}</span> bài nộp
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {classStat.average_grade ? classStat.average_grade.toFixed(1) : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">Điểm TB</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Người dùng mới</CardTitle>
                <CardDescription>Số lượng người dùng đăng ký theo thời gian</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                    <p>Chart sẽ được hiển thị ở đây</p>
                    <p className="text-sm">Tổng: {data.userGrowth.reduce((sum, item) => sum + (item.new_users || 0), 0)} người dùng</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bài nộp theo ngày</CardTitle>
                <CardDescription>Số lượng bài nộp trong khoảng thời gian</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                    <p>Chart sẽ được hiển thị ở đây</p>
                    <p className="text-sm">Tổng: {data.submissionTrends.reduce((sum, item) => sum + (item.submission_count || 0), 0)} bài nộp</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Phân bố điểm số</CardTitle>
              <CardDescription>Thống kê điểm số của học sinh</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.gradeDistribution.map((grade) => (
                  <div key={grade.grade_range} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        grade.grade_range.startsWith('A') ? 'bg-green-500' :
                        grade.grade_range.startsWith('B') ? 'bg-blue-500' :
                        grade.grade_range.startsWith('C') ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">{grade.grade_range}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            grade.grade_range.startsWith('A') ? 'bg-green-500' :
                            grade.grade_range.startsWith('B') ? 'bg-blue-500' :
                            grade.grade_range.startsWith('C') ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{
                            width: `${data.gradeDistribution.reduce((sum, g) => sum + (g.count || 0), 0) > 0
                              ? ((grade.count || 0) / data.gradeDistribution.reduce((sum, g) => sum + (g.count || 0), 0)) * 100
                              : 0}%`
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{grade.count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Xuất báo cáo
          </CardTitle>
          <CardDescription>
            Xuất dữ liệu thống kê dưới dạng file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Xuất PDF
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Xuất Excel
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Xuất CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
