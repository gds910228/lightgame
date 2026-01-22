import { useEffect, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const Modal = ({ isOpen, onClose, children }: ModalProps) => {
  // 处理ESC键关闭模态窗口
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // 禁止滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      // 恢复滚动
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* 模态窗口内容 */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-dark-card border border-dark-border rounded-lg shadow-2xl max-w-md w-full mx-auto animate-bounce-in glow-border"
          onClick={e => e.stopPropagation()} // 防止点击内容区域关闭模态窗口
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal; 