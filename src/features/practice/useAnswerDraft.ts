import { useState } from 'react';

export function useAnswerDraft(draftKey: string, acceptedValue?: string) {
  const [draft] = useState(() => {
    try {
      return { value: localStorage.getItem(draftKey) ?? '', error: '' };
    } catch {
      return { value: '', error: 'Не удалось прочитать черновик из браузера.' };
    }
  });
  const [value, setValue] = useState(acceptedValue ?? draft.value);
  const [storageError, setStorageError] = useState(draft.error);
  function change(value: string) {
    setValue(value);
    try {
      localStorage.setItem(draftKey, value);
      setStorageError('');
    } catch {
      setStorageError('Не удалось сохранить черновик. Не закрывайте страницу до отправки ответа.');
    }
  }
  function clear() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* The server has the accepted answer. */
    }
  }
  return { value, storageError, change, clear };
}
