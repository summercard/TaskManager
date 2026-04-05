import { useState, memo, useCallback, useEffect } from 'react';
import { Modal, Button, Input } from '@/components/common';
import type { ProjectGoal } from '@/types';

interface GoalEditorProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: ProjectGoal;
  onSave: (goal: ProjectGoal) => void;
}

export const GoalEditor = memo(function GoalEditor({ isOpen, onClose, goal, onSave }: GoalEditorProps) {
  const [description, setDescription] = useState(goal?.description || '');
  const [targetCount, setTargetCount] = useState(goal?.targetCount || 10);
  const [currentCount, setCurrentCount] = useState(goal?.currentCount || 0);

  useEffect(() => {
    if (isOpen) {
      setDescription(goal?.description || '');
      setTargetCount(goal?.targetCount || 10);
      setCurrentCount(goal?.currentCount || 0);
    }
  }, [isOpen, goal]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      description,
      targetCount,
      currentCount,
    });
    onClose();
  }, [description, targetCount, currentCount, onSave, onClose]);

  const progress = Math.round((currentCount / targetCount) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="编辑目标"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>保存</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目标描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={3}
            placeholder="描述这个项目的目标..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标数量
            </label>
            <Input
              type="number"
              min={1}
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              当前进度
            </label>
            <Input
              type="number"
              min={0}
              max={targetCount}
              value={currentCount}
              onChange={(e) => setCurrentCount(Math.min(targetCount, Math.max(0, parseInt(e.target.value) || 0)))}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">完成进度</span>
            <span className="font-medium">
              {progress}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
});
