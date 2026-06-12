export function summarizeAuthSessionUserAgent(value: string | null) {
  if (!value) {
    return null;
  }

  if (!/[()/]/.test(value) && value.length <= 80) {
    return value;
  }

  const browser = value.includes('Edg/')
    ? 'Edge'
    : value.includes('Chrome/')
      ? 'Chrome'
      : value.includes('Firefox/')
        ? 'Firefox'
        : value.includes('Safari/')
          ? 'Safari'
          : 'Browser';
  const os = value.includes('Windows')
    ? 'Windows'
    : value.includes('Android')
      ? 'Android'
      : value.includes('iPhone') || value.includes('iPad')
        ? 'iOS'
        : value.includes('Mac OS X')
          ? 'macOS'
          : value.includes('Linux')
            ? 'Linux'
            : null;

  return [browser, os].filter(Boolean).join(' on ');
}

export function maskAuthSessionIpAddress(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.includes(':')) {
    const segments = value.split(':').filter(Boolean);

    return segments.length > 1
      ? `${segments.slice(0, 2).join(':')}:...`
      : `${value.slice(0, 6)}...`;
  }

  const parts = value.split('.');

  if (parts.length === 4) {
    return `${parts.slice(0, 3).join('.')}.x`;
  }

  return 'masked';
}
