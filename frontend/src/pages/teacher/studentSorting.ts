const vietnameseNameCollator = new Intl.Collator('vi');

export function sortByVietnameseName<T>(
  items: readonly T[],
  getName: (item: T) => string,
): T[] {
  const lastNameToken = (name: string) => {
    const words = name.trim().split(/\s+/);
    return words[words.length - 1] ?? '';
  };
  return [...items].sort((first, second) => {
    const firstName = getName(first).trim();
    const secondName = getName(second).trim();
    return vietnameseNameCollator.compare(lastNameToken(firstName), lastNameToken(secondName))
      || vietnameseNameCollator.compare(firstName, secondName);
  });
}
