import { Package } from 'lucide-react';

interface OsrsItemIconProps {
  readonly icon: string | undefined;
  readonly name: string;
  readonly className: string;
}

export function OsrsItemIcon({ icon, name, className }: OsrsItemIconProps) {
  const iconUrl = icon
    ? `https://oldschool.runescape.wiki/images/${encodeURIComponent(icon.replaceAll(' ', '_'))}`
    : undefined;

  return (
    <span
      aria-label={`Icône de ${name}`}
      className={`relative flex items-center justify-center ${className}`}
      role="img"
    >
      <Package aria-hidden="true" size={16} />
      {iconUrl && (
        <img
          alt=""
          className="absolute inset-0 size-full object-contain p-1"
          loading="lazy"
          onError={(event) => event.currentTarget.remove()}
          src={iconUrl}
        />
      )}
    </span>
  );
}
