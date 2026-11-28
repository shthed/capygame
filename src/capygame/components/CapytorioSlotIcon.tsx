import React from 'react';
import type { CapytorioItemShape, CapytorioMachineType } from '../engine/CapytorioData';

interface CapytorioMachineIconProps {
  machineType: CapytorioMachineType;
  variantItemId?: string;
  color: string;
  size?: number;
  className?: string;
}

export const CapytorioMachineIcon: React.FC<CapytorioMachineIconProps> = ({
  machineType,
  variantItemId,
  color,
  size = 28,
  className = '',
}) => {
  if (variantItemId) {
    switch (variantItemId) {
      case 'small_electric_pole':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="10.4" y="4.5" width="3.2" height="16.5" rx="0.8" fill="#8b5a2b" stroke="#111317" strokeWidth="1.3" />
            <rect x="5" y="7" width="14" height="2.4" rx="0.6" fill="#a4713c" stroke="#111317" strokeWidth="1.1" />
            <circle cx="6.8" cy="6.2" r="1.4" fill="#e2e8f0" stroke="#111317" strokeWidth="0.9" />
            <circle cx="17.2" cy="6.2" r="1.4" fill="#e2e8f0" stroke="#111317" strokeWidth="0.9" />
            <path d="M5 18.5H19" stroke="#3a3f4a" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        );
      case 'medium_electric_pole':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M9 20.5L10.8 4H13.2L15 20.5H9Z" fill="#64748b" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M9.6 15.5L14.4 11M14.4 15.5L9.6 11" stroke="#cbd5e1" strokeWidth="1.1" />
            <rect x="4.5" y="6.2" width="15" height="2.1" rx="0.5" fill={color} stroke="#111317" strokeWidth="1" />
            <rect x="6" y="9.8" width="12" height="1.8" rx="0.5" fill="#94a3b8" stroke="#111317" strokeWidth="0.9" />
            <circle cx="6.2" cy="5.5" r="1.3" fill="#38bdf8" stroke="#111317" strokeWidth="0.9" />
            <circle cx="17.8" cy="5.5" r="1.3" fill="#38bdf8" stroke="#111317" strokeWidth="0.9" />
          </svg>
        );
      case 'big_electric_pole':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M7 20.5L10.5 3.5H13.5L17 20.5H14.2L12 13.5L9.8 20.5H7Z" fill="#475569" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M8.5 15H15.5M9.5 10.5H14.5" stroke="#cbd5e1" strokeWidth="1.1" />
            <rect x="3" y="6.5" width="18" height="2.2" rx="0.5" fill={color} stroke="#111317" strokeWidth="1" />
            <circle cx="4.8" cy="9.6" r="1.3" fill="#e2e8f0" stroke="#111317" strokeWidth="0.9" />
            <circle cx="19.2" cy="9.6" r="1.3" fill="#e2e8f0" stroke="#111317" strokeWidth="0.9" />
            <circle cx="8" cy="5.4" r="1.1" fill="#38bdf8" />
            <circle cx="16" cy="5.4" r="1.1" fill="#38bdf8" />
          </svg>
        );
      case 'substation':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="9" width="17" height="11" rx="1.2" fill="#2c323d" stroke="#111317" strokeWidth="1.4" />
            <path d="M6.5 11V18M9.5 11V18M14.5 11V18M17.5 11V18" stroke="#64748b" strokeWidth="1.4" />
            <rect x="6" y="4.5" width="2.8" height="4.8" rx="0.6" fill="#38bdf8" stroke="#111317" strokeWidth="1" />
            <rect x="10.6" y="4.5" width="2.8" height="4.8" rx="0.6" fill="#38bdf8" stroke="#111317" strokeWidth="1" />
            <rect x="15.2" y="4.5" width="2.8" height="4.8" rx="0.6" fill="#38bdf8" stroke="#111317" strokeWidth="1" />
            <path d="M5.5 6.2H18.5" stroke="#ea580c" strokeWidth="1.5" />
          </svg>
        );
      case 'stone_wall':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M3.5 9V5.5H7.5V8H10.2V5.5H13.8V8H16.5V5.5H20.5V19.5H3.5V9Z" fill="#7c8594" stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M3.5 12H20.5M3.5 15.8H20.5M9.5 12V15.8M15 12V15.8M12 15.8V19.5" stroke="#374151" strokeWidth="1.2" />
          </svg>
        );
      case 'gate':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="4.5" width="4" height="15.5" rx="0.8" fill="#475569" stroke="#111317" strokeWidth="1.3" />
            <rect x="16.5" y="4.5" width="4" height="15.5" rx="0.8" fill="#475569" stroke="#111317" strokeWidth="1.3" />
            <rect x="7.5" y="7" width="9" height="11" fill="#334155" stroke="#111317" strokeWidth="1.2" />
            <path d="M7.5 15.5H16.5" stroke="#facc15" strokeWidth="2.2" />
            <path d="M12 7V18" stroke="#111317" strokeWidth="1.3" />
          </svg>
        );
      case 'gun_turret':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="5" y="14.5" width="14" height="5.5" rx="1.2" fill="#334155" stroke="#111317" strokeWidth="1.4" />
            <rect x="6.5" y="8" width="11" height="7" rx="1.5" fill={color} stroke="#111317" strokeWidth="1.3" />
            <rect x="9.2" y="3.2" width="2.2" height="5.5" rx="0.5" fill="#cbd5e1" stroke="#111317" strokeWidth="1" />
            <rect x="12.6" y="3.2" width="2.2" height="5.5" rx="0.5" fill="#cbd5e1" stroke="#111317" strokeWidth="1" />
            <circle cx="12" cy="11.5" r="1.8" fill="#1e293b" />
          </svg>
        );
      case 'laser_turret':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="5.5" y="14.5" width="13" height="5.5" rx="1.2" fill="#2c3038" stroke="#111317" strokeWidth="1.4" />
            <polygon points="8,14.5 12,6.5 16,14.5" fill="#475569" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <circle cx="12" cy="7.5" r="3.4" fill="#fb7185" stroke="#111317" strokeWidth="1.2" />
            <circle cx="12" cy="7.5" r="1.4" fill="#fff1f2" />
            <path d="M12 2.2V4.1M7 4.5L8.4 5.6M17 4.5L15.6 5.6" stroke="#f43f5e" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        );
      case 'solar_panel':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <polygon points="4.5,6 19.5,6 21,17.5 3,17.5" fill="#1d4ed8" stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8.5 6L7.5 17.5M12 6V17.5M15.5 6L16.5 17.5M4 10H20M3.5 14H20.5" stroke="#93c5fd" strokeWidth="1" opacity="0.85" />
            <rect x="9.5" y="17.5" width="5" height="2.8" fill="#475569" stroke="#111317" strokeWidth="1.1" />
          </svg>
        );
      case 'accumulator':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="5" y="6" width="14" height="14" rx="2.2" fill="#2b313c" stroke="#111317" strokeWidth="1.4" />
            <rect x="7" y="9" width="10" height="2.2" rx="0.8" fill="#38bdf8" />
            <rect x="7" y="13.5" width="10" height="2.2" rx="0.8" fill="#38bdf8" />
            <rect x="7.5" y="3.5" width="2.8" height="3" rx="0.5" fill="#f59e0b" stroke="#111317" strokeWidth="1" />
            <rect x="13.7" y="3.5" width="2.8" height="3" rx="0.5" fill="#f59e0b" stroke="#111317" strokeWidth="1" />
          </svg>
        );
      case 'nuclear_reactor':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="#374151" stroke="#111317" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="5" fill="#10b981" stroke="#111317" strokeWidth="1.3" />
            <circle cx="12" cy="12" r="2.2" fill="#a7f3d0" />
            <path d="M5 6H7.5M16.5 6H19M5 18H7.5M16.5 18H19" stroke="#facc15" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case 'steam_turbine':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3" y="7" width="18" height="10" rx="2.5" fill="#475569" stroke="#111317" strokeWidth="1.4" />
            <path d="M7.5 7V17M11 7V17M14.5 7V17" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x="16" y="8.5" width="3.5" height="7" rx="0.8" fill={color} />
            <rect x="5" y="4.5" width="5" height="2.8" rx="0.6" fill="#ea580c" stroke="#111317" strokeWidth="1" />
          </svg>
        );
      case 'pumpjack':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="16.5" width="17" height="3.2" rx="0.8" fill="#1e293b" stroke="#111317" strokeWidth="1.2" />
            <path d="M9 16.5L12 7.5L15 16.5" stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M5 9.5L18.5 5.2" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M5 9.5V16.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="18.2" cy="5.4" r="2.1" fill="#475569" stroke="#111317" strokeWidth="1.1" />
            <circle cx="5" cy="17.8" r="1.5" fill="#6d28d9" />
          </svg>
        );
      case 'centrifuge':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="14.5" rx="2" fill="#27313d" stroke="#111317" strokeWidth="1.4" />
            <circle cx="8.5" cy="12.2" r="3.4" fill="#15803d" stroke="#111317" strokeWidth="1.1" />
            <circle cx="15.5" cy="12.2" r="3.4" fill="#15803d" stroke="#111317" strokeWidth="1.1" />
            <circle cx="8.5" cy="12.2" r="1.4" fill="#86efac" />
            <circle cx="15.5" cy="12.2" r="1.4" fill="#86efac" />
            <path d="M5.5 7H18.5" stroke="#4ade80" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        );
      case 'offshore_pump':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M3 17C5.5 15.5 8 18.5 10.5 17C13 15.5 15.5 18.5 21 17V20H3V17Z" fill="#0ea5e9" opacity="0.85" />
            <rect x="6" y="7" width="11" height="9" rx="1.8" fill={color} stroke="#111317" strokeWidth="1.3" />
            <path d="M12 7V4.2H17.5" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11.5" cy="11.5" r="2.2" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1" />
          </svg>
        );
      case 'beacon':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="4" y="13.5" width="16" height="6.5" rx="1.2" fill="#334155" stroke="#111317" strokeWidth="1.4" />
            <ellipse cx="12" cy="9.5" rx="6.2" ry="2.6" stroke="#38bdf8" strokeWidth="1.6" />
            <ellipse cx="12" cy="9.5" rx="3.4" ry="5.2" stroke={color} strokeWidth="1.4" />
            <circle cx="12" cy="9.5" r="2.1" fill="#38bdf8" stroke="#111317" strokeWidth="1" />
          </svg>
        );
      case 'radar':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M6.5 20L10 13H14L17.5 20H6.5Z" fill="#3f4654" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6 7.5C8.5 4.2 14.5 4.2 18 8.2L12.2 13.5L6 7.5Z" fill="#cbd5e1" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M12 8.2L15.5 4.5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="15.8" cy="4.2" r="1.4" fill="#38bdf8" />
          </svg>
        );
      case 'rocket_silo':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="1.6" fill="#475569" stroke="#111317" strokeWidth="1.4" />
            <rect x="5" y="6" width="14" height="12" rx="1" fill="#181c24" stroke="#facc15" strokeWidth="1.2" />
            <path d="M12 6.8L14.6 11.2V15.5H9.4V11.2L12 6.8Z" fill="#e2e8f0" stroke="#111317" strokeWidth="1" />
            <path d="M9.4 13.5L7.6 16H9.4M14.6 13.5L16.4 16H14.6" fill="#ef4444" stroke="#111317" strokeWidth="0.9" />
          </svg>
        );
      case 'pipe':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="8.5" y="3.5" width="7" height="17" rx="1" fill="#64748b" stroke="#111317" strokeWidth="1.3" />
            <rect x="3.5" y="8.5" width="17" height="7" rx="1" fill="#94a3b8" stroke="#111317" strokeWidth="1.3" />
            <circle cx="12" cy="12" r="2.6" fill={color} stroke="#111317" strokeWidth="1" />
          </svg>
        );
      case 'pipe_to_ground':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M6.5 18.5V10.5C6.5 7.5 9 5.5 12 5.5H18V11.5H13.5V18.5H6.5Z" fill="#94a3b8" stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
            <rect x="4.5" y="16.5" width="11" height="3" rx="0.7" fill={color} stroke="#111317" strokeWidth="1.1" />
            <path d="M12 13V16" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        );
      case 'pump':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="4" y="7" width="16" height="10" rx="2.5" fill="#334155" stroke="#111317" strokeWidth="1.4" />
            <circle cx="12" cy="12" r="4" fill={color} stroke="#111317" strokeWidth="1.2" />
            <path d="M10.5 10L14 12L10.5 14V10Z" fill="#e2e8f0" />
          </svg>
        );
      case 'oil_refinery':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="4" y="14" width="16" height="6" rx="1" fill="#334155" stroke="#111317" strokeWidth="1.3" />
            <rect x="5.5" y="5" width="4.2" height="10" rx="1.2" fill="#94a3b8" stroke="#111317" strokeWidth="1.2" />
            <rect x="11" y="7.5" width="3.8" height="7.5" rx="1" fill={color} stroke="#111317" strokeWidth="1.2" />
            <rect x="16" y="4" width="2.4" height="11" rx="0.6" fill="#475569" stroke="#111317" strokeWidth="1.1" />
            <circle cx="17.2" cy="3.2" r="1.4" fill="#f97316" />
          </svg>
        );
      case 'chemical_plant':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="14.5" width="17" height="5.5" rx="1" fill="#334155" stroke="#111317" strokeWidth="1.3" />
            <rect x="5" y="6.5" width="5.5" height="8.5" rx="2" fill="#38bdf8" stroke="#111317" strokeWidth="1.2" />
            <rect x="13.5" y="6.5" width="5.5" height="8.5" rx="2" fill={color} stroke="#111317" strokeWidth="1.2" />
            <path d="M10.5 9.5H13.5" stroke="#e2e8f0" strokeWidth="1.8" />
          </svg>
        );
      case 'rail':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M4.5 6.5H19.5M4.5 10.2H19.5M4.5 13.8H19.5M4.5 17.5H19.5" stroke="#8b5a2b" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M7.5 3.5V20.5M16.5 3.5V20.5" stroke="#cbd5e1" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        );
      case 'train_stop':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="4" y="16" width="16" height="4" rx="0.8" fill="#475569" stroke="#111317" strokeWidth="1.3" />
            <rect x="9.5" y="6.5" width="3" height="10" fill="#cbd5e1" stroke="#111317" strokeWidth="1.1" />
            <rect x="7" y="3.5" width="11" height="5" rx="1" fill={color} stroke="#111317" strokeWidth="1.2" />
            <circle cx="9.8" cy="6" r="1.1" fill="#4ade80" />
            <circle cx="14.2" cy="6" r="1.1" fill="#facc15" />
          </svg>
        );
      case 'locomotive':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <path d="M3.5 10.5L6.5 7H19.5V16.5H3.5V10.5Z" fill={color} stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
            <rect x="6.5" y="9" width="4.2" height="3.2" rx="0.5" fill="#bae6fd" stroke="#111317" strokeWidth="0.9" />
            <rect x="12.5" y="8.8" width="5" height="3.5" rx="0.5" fill="#334155" />
            <circle cx="7.2" cy="17.5" r="2.1" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="16.2" cy="17.5" r="2.1" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
          </svg>
        );
      case 'cargo_wagon':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="7" width="17" height="9.5" rx="1.2" fill={color} stroke="#111317" strokeWidth="1.4" />
            <path d="M8.5 7V16.5M15.5 7V16.5M3.5 11.5H20.5" stroke="#1e293b" strokeWidth="1.2" />
            <circle cx="7.5" cy="17.5" r="2.1" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="16.5" cy="17.5" r="2.1" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
          </svg>
        );
      case 'roboport':
        return (
          <svg width={size} height={size} viewBox="1.5 1.5 21 21" fill="none" className={className} aria-hidden="true">
            <rect x="3.5" y="9.5" width="17" height="10.5" rx="1.5" fill="#334155" stroke="#111317" strokeWidth="1.4" />
            <rect x="6.5" y="13.5" width="11" height="5" rx="0.8" fill="#0f172a" stroke="#facc15" strokeWidth="1.1" />
            <circle cx="8" cy="7" r="2.1" fill="#38bdf8" stroke="#111317" strokeWidth="1" />
            <circle cx="16" cy="7" r="2.1" fill="#f59e0b" stroke="#111317" strokeWidth="1" />
            <path d="M12 4V9.5" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="4" r="1.4" fill="#38bdf8" />
          </svg>
        );
      default:
        break;
    }
  }

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
    case 'battery':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="5.5" y="6.5" width="13" height="13" rx="1.6" fill={color} stroke="#111317" strokeWidth="1.4" />
          <rect x="7.5" y="4" width="3" height="2.8" rx="0.5" fill="#e2e8f0" stroke="#111317" strokeWidth="1" />
          <rect x="13.5" y="4" width="3" height="2.8" rx="0.5" fill="#f59e0b" stroke="#111317" strokeWidth="1" />
          <path d="M12.5 9.2L10 13.2H12L11.2 16.8L14.2 12.6H12.1L12.5 9.2Z" fill="#fef08a" stroke="#111317" strokeWidth="0.7" />
        </svg>
      );
    case 'ammo':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <path d="M5.5 18.5L7.2 7.5H16.8L18.5 18.5H5.5Z" fill="#334155" stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8.5 7.5L9.5 4.2L10.5 7.5M11.5 7.5L12 4L12.5 7.5M13.5 7.5L14.5 4.2L15.5 7.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="7.5" y="11" width="9" height="4" rx="0.6" fill={color} stroke="#111317" strokeWidth="1" />
        </svg>
      );
    case 'grenade':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <circle cx="11.5" cy="13.5" r="5.6" fill={color} stroke="#111317" strokeWidth="1.4" />
          <path d="M7.5 11.5H15.5M7.5 15.5H15.5M11.5 8V19" stroke="#111317" strokeWidth="1" opacity="0.5" />
          <rect x="9.8" y="5.5" width="3.4" height="2.6" rx="0.5" fill="#94a3b8" stroke="#111317" strokeWidth="1" />
          <path d="M13.2 6.2H16.5L18 11.5" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8" cy="6.2" r="1.4" stroke="#facc15" strokeWidth="1.1" />
        </svg>
      );
    case 'armor':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <path d="M6.5 6.5L9.5 4.8H14.5L17.5 6.5L19.5 10L16.8 11.8L16 19H8L7.2 11.8L4.5 10L6.5 6.5Z" fill={color} stroke="#111317" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9.5 8.5H14.5V13.5L12 15.5L9.5 13.5V8.5Z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.9" />
        </svg>
      );
    case 'engine':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="9" width="14" height="9" rx="1.4" fill={color} stroke="#111317" strokeWidth="1.4" />
          <path d="M7 9L9 5.5H11.5V9M17 9L15 5.5H12.5V9" fill="#94a3b8" stroke="#111317" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="12" cy="13.5" r="2.6" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.1" />
        </svg>
      );
    case 'barrel':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="4.5" width="12" height="15" rx="2" fill={color} stroke="#111317" strokeWidth="1.4" />
          <path d="M5.5 9.2H18.5M5.5 14.8H18.5" stroke="#1e293b" strokeWidth="1.8" />
          <path d="M6.5 7.5H17.5" stroke="#ffffff" strokeWidth="1" opacity="0.35" />
        </svg>
      );
    case 'brick':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <polygon points="4,13.5 9.5,7.5 20,7.5 14.5,13.5" fill={color} stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="4,13.5 14.5,13.5 14.5,17.5 4,17.5" fill={color} stroke="#111317" strokeWidth="1.3" strokeLinejoin="round" />
          <polygon points="14.5,13.5 20,7.5 20,11.5 14.5,17.5" fill="#1b1d22" opacity="0.45" stroke="#111317" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'module':
      return (
        <svg width={size} height={size} viewBox="2 2 20 20" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="4.5" width="14" height="15" rx="1.6" fill="#232730" stroke="#111317" strokeWidth="1.4" />
          <rect x="7.5" y="7" width="9" height="8" rx="1" fill={color} stroke="#111317" strokeWidth="1.1" />
          <path d="M8 17.5H10M11 17.5H13M14 17.5H16" stroke="#facc15" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="11" r="1.8" fill="#ffffff" opacity="0.7" />
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
  variantItemId?: string;
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

export const CapytorioSlotTile: React.FC<CapytorioSlotTileProps> = React.memo(({
  label,
  title,
  suppressNativeTitle = false,
  count,
  hotkey,
  selected = false,
  dimmed = false,
  accent = 'none',
  machineType,
  variantItemId,
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
          <CapytorioMachineIcon
            machineType={machineType}
            variantItemId={variantItemId}
            color={color}
            size={iconSize}
          />
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
});
