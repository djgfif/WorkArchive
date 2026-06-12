const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;
const JONGSEONG_COUNT = 28;
const JONGSEONG_RIEUL = 8;

type ParticlePair = '을/를' | '이/가' | '은/는' | '과/와' | '으로/로';

const PARTICLES: Record<
  ParticlePair,
  { withBatchim: string; withoutBatchim: string; fallback: string }
> = {
  '을/를': { withBatchim: '을', withoutBatchim: '를', fallback: '을(를)' },
  '이/가': { withBatchim: '이', withoutBatchim: '가', fallback: '이(가)' },
  '은/는': { withBatchim: '은', withoutBatchim: '는', fallback: '은(는)' },
  '과/와': { withBatchim: '과', withoutBatchim: '와', fallback: '과(와)' },
  '으로/로': { withBatchim: '으로', withoutBatchim: '로', fallback: '(으)로' },
};

function getJongseongIndex(word: string): number | null {
  const trimmed = word.trimEnd();
  const lastChar = trimmed[trimmed.length - 1];

  if (!lastChar) {
    return null;
  }

  const code = lastChar.charCodeAt(0);

  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) {
    return null;
  }

  return (code - HANGUL_SYLLABLE_START) % JONGSEONG_COUNT;
}

/**
 * 단어의 마지막 글자 받침 유무에 맞는 조사를 고른다.
 * 마지막 글자가 한글 음절이 아니면(라틴·숫자·기호) 발음을 단정할 수 없으므로
 * "을(를)" 형태의 병기 표기로 폴백한다.
 */
export function getKoreanParticle(word: string, pair: ParticlePair): string {
  const jongseong = getJongseongIndex(word);
  const particle = PARTICLES[pair];

  if (jongseong === null) {
    return particle.fallback;
  }

  if (pair === '으로/로') {
    return jongseong !== 0 && jongseong !== JONGSEONG_RIEUL
      ? particle.withBatchim
      : particle.withoutBatchim;
  }

  return jongseong !== 0 ? particle.withBatchim : particle.withoutBatchim;
}

/** 단어 뒤에 알맞은 조사를 붙여 돌려준다. 예: withKoreanParticle('시점', '을/를') → '시점을' */
export function withKoreanParticle(word: string, pair: ParticlePair): string {
  return `${word}${getKoreanParticle(word, pair)}`;
}
