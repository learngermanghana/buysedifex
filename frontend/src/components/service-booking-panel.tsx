'use client';
import './service-booking-panel.css';

type ListingKind = 'service' | 'course';
type Props = {
  productId: string;
  merchantId: string;
  productName: string;
  price?: number | null;
  currency?: string;
  whatsappPhone?: string;
  storeName?: string;
  storeWebsiteUrl?: string;
  listingType?: string;
  itemType?: string;
};

const formatMoney = (value?: number | null, currency = 'GHS') => (typeof value === 'number' ? `${currency.toUpperCase() === 'GHS' ? 'GH₵' : currency.toUpperCase()} ${value.toFixed(2)}` : 'Price confirmed by store');

const resolveListingKind = (input: Pick<Props, 'listingType' | 'itemType'>): ListingKind => {
  const values = [input.listingType, input.itemType].map((value) => (value ?? '').trim().toLowerCase());
  return values.includes('course') ? 'course' : 'service';
};

const isValidHttpUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const channelCopy = (kind: ListingKind, storeName?: string) => {
  const businessLabel = kind === 'course' ? 'school' : 'business';
  const actionNoun = kind === 'course' ? 'registration' : 'booking';
  const websiteButton = kind === 'course' ? 'Visit school website' : 'Visit business website';
  const title = kind === 'course' ? 'Register on the school website' : 'Book on the business website';
  const intro = kind === 'course'
    ? `Visit ${storeName || 'the school'} website, open the registration or courses page, select this course, and complete your registration directly with the school.`
    : `Visit ${storeName || 'the business'} website, open the booking or services page, select this service, and complete your booking directly with the business.`;
  const sedifexNote = kind === 'course'
    ? 'Sedifex Market lists this course for discovery only. Registration and any payment are handled by the school website.'
    : 'Sedifex Market lists this service for discovery only. Booking and any payment are handled by the business website.';
  const steps = kind === 'course'
    ? ['Visit the school website.', 'Open Registration, Courses, or Apply.', 'Select this course.', 'Complete registration directly with the school.']
    : ['Visit the business website.', 'Open Booking, Services, or Appointments.', 'Select this service.', 'Complete booking directly with the business.'];
  return { businessLabel, actionNoun, websiteButton, title, intro, sedifexNote, steps };
};

export function ServiceBookingPanel({ price, currency = 'GHS', whatsappPhone, storeName, storeWebsiteUrl, listingType, itemType }: Props) {
  const listingKind = resolveListingKind({ listingType, itemType });
  const copy = channelCopy(listingKind, storeName);
  const whatsappHref = whatsappPhone ? `https://wa.me/${whatsappPhone.replace(/[^\d]/g, '')}` : '';
  const websiteHref = isValidHttpUrl(storeWebsiteUrl) ? storeWebsiteUrl : '';

  return (
    <aside className="serviceBookingPanel" aria-label={listingKind === 'course' ? 'Course registration options' : 'Service booking options'}>
      <p className="eyebrow">{listingKind === 'course' ? 'Course registration' : 'Booking options'}</p>
      <h3>{copy.title}</h3>
      <p className="productCartPrice">{formatMoney(price, currency)}</p>

      <section className="officialBookingCard" aria-label="Official website booking instructions">
        <p className="officialBookingLead">{copy.intro}</p>
        <p className="sedifexPoweredNote">{copy.sedifexNote}</p>
        <ol className="bookingSteps">
          {copy.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {websiteHref ? (
          <a className="requestButton officialWebsiteButton" href={websiteHref} target="_blank" rel="noopener noreferrer">
            {copy.websiteButton}
          </a>
        ) : (
          <p className="requestFeedback error">This {copy.businessLabel} has not added a website link yet. Contact the {copy.businessLabel} directly to complete your {copy.actionNoun}.</p>
        )}
        <p className="checkoutHint">Sedifex Market does not collect service or course payments on this page.</p>
      </section>

      {whatsappHref ? <a className="secondaryButton fullWidthButton" href={whatsappHref} target="_blank" rel="noopener noreferrer">Enquire on WhatsApp</a> : null}
    </aside>
  );
}
