import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { BookOpen, Users, FileCode, Award, ArrowRight, LogIn, UserPlus } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: BookOpen,
      title: "Quản lý lớp học",
      description: "Tạo và quản lý các lớp học với mã code riêng biệt, dễ dàng chia sẻ cho học viên."
    },
    {
      icon: Users,
      title: "Theo dõi học viên",
      description: "Xem danh sách học viên, theo dõi tiến độ và đánh giá bài nộp của từng người."
    },
    {
      icon: FileCode,
      title: "Nộp bài trực tuyến",
      description: "Học viên có thể nộp bài code, file và nhận phản hồi từ giảng viên."
    },
    {
      icon: Award,
      title: "Đánh giá & Phản hồi",
      description: "Chấm điểm, ghi chú và phản hồi chi tiết cho từng bài nộp của học viên."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">EduCode</span>
          </div>
          <nav className="flex items-center gap-4">
            {loading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded" />
            ) : user ? (
              <Button onClick={() => navigate("/dashboard")}>
                Vào Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/auth")}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Đăng nhập
                </Button>
                <Button onClick={() => navigate("/auth")}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Đăng ký
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Nền tảng quản lý lớp học
            <span className="text-primary block mt-2">lập trình trực tuyến</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Giúp giảng viên dễ dàng tạo lớp, quản lý bài tập và theo dõi tiến độ học viên. 
            Học viên có thể nộp bài và nhận phản hồi nhanh chóng.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Button size="lg" onClick={() => navigate("/dashboard")}>
                Vào Dashboard
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => navigate("/auth")}>
                  Bắt đầu ngay
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/guest")}>
                  Truy cập với tư cách khách
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Tính năng nổi bật
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="text-muted-foreground mb-8">
            Đăng ký ngay để trải nghiệm nền tảng quản lý lớp học lập trình hiện đại.
          </p>
          {!user && (
            <Button size="lg" onClick={() => navigate("/auth")}>
              Đăng ký miễn phí
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">EduCode</span>
          </div>
          <p className="text-sm">© 2024 EduCode. Nền tảng quản lý lớp học lập trình.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
