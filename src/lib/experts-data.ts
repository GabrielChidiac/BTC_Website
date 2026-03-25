export interface ExpertChannel {
  name: string;
  channelId: string;
  description: string;
  youtubeUrl: string;
  focus: string; // Short tag: "Macro", "Technical", "Education", etc.
}

export const EXPERT_CHANNELS: ExpertChannel[] = [
  {
    name: "Bitcoin Magazine",
    channelId: "UCni7PAlyNS0_12H-26DJJ3w",
    description:
      "The oldest and most established Bitcoin-only publication. Covers breaking news, in-depth analysis, mining developments, and major Bitcoin events. Known for hosting the annual Bitcoin Conference.",
    youtubeUrl: "https://www.youtube.com/@BitcoinMagazine",
    focus: "News & Events",
  },
  {
    name: "What Bitcoin Did",
    channelId: "UCLnQ34ZBSjy2JQjeRudFEDw",
    description:
      "Hosted by Peter McCormack. Long-form interviews with Bitcoin developers, economists, entrepreneurs, and thought leaders. Great for understanding the big picture — monetary policy, geopolitics, and Bitcoin's role in the future of finance.",
    youtubeUrl: "https://www.youtube.com/@WhatBitcoinDid",
    focus: "Interviews & Macro",
  },
  {
    name: "Simply Bitcoin",
    channelId: "UCGVqexnG_bVqLae9mmFq6OA",
    description:
      "Daily Bitcoin news show that breaks down the day's most important stories in an accessible, entertaining format. Strong focus on on-chain data, whale movements, and market sentiment. Bitcoin-only, no altcoins.",
    youtubeUrl: "https://www.youtube.com/@SimplyBitcoin",
    focus: "Daily News",
  },
  {
    name: "Preston Pysh",
    channelId: "UCKEBnE2fUHOjJKmwXNxOMFg",
    description:
      "Deep analysis of Bitcoin from a traditional finance and value investing perspective. Preston connects Bitcoin to macroeconomics, bond markets, and monetary policy. Excellent for understanding how Bitcoin fits into the broader financial system.",
    youtubeUrl: "https://www.youtube.com/@PrestonPysh",
    focus: "Finance & Macro",
  },
  {
    name: "Unchained",
    channelId: "UCWnPjmqvljcafA0z2U1fwKQ",
    description:
      "Unchained provides educational content focused on Bitcoin security, self-custody, and long-term holding strategies. Their content helps Bitcoin holders understand how to properly secure and manage their holdings.",
    youtubeUrl: "https://www.youtube.com/@Unchained",
    focus: "Security & Custody",
  },
];
