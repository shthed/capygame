import React from 'react';
import type { CapytorioItemShape, CapytorioMachineType } from '../engine/CapytorioData';

interface CapytorioMachineIconProps {
  machineType: CapytorioMachineType;
  color: string;
  size?: number;
  className?: string;
}

export const CapytorioMachineIcon: React.FC<CapytorioMachineIconProps> = ({
  machineType,
  color,
  size = 28,
  className = '',
}) => {
  switch (machineType) {
    case 'drill':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="4" width="16" height="10" rx="1.5" fill="#2c3038" stroke="#111317" strokeWidth="1.4" />
          <rect x="6" y="6" width="12" height="5" fill={color} />
          <path d="M9 14H15L13 21H11L9 14Z" fill="#d4d7de" stroke="#111317" strokeWidth="1.2" />
          <path d="M9.6 16.5H14.4M10.4 18.8H13.6" stroke="#1f2228" strokeWidth="1.2" />
          <rect x="3" y="12" width="3" height="5" rx="0.8" fill="#4f5460" />
          <rect x="18" y="12" width="3" height="5" rx="0.8" fill="#4f5460" />
        </svg>
      );
    case 'belt':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="1.5" fill="#252830" stroke="#111317" strokeWidth="1.4" />
          <rect x="3" y="4" width="18" height="2.6" fill={color} />
          <rect x="3" y="17.4" width="18" height="2.6" fill={color} />
          <path d="M7.5 9L11.5 12L7.5 15" stroke={color} strokeWidth="2.1" strokeLinecap="square" />
          <path d="M13.5 9L17.5 12L13.5 15" stroke={color} strokeWidth="2.1" strokeLinecap="square" />
        </svg>
      );
    case 'inserter':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="7" y="15" width="10" height="5" rx="1" fill="#323640" stroke="#111317" strokeWidth="1.4" />
          <circle cx="12" cy="15" r="2.6" fill={color} stroke="#111317" strokeWidth="1.2" />
          <path d="M12 13L7.5 7.5L14.5 4.8" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7.5" cy="7.5" r="1.8" fill="#e5e7eb" stroke="#111317" strokeWidth="1" />
          <path d="M14.5 4.8L18.5 3.6M14.5 4.8L17.6 7.8" stroke="#e5e7eb" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'furnace':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <path d="M5 10C5 6.2 8.1 3.5 12 3.5C15.9 3.5 19 6.2 19 10V20H5V10Z" fill="#464a54" stroke="#111317" strokeWidth="1.4" />
          <rect x="8.5" y="2.5" width="7" height="3" rx="0.8" fill={color} stroke="#111317" strokeWidth="1.1" />
          <path d="M8.5 20V14C8.5 12.1 10.1 10.6 12 10.6C13.9 10.6 15.5 12.1 15.5 14V20H8.5Z" fill="#18191d" />
          <path d="M12 12.3C13.4 13.7 14 15 14 16.4C14 17.6 13.1 18.6 12 18.6C10.9 18.6 10 17.6 10 16.4C10 15 10.6 13.7 12 12.3Z" fill="#f97316" />
          <circle cx="12" cy="16.8" r="1.2" fill="#fde047" />
        </svg>
      );
    case 'assembler':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="3.5" y="4" width="17" height="16" rx="2" fill="#2c3038" stroke="#111317" strokeWidth="1.4" />
          <rect x="5" y="5.5" width="14" height="3.2" fill={color} />
          <circle cx="10" cy="14" r="3.4" stroke="#d4d7de" strokeWidth="1.8" strokeDasharray="2.2 1.2" />
          <circle cx="10" cy="14" r="1.2" fill={color} />
          <circle cx="15.8" cy="12.2" r="2.2" stroke={color} strokeWidth="1.6" strokeDasharray="1.8 1" />
        </svg>
      );
    case 'generator':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="#2c3038" stroke="#111317" strokeWidth="1.4" />
          <rect x="5" y="7" width="3.5" height="10" rx="0.8" fill={color} />
          <rect x="15.5" y="7" width="3.5" height="10" rx="0.8" fill={color} />
          <path d="M13 6.8L9.6 12.6H12.2L11 17.4L14.8 11.4H12.2L13 6.8Z" fill="#facc15" stroke="#111317" strokeWidth="0.9" strokeLinejoin="round" />
        </svg>
      );
    case 'lab':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <path d="M5 15C5 9.8 8.1 5.5 12 5.5C15.9 5.5 19 9.8 19 15H5Z" fill="#293242" stroke="#111317" strokeWidth="1.4" />
          <path d="M8.5 15C8.5 11.6 10.1 8.8 12 8.8C13.9 8.8 15.5 11.6 15.5 15H8.5Z" fill={color} opacity="0.88" />
          <rect x="4" y="15" width="16" height="4.5" rx="1" fill="#3a3f4a" stroke="#111317" strokeWidth="1.3" />
          <circle cx="12" cy="4.2" r="1.5" fill={color} />
        </svg>
      );
    case 'splitter':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="15" rx="1.5" fill="#2b2f37" stroke="#111317" strokeWidth="1.4" />
          <rect x="9.5" y="4.5" width="5" height="15" fill={color} stroke="#111317" strokeWidth="1.1" />
          <path d="M5 12H9M15 8.5H19M15 15.5H19" stroke="#e5e7eb" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17.2 6.8L19.4 8.5L17.2 10.2M17.2 13.8L19.4 15.5L17.2 17.2" stroke="#e5e7eb" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'tunnel':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <path d="M4 18V9C4 6.2 7.6 4.5 12 4.5C16.4 4.5 20 6.2 20 9V18H4Z" fill="#2c3038" stroke="#111317" strokeWidth="1.4" />
          <path d="M6.5 18V11.5C6.5 9.2 9 7.8 12 7.8C15 7.8 17.5 9.2 17.5 11.5V18H6.5Z" fill="#13151a" />
          <rect x="4" y="16" width="16" height="3.2" fill={color} stroke="#111317" strokeWidth="1" />
          <path d="M12 10V15M9.8 13L12 15.3L14.2 13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'chest':
    default:
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="1.5" fill={color} stroke="#111317" strokeWidth="1.4" />
          <rect x="4" y="5" width="16" height="4.2" fill="#343842" opacity="0.55" />
          <path d="M4 9.5H20" stroke="#111317" strokeWidth="1.5" />
          <rect x="10" y="8" width="4" height="3.5" rx="0.6" fill="#f4b054" stroke="#111317" strokeWidth="1" />
          <path d="M6.5 13V16.5M17.5 13V16.5" stroke="#111317" strokeWidth="1.3" opacity="0.6" />
        </svg>
      );
  }
};

