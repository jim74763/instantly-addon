export type SpamListTargetType = "ip" | "domain" | "mixed";

export type SpamListDefinition = {
  name: string;
  zone: string | null;
  targetType: SpamListTargetType;
  requiresConfiguration?: boolean;
};

function envZone(value: string | undefined) {
  const zone = value?.trim().replace(/\.+$/, "");
  return zone || null;
}

function abusixZone(list: "black" | "dblack" | "exploit") {
  const key = process.env.ABUSIX_DNSBL_KEY?.trim();
  return key ? `${key}.${list}.mail.abusix.zone` : null;
}

export const spamLists: SpamListDefinition[] = [
  { name: "BARRACUDA", zone: "b.barracudacentral.org", targetType: "ip" },
  {
    name: "ivmURI",
    zone: envZone(process.env.INVALUEMENT_IVM_URI_ZONE),
    targetType: "domain",
    requiresConfiguration: true,
  },
  {
    name: "SEM FRESH",
    zone: "fresh.spameatingmonkey.net",
    targetType: "domain",
  },
  { name: "SEM URI", zone: "uribl.spameatingmonkey.net", targetType: "domain" },
  {
    name: "SEM URIRED",
    zone: "urired.spameatingmonkey.net",
    targetType: "domain",
  },
  {
    name: "SORBS RHSBL BADCONF",
    zone: "badconf.rhsbl.sorbs.net",
    targetType: "domain",
  },
  {
    name: "SORBS RHSBL NOMAIL",
    zone: "nomail.rhsbl.sorbs.net",
    targetType: "domain",
  },
  { name: "Spamhaus DBL", zone: "dbl.spamhaus.org", targetType: "domain" },
  { name: "SURBL multi", zone: "multi.surbl.org", targetType: "domain" },
  { name: "0SPAM", zone: "bl.0spam.org", targetType: "ip" },
  { name: "0SPAM RBL", zone: "rbl.0spam.org", targetType: "ip" },
  {
    name: "Abusix Mail Intelligence Blacklist",
    zone: abusixZone("black"),
    targetType: "ip",
    requiresConfiguration: true,
  },
  {
    name: "Abusix Mail Intelligence Domain Blacklist",
    zone: abusixZone("dblack"),
    targetType: "mixed",
    requiresConfiguration: true,
  },
  {
    name: "Abusix Mail Intelligence Exploit list",
    zone: abusixZone("exploit"),
    targetType: "ip",
    requiresConfiguration: true,
  },
  {
    name: "Anonmails DNSBL",
    zone: "spam.dnsbl.anonmails.de",
    targetType: "ip",
  },
  { name: "BACKSCATTERER", zone: "ips.backscatterer.org", targetType: "ip" },
  { name: "BLOCKLIST.DE", zone: "bl.blocklist.de", targetType: "ip" },
  { name: "CALIVENT", zone: "dnsbl.calivent.com.pe", targetType: "ip" },
  { name: "CYMRU BOGONS", zone: "bogons.cymru.com", targetType: "ip" },
  { name: "DAN TOR", zone: "tor.dan.me.uk", targetType: "ip" },
  { name: "DAN TOREXIT", zone: "torexit.dan.me.uk", targetType: "ip" },
  { name: "DRMX", zone: "bl.drmx.org", targetType: "ip" },
  { name: "DRONE BL", zone: "dnsbl.dronebl.org", targetType: "ip" },
  { name: "FABELSOURCES", zone: "spamsources.fabel.dk", targetType: "ip" },
  { name: "HIL", zone: "hil.habeas.com", targetType: "ip" },
  { name: "HIL2", zone: "hil2.habeas.com", targetType: "ip" },
  {
    name: "Hostkarma Black",
    zone: "black.junkemailfilter.com",
    targetType: "mixed",
  },
  { name: "IBM DNS Blacklist", zone: "dnsbl.cobion.com", targetType: "ip" },
  { name: "ICMFORBIDDEN", zone: "forbidden.icm.edu.pl", targetType: "ip" },
  { name: "IMP SPAM", zone: "spamrbl.imp.ch", targetType: "ip" },
  { name: "IMP WORM", zone: "wormrbl.imp.ch", targetType: "ip" },
  { name: "INTERSERVER", zone: "rbl.interserver.net", targetType: "ip" },
  {
    name: "ivmSIP",
    zone: envZone(process.env.INVALUEMENT_IVM_SIP_ZONE),
    targetType: "ip",
    requiresConfiguration: true,
  },
  {
    name: "ivmSIP24",
    zone: envZone(process.env.INVALUEMENT_IVM_SIP24_ZONE),
    targetType: "ip",
    requiresConfiguration: true,
  },
  { name: "JIPPG", zone: "mail-abuse.blacklist.jippg.org", targetType: "ip" },
  { name: "KEMPTBL", zone: "dnsbl.kempt.net", targetType: "ip" },
  { name: "Konstant", zone: "bl.konstant.no", targetType: "ip" },
  { name: "LASHBACK", zone: "ubl.unsubscore.com", targetType: "ip" },
  { name: "MAILSPIKE BL", zone: "bl.mailspike.net", targetType: "ip" },
  { name: "MAILSPIKE Z", zone: "z.mailspike.net", targetType: "ip" },
  { name: "MSRBL Phishing", zone: "phishing.rbl.msrbl.net", targetType: "ip" },
  { name: "MSRBL Spam", zone: "spam.rbl.msrbl.net", targetType: "ip" },
  { name: "NETHERRELAYS", zone: "relays.nether.net", targetType: "ip" },
  { name: "NETHERUNSURE", zone: "unsure.nether.net", targetType: "ip" },
  { name: "NoSolicitado", zone: "bl.nosolicitado.org", targetType: "ip" },
  { name: "PSBL", zone: "psbl.surriel.com", targetType: "ip" },
  { name: "RATS Dyna", zone: "dyna.spamrats.com", targetType: "ip" },
  { name: "RATS NoPtr", zone: "noptr.spamrats.com", targetType: "ip" },
  { name: "RATS Spam", zone: "spam.spamrats.com", targetType: "ip" },
  { name: "RBL JP", zone: "virus.rbl.jp", targetType: "ip" },
  { name: "s5h.net", zone: "all.s5h.net", targetType: "ip" },
  { name: "SCHULTE", zone: "rbl.schulte.org", targetType: "ip" },
  {
    name: "SEM BACKSCATTER",
    zone: "backscatter.spameatingmonkey.net",
    targetType: "ip",
  },
  { name: "SEM BLACK", zone: "bl.spameatingmonkey.net", targetType: "ip" },
  {
    name: "Sender Score Reputation Network",
    zone: "score.senderscore.com",
    targetType: "ip",
  },
  { name: "SERVICESNET", zone: "korea.services.net", targetType: "ip" },
  { name: "SPAMCOP", zone: "bl.spamcop.net", targetType: "ip" },
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org", targetType: "ip" },
  { name: "SPFBL DNSBL", zone: "dnsbl.spfbl.net", targetType: "mixed" },
  { name: "Suomispam Reputation", zone: "bl.suomispam.net", targetType: "ip" },
  { name: "SWINOG", zone: "dnsrbl.swinog.ch", targetType: "ip" },
  { name: "TRIUMF", zone: "rbl2.triumf.ca", targetType: "ip" },
  { name: "TRUNCATE", zone: "truncate.gbudb.net", targetType: "ip" },
  { name: "UCEPROTECTL1", zone: "dnsbl-1.uceprotect.net", targetType: "ip" },
  { name: "UCEPROTECTL2", zone: "dnsbl-2.uceprotect.net", targetType: "ip" },
  { name: "UCEPROTECTL3", zone: "dnsbl-3.uceprotect.net", targetType: "ip" },
  {
    name: "Woodys SMTP Blacklist",
    zone: "blacklist.woody.ch",
    targetType: "ip",
  },
  { name: "ZapBL", zone: "dnsbl.zapbl.net", targetType: "ip" },
];
