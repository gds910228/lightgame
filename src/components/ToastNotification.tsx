import React from 'react';
import styles from './ToastNotification.module.css';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className={styles.toast}>
      <svg
        className={styles.icon}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{message}</span>
    </div>
  );
};

export default ToastNotification;