interface CapytorioItemIconProps {
  shape: CapytorioItemShape;
  color: string;
  size?: number;
  className?: string;
}

export const CapytorioItemIcon: React.FC<CapytorioItemIconProps> = ({
  shape,
  color,
  size = 28,
  className = '',
}) => {
  switch (shape) {
    case 'ore':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <polygon points="7,17 4.5,11 9.5,6.5 15,8 17.5,14 13,18.5" fill={color} stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
          <polygon points="12.5,18 11,12.5 16,10.5 19.5,14.5 17,18.5" fill={color} stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="9.5,6.5 12,11 7.2,11.5" fill="#ffffff" opacity="0.28" />
        </svg>
      );
    case 'plate':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <polygon points="4,14.5 9,7 20,7.5 15.5,16.5" fill={color} stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
          <polygon points="4,14.5 15.5,16.5 15.5,18.8 4,16.8" fill="#1b1d22" opacity="0.55" />
          <path d="M8.5 9.5L16.5 9.8" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
        </svg>
      );
    case 'gear':
      return (
        <svg width={size} height={size} viewBox="1.2 1.2 21.6 21.6" fill="none" className={className} aria-hidden="true">
          <path
            d="M10.4 3.5H13.6L14.2 6L16.3 6.9L18.4 5.5L20.5 7.6L19.1 9.7L20 11.8L22.5 12.4V15.6L20 16.2L19.1 18.3L20.5 20.4L18.4 22.5L16.3 21.1L14.2 22L13.6 24.5H10.4L9.8 22L7.7 21.1L5.6 22.5L3.5 20.4L4.9 18.3L4 16.2L1.5 15.6V12.4L4 11.8L4.9 9.7L3.5 7.6L5.6 5.5L7.7 6.9L9.8 6L10.4 3.5Z"
            transform="translate(0 -1.5) scale(0.95) translate(0.6 0.6)"
            fill={color}
            stroke="#111317"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.4" fill="#181a1f" stroke="#111317" strokeWidth="1.3" />
        </svg>
      );
    case 'circuit':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="4.5" width="16" height="15" rx="1.5" fill={color} stroke="#111317" strokeWidth="1.4" />
          <rect x="8.5" y="8.5" width="7" height="7" rx="0.8" fill="#1b1d22" stroke="#f4b054" strokeWidth="1.1" />
          <path d="M6.5 7H8.5M15.5 7H17.5M6.5 12H8.5M15.5 12H17.5M6.5 17H8.5M15.5 17H17.5" stroke="#fde047" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'science':
      return (
        <svg width={size} height={size} viewBox="2 1.8 20 20" fill="none" className={className} aria-hidden="true">
          <path d="M9.5 4H14.5V8.5L18.8 17.6C19.3 18.6 18.6 19.8 17.4 19.8H6.6C5.4 19.8 4.7 18.6 5.2 17.6L9.5 8.5V4Z" fill="#20242c" stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7.6 13.5H16.4L18.1 17.8C18.3 18.3 17.9 18.9 17.3 18.9H6.7C6.1 18.9 5.7 18.3 5.9 17.8L7.6 13.5Z" fill={color} />
          <rect x="8.5" y="3" width="7" height="2" rx="0.6" fill="#d4d7de" stroke="#111317" strokeWidth="1" />
          <circle cx="10.5" cy="16.2" r="1" fill="#ffffff" opacity="0.6" />
        </svg>
      );
    case 'coil':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" stroke={color} strokeWidth="3.2" />
          <circle cx="12" cy="12" r="7.5" stroke="#111317" strokeWidth="1" />
          <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2.2" />
          <circle cx="12" cy="12" r="2.2" fill="#181a1f" />
        </svg>
      );
    case 'fruit':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="13.2" r="6.8" fill={color} stroke="#111317" strokeWidth="1.4" />
          <path d="M12 6.5C12.2 4.4 13.8 3.2 16 3.5C15.5 5.4 14 6.6 12 6.5Z" fill="#45b649" stroke="#111317" strokeWidth="1" />
          <circle cx="9.6" cy="11" r="1.6" fill="#ffffff" opacity="0.32" />
        </svg>
      );
    case 'crate':
    default:
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" fill={color} stroke="#111317" strokeWidth="1.4" />
          <path d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" stroke="#111317" strokeWidth="1.3" opacity="0.45" />
          <rect x="7" y="7" width="10" height="10" rx="0.8" stroke="#111317" strokeWidth="1.1" opacity="0.5" />
        </svg>
      );
  }
};

