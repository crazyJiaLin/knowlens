import { Alert } from 'antd';
import type { AlertProps } from 'antd';

interface ErrorDisplayProps {
  message: string;
  description?: string;
  type?: AlertProps['type'];
  closable?: boolean;
  onClose?: () => void;
}

export default function ErrorDisplay({
  message,
  description,
  type = 'error',
  closable = true,
  onClose,
}: ErrorDisplayProps) {
  return (
    <Alert
      message={message}
      description={description}
      type={type}
      closable={closable}
      onClose={onClose}
      showIcon
      style={{ marginBottom: '16px' }}
    />
  );
}
