// GTIN (EAN-13) der Schweizer Arzneimittelpackungen: 7680 + Zulassungsnummer (5) + Packungscode (3) + Prüfziffer.

export function gtinCheckDigit(first12: string) {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) sum += Number(first12[index]) * (index % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidGtin(value: string) {
  return /^[0-9]{13}$/.test(value) && gtinCheckDigit(value.slice(0, 12)) === value[12];
}

export function swissGtin(authorizationNumber: string, packageCode: string) {
  const base = `7680${authorizationNumber.padStart(5, "0")}${packageCode.padStart(3, "0")}`;
  return /^[0-9]{12}$/.test(base) ? base + gtinCheckDigit(base) : null;
}
