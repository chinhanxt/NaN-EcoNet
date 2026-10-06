const normalize = (value: string) => value.toLocaleLowerCase('vi')
  .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');

/** A highlighted phrase can span several word-boundary caption tokens. */
export const isKeywordToken = (text: string, keyword?: string): boolean => {
  const token = normalize(text);
  return !!token && !!keyword?.split(/\s+/u).some((word) => normalize(word) === token);
};
