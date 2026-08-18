import closeIcon from '../../assets/icons/close.svg';
import changeIcon from '../../assets/icons/edit.svg';
import iconRightArrow from '../../assets/icons/icon-right-arrow.svg';
import Button from '../common/button.component';
import type { ModalSection } from './global-modal-context';

interface ModalItem {
  label: string;
  value: string | number | null;
}

interface VitalConfirmationModalProps {
  open: boolean;
  title: string;

  description?: string;
  highlightText?: string;
  icon?: string;

  items?: ModalItem[];
  sections?: ModalSection[];

  // Global Change Button
  onChange?: () => void;

  size?: 'sm' | 'lg';

  cancelText?: string;
  confirmText?: string;

  onClose: () => void;
  onConfirm: () => void;
}

export const VitalConfirmationModal = ({
  open,
  title,
  description,
  icon,
  items = [],
  sections,

  onChange,

  size = 'sm',

  cancelText = 'Back',
  confirmText = 'Confirm',

  onClose,
  onConfirm,
}: VitalConfirmationModalProps) => {
  if (!open) return null;

  const hasSections = sections && sections.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-center">
      {/* Modal Box */}
      <div
        className={`
      bg-white shadow-xl flex flex-col

      /* Desktop Modal */
      ${size === 'lg' ? 'w-[700px] max-h-[100vh]' : 'w-[420px]'} max-w-full rounded-2xl p-8

      /* Mobile Fullscreen */
      max-sm:w-full
      max-sm:h-full
      max-sm:rounded-none
      max-sm:p-5
    `}
      >
        {/* Mobile Header (Close Button) */}
        <div className="flex justify-end items-center mb-2">
          <button onClick={onClose} className="flex justify-end sm:hidden">
            <img src={closeIcon} alt="Close Icon" className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Icon */}
          {icon && (
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 flex items-center justify-center ">
                <img src={icon} alt="Modal Icon" />
              </div>
            </div>
          )}

          {/* Title */}
          <h2
            className="text-center font-medium text-xs md:text-lg"
            style={{ color: '#2e1e91' }}
          >
            {title}
          </h2>

          {hasSections ? (
            /* ---- SECTIONS MODE ---- */
            <div className="mt-4 space-y-5 sm:max-h-[350px] sm:overflow-y-auto sm:overflow-x-hidden sm:pr-2">
              {(() => {
                const firstChangeIdx = sections.findIndex(s => !!s.onChange);
                return sections.map((section, sIdx) => (
                  <div key={sIdx}>
                    {/* Section header: title + Change button (shown once, on the first section with onChange) */}
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-black-500">
                        {section.title}
                      </p>
                      {sIdx === firstChangeIdx && (
                        <button
                          onClick={() => {
                            section.onChange?.();
                            onClose();
                          }}
                          className="flex items-center gap-1 text-sm text-purple-700 border border-gray-200 font-medium rounded-lg px-2 py-1 hover:bg-purple-50 cursor-pointer"
                        >
                          <img
                            src={changeIcon}
                            alt="Change Icon"
                            className="w-4 h-4"
                          />
                          <h2
                            className="text-center text-xs"
                            style={{ color: '#2e1e91' }}
                          >
                            Change
                          </h2>
                        </button>
                      )}
                    </div>

                    {/* Section items */}
                    <div className="mt-2 space-y-2">
                      {section.items.map((item, iIdx) => {
                        if (item.type === 'labelValue') {
                          const isChild = 'isChild' in item && item.isChild;
                          return (
                            <div
                              key={iIdx}
                              className={`${isChild ? (size === 'lg' ? 'ml-6 grid grid-cols-[0px_200px_1fr] gap-4 ' : 'ml-6 grid grid-cols-[0px_120px_1fr] gap-2 ') : size === 'lg' ? 'grid grid-cols-[0px_240px_260px] gap-4 ' : 'grid grid-cols-[0px_150px_1fr] gap-2 '}items-center text-sm w-full`}
                            >
                              <span className="text-gray-500 font-bold">
                                &#8226;
                              </span>
                              <span className="text-gray-500 font-medium">
                                {item.label}
                              </span>
                              <span className="break-words">
                                {item.value ? (
                                  <span className="text-gray-900">
                                    {String(item.value)}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    No information
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        }

                        if (item.type === 'subheading') {
                          return (
                            <div key={iIdx} className="ml-1">
                              <p className="text-sm text-gray-600 font-medium mt-1">
                                {item.heading}:
                              </p>
                              <div className="ml-3 mt-1 space-y-1">
                                {item.values.map((val, vIdx) => (
                                  <div
                                    key={vIdx}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <span className="text-gray-500 font-bold mt-0.5">
                                      &#8226;
                                    </span>
                                    <span className="text-gray-900">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            /* ---- LEGACY FLAT MODE ---- */
            <>
              {/* Description + Change */}
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm font-bold text-black-500">
                  {description}
                </p>

                {onChange && (
                  <button
                    onClick={onChange}
                    className="flex items-center gap-1 text-sm text-purple-700 border border-gray-200 font-medium rounded-lg px-2 py-1 hover:bg-purple-50 cursor-pointer"
                  >
                    <img
                      src={changeIcon}
                      alt="Change Icon"
                      className="w-4 h-4"
                    />
                    <h2
                      className="text-center text-xs"
                      style={{ color: '#2e1e91' }}
                    >
                      Change
                    </h2>
                  </button>
                )}
              </div>

              {/* Items Proper Alignment */}
              <div
                className={`mt-4 space-y-3 ${
                  items.length > 7
                    ? 'sm:max-h-[250px] sm:overflow-y-auto sm:pr-2'
                    : ''
                }`}
              >
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[0px_150px_1fr] items-center gap-4 text-sm w-full"
                  >
                    {/* Bullet */}
                    <span className="text-gray-500 font-bold">•</span>

                    {/* Label Fixed Width */}
                    <span className="text-gray-500 font-medium">
                      {item.label}
                    </span>

                    {/* Value Always Right */}
                    <span className="break-words">
                      {item.value ? (
                        <span className="text-gray-900">
                          {String(item.value)}
                        </span>
                      ) : (
                        <span className="text-gray-500">No information</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="mt-3 border-b border-gray-200" />

        {/* Footer Buttons Fixed */}
        <div className="mt-6 flex justify-center gap-4 max-sm:mt-auto max-sm:pb-6">
          <Button
            variant="primarylight"
            size="sm"
            type="button"
            onClick={onClose}
          >
            <span className="mx-auto w-full font-semibold text-base">
              {cancelText}
            </span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={onConfirm}
            rightIcon={<img src={iconRightArrow} />}
          >
            <span className="mx-auto w-full font-semibold text-base">
              {confirmText}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
