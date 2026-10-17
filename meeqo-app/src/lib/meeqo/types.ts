import type { AppTheme } from "@/lib/meeqo/theme";

export type Profile = {
  ageConfirmed: boolean;
  notifyEmail: boolean;
  userId: string;
  displayName: string;
  bio: string;
  intent: string;
  openTo: string;
  areas: string[];
  seeking: string[];
  traits: string[];
  requireTraits: string[];
  city: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  isOrganizer: boolean;
  organizerName: string;
  bookingMode: "request" | "instant";
  identityConfirmed: boolean;
  trustedLabel: string;
  birthYear: number | null;
  defaultVisibility: "all" | "friends" | "community" | "events" | "age";
  audienceIds: string[];
  onboardingDone: boolean;
  notifyPush: boolean;
  avatarUrl: string;
  badges: string[];
  theme: AppTheme | null;
};

export type ActivityCard = {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  hostBadges: string[];
  hostOrganizer: boolean;
  durationMin: number;
  area: "meetup" | "business" | "event";
  /** First names of the viewer's friends who are going. Filled by the feed only. */
  friendsGoing: string[];
  matchesInterest: boolean;
  /** Why the meetup is high up when sorted by fit. Empty otherwise. */
  fitReason: string;
  title: string;
  description: string;
  category: string;
  traits: string[];
  hostTraits: string[];
  intent: "date" | "friends" | "both";
  placeName: string;
  city: string;
  lat: number;
  lng: number;
  startsAt: string;
  spots: number;
  spotsLeft: number;
  imageUrl: string;
  bookingMode: "request" | "instant";
  communityId: string | null;
  audienceIds: string[];
  visibility: "all" | "friends" | "community" | "events" | "age";
  hostBirthYear: number | null;
  publicPlace: boolean;
  cancelled: boolean;
  km: number | null;
  myStatus: "pending" | "accepted" | "declined" | "waitlist" | null;
  isHost: boolean;
};

export type FeedResult = {
  items: ActivityCard[];
  total: number;
  missed: number;
  hasLocation: boolean;
  around?: string;
  nextDay: string | null;
  nextCount: number;
  againTitle: string | null;
};

export type RequestItem = {
  id: string;
  activityId: string;
  activityTitle: string;
  personName: string;
  status: string;
  createdAt: string;
  mood: string;
  /** Past accepted meetups, how many of them the person showed up to, and how often with this host. */
  past: number;
  came: number;
  withMe: number;
  direction: "in" | "out";
};

export type ChatThread = {
  activityId: string;
  title: string;
  startsAt: string;
  lastBody: string;
  peerName: string;
  peerAvatar: string;
  group: boolean;
  kind: "activity" | "ad";
  unread: boolean;
};

export type AdChat = {
  title: string;
  price: string;
  city: string;
  category: string;
  seller: boolean;
  peerId: string;
  peerName: string;
  peerAvatar: string;
  messages: ChatMessage[];
};

export type CircleMember = {
  id: string;
  name: string;
  avatar: string;
  meetings: number;
};

export type SafetyView = {
  name: string;
  title: string;
  startsAt: string;
  placeName: string;
  city: string;
  checkedInAt: string | null;
  safeAt: string | null;
  state: "waiting" | "ok" | "late" | "safe";
  minutesLate: number;
};

export type ChatPerson = {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  me: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  body: string;
  createdAt: string;
  mine: boolean;
  attachment?: { name: string; type: string; size: number } | null;
};

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type CommunityCard = {
  id: string;
  name: string;
  topic: string;
  city: string;
  description: string;
  members: number;
  activityCount: number;
  joined: boolean;
};

export type GoingPerson = {
  id: string;
  name: string;
  avatar: string;
  me: boolean;
};

export type ActivityDetail = {
  activity: ActivityCard;
  /** Median-ish reply time of the host in hours, only with at least three answered requests. */
  hostReplyHours: number | null;
  going: GoingPerson[];
  needsConfirm: boolean;
  /** Place in the queue when the viewer is on the waitlist, counted from 1. */
  waitlistPosition: number | null;
  waitlistCount: number;
  checkedIn: boolean;
  safe: boolean;
  rated: boolean;
  mutual: boolean;
  iWantAgain: boolean;
  hidden: boolean;
};

export type PublicProfile = {
  userId: string;
  displayName: string;
  bio: string;
  intent: string;
  openTo: string;
  areas: string[];
  city: string;
  badges: string[];
  avatarUrl: string;
  friend: "none" | "out" | "in" | "friends";
  favorite: boolean;
};

export type FriendPerson = {
  userId: string;
  displayName: string;
  city: string;
};

export type Classified = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  category: string;
  city: string;
  price: string;
  traits: string[];
  createdAt: string;
  mine: boolean;
  /** For the author: how many people wrote. For others: the open thread, if any. */
  interested: number;
  myThread: string | null;
};

export type CategoryHit = {
  parent: string;
  name: string;
  count: number;
  promoted: boolean;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  communityId: string | null;
  body: string;
  audience: "date" | "friends" | "both";
  visibility: "all" | "friends" | "community" | "events" | "age";
  requireTraits: string[];
  createdAt: string;
  mine: boolean;
};

export type BlockedUser = {
  id: string;
  name: string;
  avatar: string;
};

export type InviteView = {
  activityId: string;
  title: string;
  startsAt: string;
  placeName: string;
  city: string;
  hostName: string;
  spotsLeft: number;
  imageUrl: string;
  origin: string;
};

export type AdminReport = {
  id: string;
  kind: string;
  targetId: string;
  targetLabel: string;
  ownerId: string;
  ownerName: string;
  ownerSuspended: boolean;
  reason: string;
  note: string;
  reporterName: string;
  createdAt: string;
  status: "open" | "done";
  action: string;
  sameTarget: number;
};

export type AdminStats = {
  users: number;
  newUsers7: number;
  onboarded: number;
  activities7: number;
  requests7: number;
  messages7: number;
  answeredRate: number | null;
  acceptRate: number | null;
  unanswered24h: number;
  openReports: number;
  errors24: number;
  errorList: { path: string; message: string; createdAt: string }[];
};

export type MyData = {
  filename: string;
  json: string;
};

export type NextUp = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  placeName: string;
  city: string;
  lat: number;
  lng: number;
  hosting: boolean;
  group: boolean;
  /** The chat opens with the first accepted guest. */
  chatOpen: boolean;
  checkedIn: boolean;
  safe: boolean;
  canCheckIn: boolean;
  hasSafetyLink: boolean;
};

export type PollOption = { at: string; votes: number };

export type PollView = {
  id: string;
  question: string;
  options: PollOption[];
  mine: number | null;
  closed: boolean;
  createdAt: string;
  creatorName: string;
  canClose: boolean;
};

export type RideView = {
  id: string;
  driverId: string;
  driverName: string;
  seats: number;
  free: number;
  origin: string;
  mine: boolean;
  iRide: boolean;
  riders: string[];
};

export type VenueHit = { name: string; kind: string; meters: number };
