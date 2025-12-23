import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Upload, LogIn } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo & Title */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
          EduCode
        </h1>
        <p className="text-lg text-muted-foreground">
          Nộp bài & Quản lý lớp học
        </p>
      </div>

      {/* Main Actions */}
      <div className="w-full max-w-sm space-y-4">
        {loading ? (
          <div className="space-y-4">
            <div className="h-14 bg-muted animate-pulse rounded-lg" />
            <div className="h-14 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : user ? (
          <>
            <Button
              size="lg"
              className="w-full h-14 text-lg"
              onClick={() => navigate("/dashboard")}
            >
              <GraduationCap className="mr-3 h-6 w-6" />
              Vào lớp học
            </Button>
          </>
        ) : (
          <>
            {/* Guest Submit - Largest & Most Prominent */}
            <Button
              size="lg"
              className="w-full h-16 text-xl font-semibold"
              onClick={() => navigate("/guest")}
            >
              <Upload className="mr-3 h-7 w-7" />
              Nộp bài
            </Button>

            {/* Login/Register */}
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 text-lg"
              onClick={() => navigate("/auth")}
            >
              <LogIn className="mr-3 h-6 w-6" />
              Đăng nhập / Đăng ký
            </Button>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        © 2024 EduCode
      </footer>
    </div>
  );
};

export default Index;
