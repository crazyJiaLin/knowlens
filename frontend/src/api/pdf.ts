import request from './request';

export const uploadPdf = async (
  file: File,
  title?: string
): Promise<{
  success: boolean;
  documentId: string;
  status: string;
  message: string;
}> => {
  const formData = new FormData();
  formData.append('file', file);
  if (title && title.trim()) {
    formData.append('title', title.trim());
  }

  return request.post('/pdf/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
