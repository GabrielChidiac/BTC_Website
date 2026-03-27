/**
 * Maps well-known Bitcoin/macro experts to their Twitter/X handles.
 * Used with unavatar.io to fetch profile photos reliably.
 *
 * Values starting with "http" are treated as direct URLs.
 * All other values are X/Twitter handles.
 */
const EXPERT_HANDLES: Record<string, string> = {
  // ─── Bitcoin / Crypto Analysts ──────────────────────────────────────────────
  "Lyn Alden": "LynAldenContact",
  "Willy Woo": "woonomic",
  "Plan B": "100trillionUSD",
  "PlanB": "100trillionUSD",
  "Ben Cowen": "intocryptoverse",
  "Benjamin Cowen": "intocryptoverse",
  "Charles Edwards": "caprioleio",
  "Will Clemente": "WClementeIII",
  "James Check": "_Checkmatey_",
  "Checkmate": "_Checkmatey_",
  "Dylan LeClair": "DylanLeClair_",
  "Nic Carter": "nic__carter",
  "Alex Thorn": "intangiblecoins",
  "Vijay Boyapati": "real_vijay",
  "Tuur Demeester": "TuurDemeester",
  "Eric Wall": "ercwl",
  "Murad Mahmudov": "MustStopMurad",
  "Samson Mow": "Excellion",
  "Adam Back": "adam3us",
  "Jameson Lopp": "lopp",
  "Pierre Rochard": "BitcoinPierre",
  "Preston Pysh": "PrestonPysh",
  "Robert Breedlove": "Breedlove22",
  "Jeff Booth": "JeffBooth",
  "Greg Foss": "FossGregfoss",
  "Dan Held": "danheld",
  "Cory Klippsten": "coryklippsten",
  "Pomp": "APompliano",
  "Anthony Pompliano": "APompliano",
  "Peter McCormack": "PeterMcCormack",
  "Natalie Brunell": "natbrunell",
  "Greg Cipolaro": "GregCipolaro",
  "Ki Young Ju": "ki_young_ju",

  // ─── Macro / TradFi ────────────────────────────────────────────────────────
  "Raoul Pal": "RaoulGMI",
  "Luke Gromen": "LukeGromen",
  "Stanley Druckenmiller": "https://unavatar.io/google/Stanley+Druckenmiller",
  "Paul Tudor Jones": "https://unavatar.io/google/Paul+Tudor+Jones+investor",
  "Arthur Hayes": "CryptoHayes",
  "Jurrien Timmer": "TimmerFidelity",
  "Jim Bianco": "biancoresearch",
  "Mohamed El-Erian": "elerianm",
  "Nouriel Roubini": "Nouriel",
  "Peter Schiff": "PeterSchiff",
  "Peter Brandt": "PeterLBrandt",
  "Zoltan Pozsar": "https://unavatar.io/google/Zoltan+Pozsar",
  "Jeff Gundlach": "https://unavatar.io/google/Jeff+Gundlach",
  "David Rosenberg": "EconguyRosie",
  "Jim Rickards": "JamesGRickards",
  "Danielle DiMartino Booth": "DiMartinoBooth",
  "Brent Johnson": "SantiagoAuFund",
  "Hugh Hendry": "hendry_hugh",
  "Felix Zulauf": "https://unavatar.io/google/Felix+Zulauf+investor",
  "Lawrence Lepard": "LawrenceLepard",

  // ─── CEOs / Institutional ──────────────────────────────────────────────────
  "Michael Saylor": "saylor",
  "Cathie Wood": "CathieDWood",
  "Larry Fink": "https://unavatar.io/google/Larry+Fink+BlackRock",
  "Jack Dorsey": "jack",
  "Brian Armstrong": "brian_armstrong",
  "Jan van Eck": "JanvanEck3",
  "Matt Hougan": "Matt_Hougan",
  "Mark Yusko": "MarkYusko",
  "Jeff Park": "jeff_park82",
  "Michael Novogratz": "novogratz",
  "Barry Silbert": "BarrySilbert",
  "Cameron Winklevoss": "cameron",
  "Tyler Winklevoss": "tyler",
  "Brad Garlinghouse": "bgarlinghouse",
  "Jesse Powell": "jespow",
  "Changpeng Zhao": "cz_binance",
  "CZ": "cz_binance",
  "Paolo Ardoino": "paoloardoino",
  "Jamie Dimon": "https://unavatar.io/google/Jamie+Dimon+JPMorgan",
  "Elon Musk": "elonmusk",

  // ─── Regulators / Policy / Politicians ─────────────────────────────────────
  "Gary Gensler": "https://unavatar.io/google/Gary+Gensler+SEC",
  "Hester Peirce": "HesterPeirce",
  "Cynthia Lummis": "SenLummis",
  "Elizabeth Warren": "SenWarren",
  "Robert Kennedy": "RobertKennedyJr",
  "Robert F. Kennedy": "RobertKennedyJr",
  "Balaji Srinivasan": "balajis",
  "Balaji": "balajis",

  // ─── Bank / Research Analysts ──────────────────────────────────────────────
  "Nikolaos Panigirtzoglou": "https://unavatar.io/google/Nikolaos+Panigirtzoglou+JPMorgan",
  "Tom Lee": "fundstrat",
  "Mike McGlone": "mikemcglone11",
  "Matt Sigel": "https://unavatar.io/google/Matt+Sigel+VanEck",
  "Gautam Chhugani": "https://unavatar.io/google/Gautam+Chhugani+Bernstein",
  "Robert Mitchnick": "https://unavatar.io/google/Robert+Mitchnick+BlackRock",
  "Geoff Kendrick": "https://unavatar.io/google/Geoff+Kendrick+Standard+Chartered",
};

/**
 * Get an ordered array of photo URL candidates for an expert.
 * The component should try each URL in order, falling back on error.
 */
export function getExpertPhotoUrls(
  name: string,
  twitterHandle?: string | null,
): string[] {
  const urls: string[] = [];

  // Helper: append ?fallback=false so unavatar returns 404 instead of a
  // default placeholder image (the smiley face). This lets onError fire.
  const noFallback = (url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}fallback=false`;
  };

  // 1. Static map (exact match)
  const mapped = EXPERT_HANDLES[name];
  if (mapped) {
    urls.push(
      noFallback(
        mapped.startsWith("http") ? mapped : `https://unavatar.io/x/${mapped}`,
      ),
    );
  } else {
    // Partial match
    const lower = name.toLowerCase();
    for (const [key, h] of Object.entries(EXPERT_HANDLES)) {
      if (
        lower.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lower)
      ) {
        urls.push(
          noFallback(
            h.startsWith("http") ? h : `https://unavatar.io/x/${h}`,
          ),
        );
        break;
      }
    }
  }

  // 2. AI-provided twitter handle (if not already covered by static map)
  if (twitterHandle) {
    const handleUrl = noFallback(`https://unavatar.io/x/${twitterHandle}`);
    if (!urls.includes(handleUrl)) {
      urls.push(handleUrl);
    }
  }

  // 3. Unavatar cross-platform name search
  urls.push(noFallback(`https://unavatar.io/${encodeURIComponent(name)}`));

  return urls;
}

/**
 * Get a single photo URL for an expert (legacy compat).
 */
export function getExpertPhoto(name: string): string {
  return getExpertPhotoUrls(name)[0];
}

/**
 * Get initials from an expert name (for fallback avatar).
 */
export function getExpertInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
