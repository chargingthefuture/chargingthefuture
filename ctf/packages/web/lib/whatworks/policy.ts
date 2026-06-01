// WhatWorks is a single shared, survivor-verified list. Reading is open (including a
// redacted public projection); suggesting and endorsing require an authenticated survivor;
// curating problems and moderating suggestions require an admin.

export function canSuggestProduct(userId: string | null): boolean {
  return !!userId;
}

export function canEndorseProduct(userId: string | null): boolean {
  return !!userId;
}

export function canModerateProducts(isAdmin: boolean): boolean {
  return isAdmin;
}

export function canManageProblems(isAdmin: boolean): boolean {
  return isAdmin;
}
