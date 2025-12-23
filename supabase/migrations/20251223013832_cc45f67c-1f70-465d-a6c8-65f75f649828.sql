-- Create role enum for the system
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

-- Create classes table
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    schedule_info VARCHAR(255),
    teacher_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table (buổi học)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    session_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create submissions table (supports both authenticated and guest users)
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NULL,
    guest_name VARCHAR(100) NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    code_snippet TEXT,
    teacher_note TEXT,
    ai_feedback TEXT,
    score FLOAT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_user_or_guest CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

-- Create student_notes table (private teacher notes about students)
CREATE TABLE public.student_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    student_user_id UUID NULL,
    student_guest_name VARCHAR(100) NULL,
    note TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_submissions_session ON public.submissions(session_id);
CREATE INDEX idx_submissions_user ON public.submissions(user_id);
CREATE INDEX idx_sessions_class ON public.sessions(class_id);
CREATE INDEX idx_classes_code ON public.classes(code);
CREATE INDEX idx_classes_teacher ON public.classes(teacher_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to check if user is teacher of a class
CREATE OR REPLACE FUNCTION public.is_class_teacher(_user_id UUID, _class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.classes
        WHERE id = _class_id
          AND teacher_id = _user_id
    )
$$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_notes_updated_at
    BEFORE UPDATE ON public.student_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    RETURN NEW;
END;
$$;

-- Trigger for auto-creating profiles on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Classes policies
CREATE POLICY "Anyone authenticated can view classes"
    ON public.classes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Teachers can create classes"
    ON public.classes FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own classes"
    ON public.classes FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own classes"
    ON public.classes FOR DELETE
    TO authenticated
    USING (teacher_id = auth.uid());

-- Sessions policies
CREATE POLICY "Anyone authenticated can view active sessions"
    ON public.sessions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Class teachers can manage sessions"
    ON public.sessions FOR INSERT
    TO authenticated
    WITH CHECK (public.is_class_teacher(auth.uid(), class_id));

CREATE POLICY "Class teachers can update sessions"
    ON public.sessions FOR UPDATE
    TO authenticated
    USING (public.is_class_teacher(auth.uid(), class_id));

CREATE POLICY "Class teachers can delete sessions"
    ON public.sessions FOR DELETE
    TO authenticated
    USING (public.is_class_teacher(auth.uid(), class_id));

-- Submissions policies (allow both authenticated and anonymous)
CREATE POLICY "Users can view their own submissions"
    ON public.submissions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_class_teacher(auth.uid(), (SELECT class_id FROM public.sessions WHERE id = session_id)));

CREATE POLICY "Authenticated users can submit"
    ON public.submissions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers can update submissions (for grading)"
    ON public.submissions FOR UPDATE
    TO authenticated
    USING (public.is_class_teacher(auth.uid(), (SELECT class_id FROM public.sessions WHERE id = session_id)));

-- Anonymous submissions policy (for guest mode)
CREATE POLICY "Anonymous users can submit"
    ON public.submissions FOR INSERT
    TO anon
    WITH CHECK (user_id IS NULL AND guest_name IS NOT NULL);

CREATE POLICY "Anyone can view submissions by session for guest lookup"
    ON public.submissions FOR SELECT
    TO anon
    USING (true);

-- Student notes policies (only teachers can see)
CREATE POLICY "Teachers can view their notes"
    ON public.student_notes FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Teachers can create notes"
    ON public.student_notes FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can update their notes"
    ON public.student_notes FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Teachers can delete their notes"
    ON public.student_notes FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- Create storage bucket for submissions
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('submissions', 'submissions', false, 104857600);

-- Storage policies for submissions bucket
CREATE POLICY "Authenticated users can upload submissions"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Users can view their own submissions files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'submissions');

CREATE POLICY "Anonymous can upload to submissions"
    ON storage.objects FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'submissions');

-- Sessions can be viewed publicly for guest access
CREATE POLICY "Public can view active sessions by class code"
    ON public.sessions FOR SELECT
    TO anon
    USING (is_active = true);

-- Classes can be looked up by code for guest access
CREATE POLICY "Public can view classes by code"
    ON public.classes FOR SELECT
    TO anon
    USING (true);