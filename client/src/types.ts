export type Contacts = {
  phone?: string;
  whatsapp?: string;
  telegram?: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  university: string;
  isVerified?: boolean;
  isAdmin?: boolean;
  balance?: number;
  rank?: string;
  completedOrders?: number;
  skills?: string;
  role?: "seeker" | "employer";
  telegramChatId?: string;
  preferredMicrorayon?: string;
};

export type Ad = {
  id: number;
  title: string;
  category: string;
  price: number;
  university: string;
  description: string;
  status?: "active" | "archived" | "sold";
  employmentType?: string;
  experienceLevel?: string;
  microrayon?: string;
  skills?: string;
  contacts: Contacts;
  images: string[];
  createdAt?: string;
  user?: {
    id: number;
    name: string;
    university: string;
    verified?: boolean;
    role?: string;
  };
};

export type Application = {
  id: number;
  jobId: number;
  coverLetter: string;
  status: "pending" | "viewed" | "accepted" | "rejected";
  createdAt: string;
  applicant?: {
    id: number;
    name: string;
    email: string;
    skills: string;
  };
  job?: {
    id: number;
    title: string;
    category: string;
    salary: number;
    microrayon: string;
    employmentType: string;
    employerName: string;
  };
};

export type AiMatch = {
  id: number;
  title: string;
  category: string;
  salary: number;
  employmentType: string;
  experienceLevel: string;
  microrayon: string;
  employerName: string;
  createdAt: string;
  matchScore: number;
  matchReason: string;
  aiPowered?: boolean;
};

export type AiMatchResult = {
  userSkills: string;
  userMicrorayon?: string;
  aiPowered?: boolean;
  matches: AiMatch[];
};

export type ServiceReview = {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  client: {
    id: number;
    name: string;
  };
};

export type Service = {
  id: number;
  title: string;
  category: string;
  price: number;
  university: string;
  description: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  createdAt?: string;
  images: string[];
  ratingAvg?: number;
  ratingCount?: number;
  reviews?: ServiceReview[];
  user?: {
    id: number;
    name: string;
    university: string;
    verified?: boolean;
  };
};

export type OrderStatus = "pending" | "accepted" | "frozen" | "under_review" | "completed";

export type ServiceOrder = {
  id: number;
  status: OrderStatus;
  paymentStatus?: "unpaid" | "paid";
  paymentPaidAt?: string;
  createdAt: string;
  completedAt?: string;
  role: "client" | "provider";
  service: {
    id: number;
    title: string;
    category: string;
    price: number;
  };
  client: {
    id: number;
    name: string;
  };
  provider: {
    id: number;
    name: string;
  };
  /** @deprecated use clientReview */
  review?: { rating: number; comment: string; createdAt: string } | null;
  clientReview?: { rating: number; comment: string; createdAt: string } | null;
  providerReview?: { rating: number; comment: string; createdAt: string } | null;
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
};

export type ServiceMessage = {
  id: number;
  orderId: number;
  senderId: number;
  senderName: string;
  message: string;
  isRead?: boolean;
  createdAt: string;
};

export type AdMessage = {
  id: number;
  adId: number;
  senderId: number;
  senderName: string;
  message: string;
  isRead?: boolean;
  createdAt: string;
};

export type AdChatResponse = {
  adId: number;
  adTitle: string;
  ownerId: number;
  messages: AdMessage[];
};

export type MetaResponse = {
  categories: string[];
  employmentTypes: string[];
  experienceLevels: string[];
  microrayons: string[];
  defaultUniversity: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type Badge = {
  badge: string;
  earnedAt: string;
};

export type NewsItem = {
  id: number;
  title: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
  fetchedAt: string;
};

export type Favorite = {
  id: number;
  adId?: number;
  serviceId?: number;
  createdAt: string;
  ad?: { title: string; price: number; category: string; status: string; image: string } | null;
  service?: { title: string; price: number; category: string; image: string } | null;
};

export type Report = {
  id: number;
  reporterName: string;
  targetType: "ad" | "service" | "user";
  targetId: number;
  reason: string;
  comment: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
};

export type Conversation = {
  id: number;
  peer: { id: number; name: string };
  ad: { id: number; title: string; price: number };
  lastMessage?: { body: string; createdAt: string; senderId: number } | null;
  updatedAt?: string;
  unreadCount?: number;
};

export type ConversationMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  body: string;
  isMine?: boolean;
  createdAt: string;
};

export type WorkItem = {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
};

export type PublicUserProfile = PublicProfile;

export type PublicProfile = {
  id: number;
  name: string;
  university: string;
  isVerified: boolean;
  joinedAt: string;
  stats: { completedOrders: number; ratingAvg: number | null; ratingCount: number };
  badges: Badge[];
  ads: Array<{ id: number; title: string; category: string; price: number; status: string; createdAt: string; image: string }>;
  services: Array<{ id: number; title: string; category: string; price: number; createdAt: string; image: string; ratingAvg: number | null; ratingCount: number }>;
  reviews: Array<{ rating: number; comment: string; createdAt: string; clientName: string }>;
};