export interface CapytorioWorldIconProps {
  kind: 'tree' | 'beacon' | 'terrain';
  size?: number;
  className?: string;
}

export const CapytorioWorldIcon: React.FC<CapytorioWorldIconProps> = ({
  kind,
  size = 24,
  className = '',
}) => {
  switch (kind) {
    case 'tree':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="10.2" y="14.5" width="3.6" height="6.5" rx="0.8" fill="#7c4a26" stroke="#111317" strokeWidth="1.2" />
          <circle cx="12" cy="10.2" r="6.8" fill="#3da34d" stroke="#111317" strokeWidth="1.4" />
          <circle cx="9.2" cy="9.2" r="1.5" fill="#fb923c" stroke="#111317" strokeWidth="0.9" />
          <circle cx="15" cy="11.2" r="1.5" fill="#fb923c" stroke="#111317" strokeWidth="0.9" />
          <circle cx="12.2" cy="6.6" r="1.3" fill="#facc15" stroke="#111317" strokeWidth="0.9" />
        </svg>
      );
    case 'beacon':
      return (
        <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
          <polygon points="6,20 8,16 16,16 18,20" fill="#3a404c" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
          <rect x="10.6" y="7.5" width="2.8" height="9" fill="#9ca3af" stroke="#111317" strokeWidth="1.1" />
          <ellipse cx="12" cy="9.5" rx="4.8" ry="1.6" stroke="#f4b054" strokeWidth="1.4" />
          <polygon points="12,2.5 15.2,6 12,9.2 8.8,6" fill="#38bdf8" stroke="#111317" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'terrain':
    default:
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" fill="#4f8b47" stroke="#111317" strokeWidth="1.4" />
          <path d="M8 15.5L9.5 10.5M12 16V9.5M16 15.5L14.5 11" stroke="#86ef92" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M4.5 17H19.5" stroke="#2d5a29" strokeWidth="1.2" />
        </svg>
      );
  }
};

