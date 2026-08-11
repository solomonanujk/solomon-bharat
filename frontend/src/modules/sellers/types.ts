export interface SellerProfile {
  id: string;
  userId: string;
  businessName: string;
  contactName: string;
  phone: string;
  businessAddress: string;
  bankDetails: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSellerProfileInput {
  businessName?: string;
  contactName?: string;
  phone?: string;
  businessAddress?: string;
  bankDetails?: string;
}

export type ApplicationStatus = 'PENDING' | 'MORE_INFO_REQUESTED' | 'APPROVED' | 'REJECTED';

export interface SellerApplication {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessAddress: string;
  message: string | null;
  status: ApplicationStatus;
  rejectionReason: string | null;
  internalNotes: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSafeUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface AdminSellerListRow extends SellerProfile {
  user: AdminSafeUser;
}

export interface SellerApplicationListFilter {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export interface AdminSellerListFilter {
  page?: number;
  limit?: number;
}

/** Response of POST /sellers/applications/{id}/approve — creates the SELLER account. */
export interface SellerApplicationApprovalResult {
  user: AdminSafeUser;
  profile: SellerProfile;
}
