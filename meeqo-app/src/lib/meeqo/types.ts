import type { AppTheme } from "@/lib/meeqo/theme";

export type Profile = {
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
  myStatus: "pending" | "accepted" | "declined" | null;
  isHost: boolean;
};

export type FeedResult = {
  items: ActivityCard[];
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

export type ActivityDetail = {
  activity: ActivityCard;
  checkedIn: boolean;
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
