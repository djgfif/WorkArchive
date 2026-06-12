import { describe, expect, it } from 'vitest';

import { getKoreanParticle, withKoreanParticle } from './korean-particle';

describe('getKoreanParticle', () => {
  it('받침이 있으면 을/이/은/과를 고른다', () => {
    expect(getKoreanParticle('시점', '을/를')).toBe('을');
    expect(getKoreanParticle('칼날', '이/가')).toBe('이');
    expect(getKoreanParticle('거인', '은/는')).toBe('은');
    expect(getKoreanParticle('무빙', '과/와')).toBe('과');
  });

  it('받침이 없으면 를/가/는/와를 고른다', () => {
    expect(getKoreanParticle('레벨업하기', '을/를')).toBe('를');
    expect(getKoreanParticle('치히로', '이/가')).toBe('가');
    expect(getKoreanParticle('오버로드', '은/는')).toBe('는');
    expect(getKoreanParticle('소드 아트 온라인', '과/와')).toBe('과');
  });

  it('으로/로는 ㄹ 받침을 모음처럼 다룬다', () => {
    expect(getKoreanParticle('시점', '으로/로')).toBe('으로');
    expect(getKoreanParticle('칼날', '으로/로')).toBe('로');
    expect(getKoreanParticle('치히로', '으로/로')).toBe('로');
  });

  it('마지막 글자가 한글이 아니면 병기 표기로 폴백한다', () => {
    expect(getKoreanParticle('Dune', '을/를')).toBe('을(를)');
    expect(getKoreanParticle('86', '이/가')).toBe('이(가)');
    expect(getKoreanParticle('', '을/를')).toBe('을(를)');
  });

  it('끝 공백을 무시하고 판별한다', () => {
    expect(getKoreanParticle('시점 ', '을/를')).toBe('을');
  });
});

describe('withKoreanParticle', () => {
  it('단어에 조사를 붙인다', () => {
    expect(withKoreanParticle('전지적 독자 시점', '을/를')).toBe(
      '전지적 독자 시점을',
    );
    expect(withKoreanParticle('나 혼자만 레벨업', '을/를')).toBe(
      '나 혼자만 레벨업을',
    );
  });
});
