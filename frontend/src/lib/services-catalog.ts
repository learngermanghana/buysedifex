export type ServiceItem = {
  slug: string;
  name: string;
  summary: string;
  description: string;
};

export const serviceCatalog: ServiceItem[] = [
  {
    slug: 'delivery-assist',
    name: 'Delivery Assist',
    summary: 'Connect with providers that coordinate local delivery for product orders.',
    description:
      'Need delivery support for purchased items? Use Sedifex to connect with businesses that coordinate pick-up and doorstep drop-off in your city.',
  },
  {
    slug: 'home-maintenance',
    name: 'Home Maintenance',
    summary: 'Book trusted providers for maintenance and repair support.',
    description:
      'Browse verified service providers for cleaning, repairs, and routine maintenance. Send a quote request and compare response times.',
  },
  {
    slug: 'beauty-and-wellness',
    name: 'Beauty & Wellness',
    summary: 'Book beauty and wellness sessions with local providers.',
    description:
      'Explore salons and personal care providers on Sedifex. Chat directly to confirm timing, pricing, and service packages before booking.',
  },
];

export const getServiceBySlug = (slug: string) => serviceCatalog.find((service) => service.slug === slug) ?? null;
