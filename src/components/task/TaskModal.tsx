import { useState, useEffect, memo, useCallback } from 'react';
import { Modal, Button, Input } from '@/components/common';
import type { Task, TaskStatus, TaskPriority } from '@/types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/types';
import { useI18n } from '@/i18n';
import { useTaskStore } from '@/stores/taskStore';
import { useTagStore } from '@/stores/tagStore';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  projectId: string;
  onSave: (data: {
    title: string;
    description: string;
    dueDate?: string;
    status: TaskStatus;
    priority: TaskPriority;
    tags: string[];
  }) => void;
  onDelete?: () => void;
}

export const TaskModal = memo(function TaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
}: TaskModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');

  const { tags } = useTagStore();
  const { getCommentsByTask, addComment, deleteComment, loadComments } = useTaskStore();
  const comments = task ? getCommentsByTask(task.id) : [];

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, loadComments]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDueDate(task.dueDate || '');
      setStatus(task.status);
      setPriority(task.priority);
      setSelectedTags(task.tags);
    } else {
      setTitle('');
      setDescription('');
      setDueDate('');
      setStatus('todo');
      setPriority('medium');
      setSelectedTags([]);
    }
    setNewComment('');
  }, [task, isOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      onSave({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
        status,
        priority,
        tags: selectedTags,
      });
      onClose();
    },
    [title, description, dueDate, status, priority, selectedTags, onSave, onClose]
  );

  const handleAddComment = useCallback(() => {
    if (!task || !newComment.trim()) return;
    addComment(task.id, newComment.trim());
    setNewComment('');
  }, [task, newComment, addComment]);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      deleteComment(commentId);
    },
    [deleteComment]
  );

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const isEditing = !!task;
  const priorities: TaskPriority[] = ['low', 'medium', 'high'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.editTask : t.createTask}
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <div>
            {isEditing && onDelete && (
              <Button variant="secondary" onClick={onDelete}>
                {t.delete}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? t.save : t.create}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.taskTitle} *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.taskTitle}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.taskDescription}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            rows={3}
            placeholder={t.taskDescription}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.taskDueDate}
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.taskStatus}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="todo">{TASK_STATUS_LABELS.todo}</option>
              <option value="in_progress">{TASK_STATUS_LABELS.in_progress}</option>
              <option value="done">{TASK_STATUS_LABELS.done}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.taskPriority}
          </label>
          <div className="flex gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  priority === p
                    ? `${TASK_PRIORITY_COLORS[p]} bg-opacity-20 bg-current font-medium`
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {TASK_PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.taskTags}
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 评论区域 */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.taskComments}
            </label>
            <div className="space-y-3 mb-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 group"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {comment.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-gray-400">{t.noData}</p>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                rows={2}
                placeholder={t.commentPlaceholder}
              />
              <Button type="button" onClick={handleAddComment} className="self-end">
                {t.addComment}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
});
