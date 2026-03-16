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
};

export type Ad = {
  id: number;
  title: string;
  category: string;
  price: number;
  university: string;
  description: string;
  status?: "active" | "archived" | "sold";
  contacts: Contacts;
  images: string[];
  createdAt?: string;
  user?: {
    id: number;
    name: string;
    university: string;
    verified?: boolean;
  };
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
  review?: {
    rating: number;
    comment: string;
    createdAt: string;
  } | null;
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
  defaultUniversity: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};
