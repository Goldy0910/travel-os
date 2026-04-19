-- Popular Indian domestic destinations for create-trip (alongside international `travel_places`).

insert into public.travel_places (slug, primary_label, subtitle, visa_note, tags, icon_key, sort_order, canonical_location)
values
  (
    'goa-india',
    'Goa',
    null,
    null,
    array['Beach','Budget-friendly']::text[],
    'beach',
    21,
    'Goa, India'
  ),
  (
    'manali-india',
    'Manali',
    'Himachal Pradesh',
    null,
    array['Hill station','Adventure','Budget-friendly']::text[],
    'nature',
    22,
    'Manali, India'
  ),
  (
    'rajasthan-india',
    'Rajasthan',
    'Jaipur · Udaipur · Jodhpur',
    null,
    array['Culture','Spiritual']::text[],
    'heritage',
    23,
    'Rajasthan, India'
  ),
  (
    'ladakh-india',
    'Ladakh',
    'Jammu & Kashmir',
    null,
    array['Adventure','Nature','Hill station']::text[],
    'nature',
    24,
    'Ladakh, India'
  ),
  (
    'kerala-india',
    'Kerala',
    'Munnar · Alleppey · Kovalam',
    null,
    array['Nature','Beach','Culture']::text[],
    'beach',
    25,
    'Kerala, India'
  ),
  (
    'rishikesh-india',
    'Rishikesh',
    'Uttarakhand',
    null,
    array['Adventure','Spiritual','Budget-friendly']::text[],
    'nature',
    26,
    'Rishikesh, India'
  ),
  (
    'andaman-islands-india',
    'Andaman Islands',
    'Andaman & Nicobar',
    null,
    array['Beach','Nature','Adventure']::text[],
    'beach',
    27,
    'Andaman Islands, India'
  ),
  (
    'shimla-india',
    'Shimla',
    'Himachal Pradesh',
    null,
    array['Hill station','Budget-friendly']::text[],
    'nature',
    28,
    'Shimla, India'
  ),
  (
    'coorg-india',
    'Coorg',
    'Karnataka',
    null,
    array['Nature','Hill station','Budget-friendly']::text[],
    'nature',
    29,
    'Coorg, India'
  ),
  (
    'varanasi-india',
    'Varanasi',
    'Uttar Pradesh',
    null,
    array['Spiritual','Culture']::text[],
    'heritage',
    30,
    'Varanasi, India'
  ),
  (
    'spiti-valley-india',
    'Spiti Valley',
    'Himachal Pradesh',
    null,
    array['Adventure','Nature','Hill station']::text[],
    'nature',
    31,
    'Spiti Valley, India'
  ),
  (
    'hampi-india',
    'Hampi',
    'Karnataka',
    null,
    array['Culture','Adventure','Budget-friendly']::text[],
    'culture',
    32,
    'Hampi, India'
  ),
  (
    'mussoorie-india',
    'Mussoorie',
    'Uttarakhand',
    null,
    array['Hill station','Budget-friendly']::text[],
    'nature',
    33,
    'Mussoorie, India'
  ),
  (
    'pondicherry-india',
    'Pondicherry',
    'Tamil Nadu',
    null,
    array['Beach','Culture','Budget-friendly']::text[],
    'beach',
    34,
    'Pondicherry, India'
  ),
  (
    'meghalaya-india',
    'Meghalaya',
    'Shillong · Cherrapunji · Dawki',
    null,
    array['Nature','Adventure']::text[],
    'nature',
    35,
    'Meghalaya, India'
  ),
  (
    'ooty-india',
    'Ooty',
    'Tamil Nadu',
    null,
    array['Hill station','Nature','Budget-friendly']::text[],
    'nature',
    36,
    'Ooty, India'
  ),
  (
    'agra-india',
    'Agra',
    'Uttar Pradesh',
    null,
    array['Culture','Spiritual']::text[],
    'heritage',
    37,
    'Agra, India'
  ),
  (
    'mumbai-india',
    'Mumbai',
    'Maharashtra',
    null,
    array['Culture','Beach']::text[],
    'city',
    38,
    'Mumbai, India'
  ),
  (
    'darjeeling-india',
    'Darjeeling',
    'West Bengal',
    null,
    array['Hill station','Nature','Culture']::text[],
    'nature',
    39,
    'Darjeeling, India'
  ),
  (
    'lakshadweep-india',
    'Lakshadweep',
    'Lakshadweep Islands',
    null,
    array['Beach','Nature','Adventure']::text[],
    'island',
    40,
    'Lakshadweep, India'
  )
on conflict (slug) do nothing;
