import { Package } from 'lucide-react';
import { useState } from 'react';

interface OsrsItemIconProps {
  readonly icon: string | undefined;
  readonly name: string;
  readonly className: string;
}

export function OsrsItemIcon({ icon, name, className }: OsrsItemIconProps) {
  const [failedIconUrl, setFailedIconUrl] = useState<string | null>(null);
  const iconUrl = icon
    ? `https://oldschool.runescape.wiki/images/${encodeURIComponent(icon.replaceAll(' ', '_'))}`
    : undefined;
  const imageFailed = iconUrl !== undefined && failedIconUrl === iconUrl;

  return (
    <span
      aria-label={`Icône de ${name}`}
      className={`relative flex items-center justify-center ${className}`}
      role="img"
    >
      {(!iconUrl || imageFailed) && <Package aria-hidden="true" size={16} />}
      {iconUrl && !imageFailed && (
        <img
          alt=""
          className="absolute inset-0 size-full object-contain p-1"
          loading="lazy"
          onError={() => setFailedIconUrl(iconUrl ?? null)}
          src={iconUrl}
        />
      )}
    </span>
  );
}
