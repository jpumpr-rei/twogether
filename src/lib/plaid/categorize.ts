// Merchant name patterns → our category names (lowercase, must match DB)
const MERCHANT_MAP: [RegExp, string][] = [
  // Groceries (check before generic food)
  [/whole foods|trader joe|kroger|safeway|publix|aldi|sprouts|wegmans|albertsons|stop.*shop|food.*lion|giant food|meijer|h-e-b|\bheb\b|harris teeter|vons|ralphs|tom thumb|winn.?dixie|piggly/i, "groceries"],
  // Food & Drink
  [/starbucks|dunkin|peet|mcdonald|chipotle|chick.fil|subway|wendy|taco bell|burger king|domino|papa john|pizza|doordash|grubhub|uber.*eat|door.*dash|postmates|seamless|instacart/i, "food & drink"],
  // Gas
  [/\bshell\b|bp |chevron|exxon|mobil|arco|valero|speedway|circle k|wawa|pilot.*travel|flying j|marathon|sunoco|\b76\b gas|casey/i, "gas"],
  // Rideshare (uber before uber eats)
  [/\buber\b(?!.*eat)|lyft/i, "rideshare"],
  // Subscriptions
  [/netflix|spotify|hulu|disney\+|apple.*tv|apple.*one|paramount\+|peacock|youtube.*premium|amazon.*prime|adobe|microsoft 365|google.*one|dropbox|notion|figma|github.*pro|1password|lastpass|nordvpn/i, "subscriptions"],
  // Health & Beauty
  [/cvs|walgreens|rite aid|duane reade|sephora|ulta|planet fitness|la fitness|equinox|crunch.*gym|gold.*gym|anytime fitness|ymca|orange theory/i, "health & beauty"],
  // Travel
  [/delta|united.*airline|southwest|american.*airline|jetblue|spirit.*airline|frontier.*airline|alaska.*air|british.*airway|lufthansa|airbnb|vrbo|marriott|hilton|hyatt|ihg|radisson|expedia|booking\.com|hotels\.com|priceline/i, "travel"],
  // Parking & Transit
  [/parkwhiz|spothero|\bmta\b|\bcta\b|\bbart\b|\bwmata\b|clipper.*card|metro.*card|presto.*card|transit|\bpath\b train/i, "parking & transit"],
  // Car maintenance
  [/jiffy lube|firestone|pep boys|midas|mavis|goodyear|valvoline|oil change|autozone|o'reilly auto|advance auto/i, "car maintenance"],
  // Home Improvement
  [/home depot|lowe'?s|ace hardware|menards|true value/i, "home improvement"],
  // Utilities & Insurance
  [/verizon|at&t|t.mobile|sprint|comcast|spectrum|xfinity|pg&e|con ed|geico|allstate|state farm|progressive|liberty mutual|farmers.*insurance|nationwide.*insurance/i, "utilities & insurance"],
  // Entertainment
  [/regal|amc theatre|cinemark|ticketmaster|stubhub|fandango|\bsteam\b|playstation|xbox|nintendo|gamestop/i, "entertainment"],
  // Household Supplies (broad retailers last to avoid false matches)
  [/amazon|target|\bwalmart\b|costco|bj'?s wholesale|sam'?s club/i, "household supplies"],
];

export function categorizeByMerchant(
  merchantName: string | null,
  categoryMap: Map<string, string>
): string | null {
  if (!merchantName) return null;
  for (const [pattern, name] of MERCHANT_MAP) {
    if (pattern.test(merchantName)) return categoryMap.get(name) ?? null;
  }
  return null;
}

export function mapPlaidCategory(
  tx: { personal_finance_category?: { primary: string; detailed: string } | null },
  categoryMap: Map<string, string>
): string | null {
  const primary = (tx.personal_finance_category?.primary ?? "").toUpperCase();
  const detailed = (tx.personal_finance_category?.detailed ?? "").toUpperCase();

  if (detailed.includes("GROCERY") || detailed.includes("SUPERMARKET"))
    return categoryMap.get("groceries") ?? null;
  if (primary === "FOOD_AND_DRINK")
    return categoryMap.get("food & drink") ?? null;
  if (detailed.includes("GAS_STATION"))
    return categoryMap.get("gas") ?? null;
  if (detailed.includes("RIDESHARE") || detailed.includes("TAXI"))
    return categoryMap.get("rideshare") ?? null;
  if (detailed.includes("PARKING") || detailed.includes("TRANSIT"))
    return categoryMap.get("parking & transit") ?? null;
  if (detailed.includes("AUTO_MAINTENANCE") || detailed.includes("AUTO_REPAIR"))
    return categoryMap.get("car maintenance") ?? null;
  if (primary === "TRAVEL")
    return categoryMap.get("travel") ?? null;
  if (primary === "ENTERTAINMENT")
    return categoryMap.get("entertainment") ?? null;
  if (primary === "RENT_AND_UTILITIES")
    return categoryMap.get("utilities & insurance") ?? null;
  if (primary === "MEDICAL" || primary === "PERSONAL_CARE")
    return categoryMap.get("health & beauty") ?? null;
  if (primary === "HOME_IMPROVEMENT")
    return categoryMap.get("home improvement") ?? null;
  if (detailed.includes("SUBSCRIPTION"))
    return categoryMap.get("subscriptions") ?? null;
  if (primary === "GENERAL_MERCHANDISE")
    return categoryMap.get("household supplies") ?? null;
  return null;
}

// Try merchant name first (more specific), fall back to Plaid's category signal
export function bestCategory(
  tx: {
    merchant_name?: string | null;
    personal_finance_category?: { primary: string; detailed: string } | null;
  },
  categoryMap: Map<string, string>
): string | null {
  return (
    categorizeByMerchant(tx.merchant_name ?? null, categoryMap) ??
    mapPlaidCategory(tx, categoryMap)
  );
}
