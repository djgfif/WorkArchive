import styles from '../ArchiveComponents.module.css';

export const css = styles as Record<string, string>;

export function cn(value: string | undefined) {
  return value ?? '';
}

export function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