export interface CapytorioSlotTileProps {
  label: string;
  title?: string;
  suppressNativeTitle?: boolean;
  count?: number | string;
  hotkey?: string;
  selected?: boolean;
  dimmed?: boolean;
  accent?: 'none' | 'craftable' | 'missing' | 'amber';
  machineType?: CapytorioMachineType;
  itemShape?: CapytorioItemShape;
  color: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLButtonElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLButtonElement>) => void;
  testId?: string;
  recentSlot?: boolean;
  compact?: boolean;
  mini?: boolean;
}

export const CapytorioSlotTile: React.FC<CapytorioSlotTileProps> = ({
  label,
  title,
  suppressNativeTitle = false,
  count,
  hotkey,
  selected = false,
  dimmed = false,
  accent = 'none',
  machineType,
  itemShape = 'crate',
  color,
  onClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  testId,
  recentSlot = false,
  compact = false,
  mini = false,
}) => {
  const isSquareCompact = compact || mini;
  const accentBorder = selected
    ? 'bg-[#3c2a14] border-[#e58926] border-t-[#f6be68] border-l-[#f6be68] shadow-[inset_0_0_0_1px_rgba(229,137,38,0.45)]'
    : accent === 'craftable'
      ? 'bg-[#171a18] hover:bg-[#232924] border-[#2e4c30] border-t-[#111316] border-l-[#111316] border-b-[#45b649]'
      : accent === 'missing'
        ? 'bg-[#171517] hover:bg-[#221d1e] border-[#3c2525] border-t-[#111316] border-l-[#111316] border-b-[#9a352c]'
        : 'bg-[#141619] hover:bg-[#23262d] border-[#0c0d10] border-b-[#3c4049] border-r-[#3c4049]';

  const iconSize = mini ? 30 : compact ? 36 : 30;

  return (
    <button
      type="button"
      data-testid={testId}
      data-capytorio-recent-slot={recentSlot ? 'true' : undefined}
      title={suppressNativeTitle ? undefined : title ?? label}
      aria-label={title ?? label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={`relative select-none rounded-[2px] border flex flex-col items-center justify-center shrink-0 transition-colors overflow-hidden ${
        mini
          ? 'w-9 h-9'
          : compact
            ? 'w-11 h-11'
            : 'w-full h-[52px] px-0.5 pt-0.5 pb-0.5 justify-between'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'} ${accentBorder} ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      {hotkey && (
        <span
          className={`z-10 absolute top-0 left-0 px-[2px] rounded-br-[2px] bg-[#111317]/75 font-mono font-bold leading-[1.05] text-[#d0d5df] ${
            mini ? 'text-[8px]' : 'text-[9px]'
          }`}
        >
          {hotkey}
        </span>
      )}

      <div className="flex items-center justify-center pointer-events-none my-auto">
        {machineType ? (
          <CapytorioMachineIcon machineType={machineType} color={color} size={iconSize} />
        ) : (
          <CapytorioItemIcon shape={itemShape} color={color} size={iconSize} />
        )}
      </div>

      {!isSquareCompact && (
        <span className="z-10 w-full text-center text-[9px] font-medium leading-none truncate text-[#e4e8f0] drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)]">
          {label}
        </span>
      )}

      {count !== undefined && (
        <span
          className={`z-10 absolute ${
            isSquareCompact ? 'bottom-0 right-0' : 'top-0 right-0'
          } px-[2px] rounded-[1px] bg-[#111317]/80 ${
            mini ? 'text-[8.5px]' : 'text-[9.5px]'
          } font-mono font-bold tabular-nums leading-[1.05] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] ${
            selected
              ? 'text-[#ffe4b5]'
              : accent === 'craftable'
                ? 'text-[#6ee772]'
                : accent === 'missing'
                  ? 'text-[#f2857c]'
                  : 'text-[#f4f6f9]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
