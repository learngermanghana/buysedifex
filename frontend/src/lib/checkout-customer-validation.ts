export type CheckoutCustomerDetails = {
  name: string;
  email: string;
  phone: string;
};

export type CheckoutCustomerField = keyof CheckoutCustomerDetails;
export type CheckoutCustomerInput = Partial<Record<CheckoutCustomerField, unknown>>;

const NAME_ALLOWED_CHARACTERS = /^[\p{L}\p{M}.' -]+$/u;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const GHANA_LOCAL_PHONE = /^0[235]\d{8}$/;
const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;
const LONG_CONSONANT_RUN = /[bcdfghjklmnpqrstvwxyz]{7,}/i;
const REPEATED_CHARACTER = /(.)\1{4,}/i;

export const CHECKOUT_PHONE_PATTERN = '[+0-9() .-]{8,20}';

export function normalizeCustomerName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
}

export function normalizeCustomerEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 220) : '';
}

export function normalizeCustomerPhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return `${hasInternationalPrefix ? '+' : ''}${digits}`.slice(0, 16);
}

export function getCheckoutCustomerErrors(details: CheckoutCustomerInput) {
  const name = normalizeCustomerName(details.name);
  const email = normalizeCustomerEmail(details.email);
  const phone = normalizeCustomerPhone(details.phone);
  const errors: Partial<Record<CheckoutCustomerField, string>> = {};

  if (!name) {
    errors.name = 'Enter your full name.';
  } else if (name.length < 4 || !NAME_ALLOWED_CHARACTERS.test(name) || !/\p{L}/u.test(name)) {
    errors.name = 'Enter a valid full name using letters.';
  } else if (LONG_CONSONANT_RUN.test(name) || REPEATED_CHARACTER.test(name)) {
    errors.name = 'Enter your real full name so the seller can identify you.';
  }

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (email.length > 220 || !EMAIL_FORMAT.test(email)) {
    errors.email = 'Enter a valid email address, including a domain such as name@example.com.';
  }

  if (!phone) {
    errors.phone = 'Enter your phone number.';
  } else if (!GHANA_LOCAL_PHONE.test(phone) && !INTERNATIONAL_PHONE.test(phone)) {
    errors.phone = 'Enter a valid Ghana number (for example 0241234567) or an international number beginning with +.';
  } else if (/^(?:\+?)(\d)\1+$/.test(phone)) {
    errors.phone = 'Enter a valid phone number.';
  }

  return errors;
}

export function validateCheckoutCustomer(details: CheckoutCustomerInput) {
  const customer: CheckoutCustomerDetails = {
    name: normalizeCustomerName(details.name),
    email: normalizeCustomerEmail(details.email),
    phone: normalizeCustomerPhone(details.phone),
  };
  const errors = getCheckoutCustomerErrors(customer);
  const firstError = errors.name || errors.email || errors.phone || '';
  return { customer, errors, firstError, valid: !firstError };
}
