declare const __CAPYGAME_VERSION__: string | undefined;

export const CAPYGAME_VERSION: string =
  typeof __CAPYGAME_VERSION__ !== 'undefined' && __CAPYGAME_VERSION__.trim().length > 0
    ? __CAPYGAME_VERSION__.trim()
    : '1.5.0';

export function formatAppVersionLabel(version: string = CAPYGAME_VERSION): string {
  const clean = version.trim().replace(/^v/i, '');
  return `v${clean || '1.5.0'}`;
}
