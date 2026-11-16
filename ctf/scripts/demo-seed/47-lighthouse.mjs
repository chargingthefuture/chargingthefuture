// LightHouse demo data for the browse list (LH-1) and the "Offer · a place to stay" previews on
// signed-out Today, which read the newest active listings (lib/today/sources-offers.ts, placeOffers).
// Six active places to stay, listed by synthetic hosts nobody can sign in as, in varied cities: a room,
// a couch for a few nights, a shared apartment, a short-term sublet, a camper and a house with a spare
// room. Their update times sit within the last two days so they lead the list; the base listings
// seedDemo.mjs writes for the Request to stay flow are moved a week back so they follow.
// No street address or postal code on any of them.

const id = (n) => `ddd00000-0000-4000-8470-0000000000${n.toString(16).padStart(2, '0')}`;

const HOST_A = 'demo-peer-lighthouse-01';
const HOST_B = 'demo-peer-lighthouse-02';
const HOST_C = 'demo-peer-lighthouse-03';

// [n, host, title, description, type, city, state, country, bedrooms, bathrooms, rent, currency, hoursAgo]
const PLACES = [
  [1, HOST_A, 'A quiet room in a shared house',
    'Furnished room with a lock on the door, a desk and a window onto the yard. Kitchen and laundry are shared with two others.',
    'Room in a house', 'Sacramento', 'CA', 'US', 1, 1, 650, 'USD', 2],
  [2, HOST_B, 'A couch for a few nights',
    'A clean couch, a blanket and a key while you are here. Good for two to five nights while something longer comes together.',
    'Apartment', 'Portland', 'OR', 'US', 1, 1, null, null, 6],
  [3, HOST_C, 'A bedroom in a shared apartment',
    'Second-floor apartment near a bus line, shared with one other person. Quiet after ten, no smoking.',
    'Apartment', 'Toronto', 'ON', 'CA', 2, 1, 900, 'CAD', 11],
  [4, HOST_A, 'Short-term sublet through the end of next month',
    'A studio with its own bathroom and kitchenette while the tenant is away. Furniture and dishes stay.',
    'Apartment', 'Denver', 'CO', 'US', 1, 1, 1100, 'USD', 19],
  [5, HOST_B, 'A camper parked behind the house',
    'Sleeps one, with power from the house and use of the bathroom inside. Can trade for help with the garden.',
    'Camper', 'Austin', 'TX', 'US', 1, 1, null, null, 28],
  [6, HOST_C, 'A spare room in a family house',
    'Upstairs room with its own entrance. Meals are shared on weekends if you want them. Two weeks to three months.',
    'House', 'Columbus', 'OH', 'US', 1, 1, 500, 'USD', 40],
];

export default async function seed(client, ctx) {
  for (const [n, host, title, description, type, city, state, country, beds, baths, rent, currency, hoursAgo] of PLACES) {
    await client.query(
      `INSERT INTO lighthouse_properties
         (id, host_user_id, title, description, property_type, address_line, city, state, country, zip_code,
          bedrooms, bathrooms, monthly_rent, rent_currency, amenities, house_rules, photos,
          is_active, created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, NULL, $6, $7, $8, NULL,
          $9, $10, $11, $12, '["wifi","kitchen"]'::jsonb, '["no-smoking"]'::jsonb, '[]'::jsonb,
          true, $2, $2, NOW() - ($13::int * INTERVAL '1 hour'), NOW() - ($13::int * INTERVAL '1 hour'))
       ON CONFLICT (id) DO UPDATE SET
         host_user_id = EXCLUDED.host_user_id, title = EXCLUDED.title, description = EXCLUDED.description,
         property_type = EXCLUDED.property_type, address_line = NULL, city = EXCLUDED.city,
         state = EXCLUDED.state, country = EXCLUDED.country, zip_code = NULL,
         bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms,
         monthly_rent = EXCLUDED.monthly_rent, rent_currency = EXCLUDED.rent_currency,
         amenities = EXCLUDED.amenities, house_rules = EXCLUDED.house_rules, photos = EXCLUDED.photos,
         is_active = true, created_by_user_id = EXCLUDED.created_by_user_id,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
      [id(n), host, title, description, type, city, state, country, beds, baths, rent, currency, hoursAgo],
    );
  }

  // The base listings carry fixture wording for the Request to stay flow; a week back, they follow
  // these on the browse list and stay off the Today previews.
  const baseHosts = [ctx.HOST, ctx.COUNTERPARTY].filter(Boolean);
  await client.query(
    `UPDATE lighthouse_properties SET updated_at = NOW() - INTERVAL '7 days'
     WHERE host_user_id = ANY($1::text[]) AND description LIKE 'Demo property%'`,
    [baseHosts],
  );
}
