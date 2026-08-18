import { createContext, useContext, useState } from 'react';
import { ConfirmationModal } from './confirmation.modal';
import { VitalConfirmationModal } from './vitals-confirmation.modal';

type ModalItem = {
  label: string;
  value: string | number | null;
};

export type ModalSectionItem =
  | {
      type: 'labelValue';
      label: string;
      value: string | number | null;
      isChild?: boolean;
    }
  | { type: 'subheading'; heading: string; values: string[] };

export type ModalSection = {
  title: string;
  items: ModalSectionItem[];
  onChange?: () => void;
};

/* Vital Confirmation Modal Config */
export type VitalConfirmModalConfig = {
  open: boolean;
  type: 'vitalConfirm';
  title: string;
  description?: string;
  icon?: string;
  items?: ModalItem[];
  sections?: ModalSection[];
  size?: 'sm' | 'lg';
  highlightText?: string;
  cancelText?: string;
  confirmText?: string;

  onConfirm?: () => void;
  onChange?: () => void;
};

/* Confirmation Modal Config */
export type ConfirmModalConfig = {
  open: boolean;
  type: 'confirm';
  title: string;
  description?: string;
  size?: 'sm' | 'lg';
  note?: string;
  icon?: string;
  iconElement?: React.ReactNode;
  cancelText?: string;
  confirmText?: string;
  items?: string[];
  children?: React.ReactNode;
  hideActions?: boolean;

  onConfirm?: () => void;
};
type ModalConfig =
  | ({ open: boolean } & VitalConfirmModalConfig)
  | ({ open: boolean } & ConfirmModalConfig);

type ModalContextType = {
  showConfirmModal: (config: ConfirmModalConfig) => void;
  showVitalConfirmationModal: (config: VitalConfirmModalConfig) => void;
  closeModal: () => void;
};
const ModalContext = createContext<ModalContextType>({
  showConfirmModal: () => {},
  showVitalConfirmationModal: () => {},
  closeModal: () => {},
});

export const GlobalModalProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [modal, setModal] = useState<ModalConfig>({
    open: false,
    type: 'vitalConfirm',
    title: '',
  });

  const showConfirmModal = (config: ConfirmModalConfig) => {
    setModal({ ...config, open: true });
  };

  const showVitalConfirmationModal = (config: VitalConfirmModalConfig) => {
    setModal({ ...config, open: true });
  };

  /* Close Modal */
  const closeModal = () => {
    setModal(prev => ({
      ...prev,
      open: false,
    }));
  };

  return (
    <ModalContext.Provider
      value={{ showConfirmModal, showVitalConfirmationModal, closeModal }}
    >
      {children}

      {/*  Confirmation Modal */}
      {modal.open && modal.type === 'vitalConfirm' && (
        <VitalConfirmationModal
          open={modal.open}
          title={modal.title}
          icon={modal.icon}
          description={modal.description}
          items={modal.items || []}
          sections={modal.sections}
          size={modal?.size}
          cancelText={modal.cancelText || 'Cancel'}
          confirmText={modal.confirmText || 'Confirm'}
          onClose={closeModal}
          onChange={() => {
            modal.onChange?.();
            closeModal();
          }}
          onConfirm={() => {
            modal.onConfirm?.();
            closeModal();
          }}
        />
      )}

      {/* Confirmation Modal */}
      {modal.open && modal.type === 'confirm' && (
        <ConfirmationModal
          open={modal.open}
          title={modal.title}
          description={modal.description}
          note={'note' in modal ? modal.note : undefined}
          size={'size' in modal ? modal.size : undefined}
          icon={modal.icon}
          iconElement={'iconElement' in modal ? modal.iconElement : undefined}
          cancelText={modal.cancelText || 'Cancel'}
          confirmText={modal.confirmText || 'Confirm'}
          items={modal.items || []}
          hideActions={'hideActions' in modal ? modal.hideActions : undefined}
          onClose={closeModal}
          onConfirm={() => {
            modal.onConfirm?.();
            closeModal();
          }}
          type={'confirm'}
        >
          {'children' in modal ? modal.children : undefined}
        </ConfirmationModal>
      )}
    </ModalContext.Provider>
  );
};

export const useGlobalModal = () => useContext(ModalContext);
