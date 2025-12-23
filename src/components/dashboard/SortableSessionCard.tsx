import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, FileText, Calendar as CalendarIcon, Pencil, PauseCircle, Trash2 } from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Session {
  id: string;
  title: string;
  content: string | null;
  session_order: number;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
}

interface SortableSessionCardProps {
  session: Session;
  sessionDate: Date | null;
  onSelect: () => void;
  onToggleActive: () => void;
  onEdit: () => void;
  onPostpone: () => void;
  onDelete: () => void;
}

export function SortableSessionCard({
  session,
  sessionDate,
  onSelect,
  onToggleActive,
  onEdit,
  onPostpone,
  onDelete,
}: SortableSessionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="hover:shadow-md transition-shadow"
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-1"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <div
          className="flex-1 cursor-pointer"
          onClick={onSelect}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">
              Buổi {session.session_order}
            </span>
            {sessionDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(sessionDate, 'dd/MM/yyyy', { locale: vi })}
              </span>
            )}
            {session.is_active ? (
              <Badge className="bg-green-500">Đang mở</Badge>
            ) : (
              <Badge variant="secondary">Đã đóng</Badge>
            )}
            {session.submission_count !== undefined && session.submission_count > 0 && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                {session.submission_count} bài nộp
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-1">{session.title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={session.is_active}
              onCheckedChange={onToggleActive}
            />
            <span className="text-sm text-muted-foreground">
              {session.is_active ? 'Mở' : 'Đóng'}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Chỉnh sửa buổi học"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPostpone();
            }}
            title="Hoãn buổi học - lùi lịch kết thúc 1 tuần"
          >
            <PauseCircle className="h-4 w-4 mr-1" />
            Hoãn
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
