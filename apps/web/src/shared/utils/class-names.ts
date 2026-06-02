// CSS 모듈 클래스 조합 공용 헬퍼.
// 기존에 컴포넌트마다 중복 정의하던 cn/cx를 한 곳으로 모은다.

/** CSS 모듈 클래스(`string | undefined`)를 안전한 className 문자열로 변환한다. */
export function cn(value: string | undefined): string {
  return value ?? '';
}

/** 조건부 클래스 목록을 공백으로 합친다. falsy 값은 제거한다. */
export function cx(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ');
}
