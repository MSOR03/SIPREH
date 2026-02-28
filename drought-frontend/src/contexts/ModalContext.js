'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import Modal from '@/components/ui/Modal';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    showCancel: true,
    onConfirm: () => {},
  });

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const showModal = useCallback(
    ({
      title,
      message,
      type = 'confirm',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      showCancel = true,
      onConfirm = () => {},
    }) => {
      setModal({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        showCancel,
        onConfirm: () => {
          onConfirm();
          closeModal();
        },
      });
    },
    [closeModal]
  );

  const showConfirm = useCallback(
    (message, title = '¿Estás seguro?', onConfirm) => {
      showModal({ title, message, type: 'confirm', onConfirm });
    },
    [showModal]
  );

  const showAlert = useCallback(
    (message, title = 'Atención', type = 'info') => {
      showModal({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'Entendido',
        onConfirm: () => {},
      });
    },
    [showModal]
  );

  const showWarningConfirm = useCallback(
    (message, title = 'Advertencia', onConfirm) => {
      showModal({
        title,
        message,
        type: 'warning',
        confirmText: 'Continuar',
        onConfirm,
      });
    },
    [showModal]
  );

  const showDangerConfirm = useCallback(
    (message, title = '⚠️ Acción peligrosa', onConfirm) => {
      showModal({
        title,
        message,
        type: 'danger',
        confirmText: 'Eliminar',
        onConfirm,
      });
    },
    [showModal]
  );

  return (
    <ModalContext.Provider
      value={{
        showModal,
        showConfirm,
        showAlert,
        showWarningConfirm,
        showDangerConfirm,
        closeModal,
      }}
    >
      {children}
      <Modal {...modal} onClose={closeModal} />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
