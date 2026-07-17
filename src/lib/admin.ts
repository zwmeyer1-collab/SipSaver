export const ADMIN_EMAIL = "zwmeyer1@gmail.com";

export function isAdmin(email: string | undefined) {
  return email === ADMIN_EMAIL;
}
