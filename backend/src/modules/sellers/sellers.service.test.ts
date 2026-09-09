import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, SellerApplication, SellerApplicationStatus, User, UserStatus } from '@prisma/client';
import { SellersRepository } from './sellers.repository';
import { SellersService } from './sellers.service';

vi.mock('../../providers/mail', () => ({
  mailProvider: { sendMail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../utils/auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../notifications/notifications.service', () => ({
  notificationsService: {
    notifySellerApplicationApproved: vi.fn().mockResolvedValue(undefined),
  },
}));

function buildApplication(overrides: Partial<SellerApplication> = {}): SellerApplication {
  return {
    id: 'app-1',
    businessName: 'Jaipur Handicrafts',
    contactName: 'Asha Sharma',
    email: 'asha@jaipurhandicrafts.example',
    phone: '+911234567890',
    businessAddress: 'Jaipur, Rajasthan',
    message: null,
    status: SellerApplicationStatus.PENDING,
    rejectionReason: null,
    internalNotes: null,
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'asha@jaipurhandicrafts.example',
    passwordHash: 'hash',
    role: Role.SELLER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): SellersRepository {
  return {
    createApplication: vi.fn(),
    findApplicationById: vi.fn(),
    findLatestApplicationByEmail: vi.fn(),
    findApplications: vi.fn(),
    updateApplication: vi.fn(),
    findUserByEmail: vi.fn(),
    createSellerUserAndProfile: vi.fn(),
    findSellerProfileByUserId: vi.fn(),
    findSellerProfileById: vi.fn(),
    updateSellerProfile: vi.fn(),
    findSellers: vi.fn(),
    findSellerWithUserById: vi.fn(),
    findPlatformSettingValue: vi.fn(),
    upsertPlatformSetting: vi.fn(),
    createHouseSellerUserAndProfile: vi.fn(),
  } as unknown as SellersRepository;
}

describe('SellersService', () => {
  let repo: SellersRepository;
  let service: SellersService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new SellersService(repo);
  });

  describe('submitApplication', () => {
    it('rejects when an account already exists for the email', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());

      await expect(
        service.submitApplication({
          businessName: 'X',
          contactName: 'Y',
          email: 'asha@jaipurhandicrafts.example',
          phone: '123',
          businessAddress: 'Jaipur',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repo.createApplication).not.toHaveBeenCalled();
    });

    it('rejects a duplicate application while one is still under review', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );

      await expect(
        service.submitApplication({
          businessName: 'X',
          contactName: 'Y',
          email: 'asha@jaipurhandicrafts.example',
          phone: '123',
          businessAddress: 'Jaipur',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('allows a fresh application if the previous one was rejected', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.findLatestApplicationByEmail).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.REJECTED }),
      );
      vi.mocked(repo.createApplication).mockResolvedValue(buildApplication());

      await service.submitApplication({
        businessName: 'X',
        contactName: 'Y',
        email: 'asha@jaipurhandicrafts.example',
        phone: '123',
        businessAddress: 'Jaipur',
      });

      expect(repo.createApplication).toHaveBeenCalledTimes(1);
    });
  });

  describe('approveApplication', () => {
    it('rejects approving an application that was already rejected', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.REJECTED }),
      );

      await expect(service.approveApplication('app-1', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.createSellerUserAndProfile).not.toHaveBeenCalled();
    });

    it('rejects approving if an account was created for this email in the meantime', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication());
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());

      await expect(service.approveApplication('app-1', 'admin-1')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('creates the SELLER account and marks the application approved', async () => {
      const application = buildApplication();
      vi.mocked(repo.findApplicationById).mockResolvedValue(application);
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.createSellerUserAndProfile).mockResolvedValue({
        user: buildUser(),
        profile: {
          id: 'profile-1',
          userId: 'user-1',
          applicationId: 'app-1',
          businessName: application.businessName,
          contactName: application.contactName,
          phone: application.phone,
          businessAddress: application.businessAddress,
          bankDetails: null,
          notificationPrefs: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      });

      const result = await service.approveApplication('app-1', 'admin-1');

      expect(repo.updateApplication).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ status: SellerApplicationStatus.APPROVED, reviewedById: 'admin-1' }),
      );
      expect(result.user.role).toBe(Role.SELLER);
    });
  });

  describe('rejectApplication / requestMoreInfo on closed applications', () => {
    it('rejects rejecting an application that is already approved', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.APPROVED }),
      );

      await expect(service.rejectApplication('app-1', 'not a fit', 'admin-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('allows requesting more info on a pending application', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(buildApplication());
      vi.mocked(repo.updateApplication).mockResolvedValue(
        buildApplication({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );

      const result = await service.requestMoreInfo('app-1', 'Please share GST certificate', 'admin-1');

      expect(result.status).toBe(SellerApplicationStatus.MORE_INFO_REQUESTED);
      expect(repo.updateApplication).toHaveBeenCalledWith(
        'app-1',
        expect.objectContaining({ status: SellerApplicationStatus.MORE_INFO_REQUESTED }),
      );
    });
  });

  describe('addInternalNote', () => {
    it('appends a timestamped note to any existing internal notes', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(
        buildApplication({ internalNotes: 'earlier note' }),
      );
      vi.mocked(repo.updateApplication).mockResolvedValue(buildApplication());

      await service.addInternalNote('app-1', 'called applicant, awaiting reply');

      const call = vi.mocked(repo.updateApplication).mock.calls[0][1];
      expect(call.internalNotes).toContain('earlier note');
      expect(call.internalNotes).toContain('called applicant, awaiting reply');
    });
  });

  describe('listSellers / getSellerDetailForAdmin', () => {
    const sellerWithUser = () => ({
      id: 'profile-1',
      userId: 'user-1',
      applicationId: null,
      businessName: 'Jaipur Handicrafts',
      contactName: 'Asha Sharma',
      phone: '123',
      businessAddress: 'Jaipur',
      bankDetails: null,
      notificationPrefs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      user: {
        id: 'user-1',
        email: 'asha@example.com',
        passwordHash: 'super-secret-hash',
        role: 'SELLER',
        status: 'ACTIVE',
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    it('listSellers never leaks passwordHash via the nested user object', async () => {
      vi.mocked(repo.findSellers).mockResolvedValue({ data: [sellerWithUser()], total: 1 } as never);

      const { data } = await service.listSellers({ page: 1, limit: 20 });

      expect(data[0].user).not.toHaveProperty('passwordHash');
    });

    it('getSellerDetailForAdmin throws 404 for a seller that does not exist', async () => {
      vi.mocked(repo.findSellerWithUserById).mockResolvedValue(null);

      await expect(service.getSellerDetailForAdmin('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('getSellerDetailForAdmin never leaks passwordHash', async () => {
      vi.mocked(repo.findSellerWithUserById).mockResolvedValue(sellerWithUser() as never);

      const result = await service.getSellerDetailForAdmin('profile-1');

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('own profile', () => {
    it('getMyProfile throws 404 when no seller profile exists for the user', async () => {
      vi.mocked(repo.findSellerProfileByUserId).mockResolvedValue(null);

      await expect(service.getMyProfile('user-1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('updateMyProfile resolves the profile then updates it', async () => {
      vi.mocked(repo.findSellerProfileByUserId).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        applicationId: null,
        businessName: 'Jaipur Handicrafts',
        contactName: 'Asha Sharma',
        phone: '123',
        businessAddress: 'Jaipur',
        bankDetails: null,
        notificationPrefs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      vi.mocked(repo.updateSellerProfile).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        applicationId: null,
        businessName: 'Jaipur Handicrafts',
        contactName: 'Asha Sharma',
        phone: '123',
        businessAddress: 'Jaipur',
        bankDetails: 'HDFC Bank',
        notificationPrefs: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = await service.updateMyProfile('user-1', { bankDetails: 'HDFC Bank' });

      expect(repo.updateSellerProfile).toHaveBeenCalledWith('profile-1', { bankDetails: 'HDFC Bank' });
      expect(result.bankDetails).toBe('HDFC Bank');
    });
  });

  describe('listApplications / getApplicationDetail', () => {
    it('listApplications passes the filter and pagination through to the repository', async () => {
      vi.mocked(repo.findApplications).mockResolvedValue({ data: [], total: 0 });

      await service.listApplications({ status: SellerApplicationStatus.PENDING }, { page: 1, limit: 20 });

      expect(repo.findApplications).toHaveBeenCalledWith(
        { status: SellerApplicationStatus.PENDING },
        { page: 1, limit: 20 },
      );
    });

    it('getApplicationDetail throws 404 for an application that does not exist', async () => {
      vi.mocked(repo.findApplicationById).mockResolvedValue(null);

      await expect(service.getApplicationDetail('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getOrCreateHouseSellerProfile', () => {
    it('returns the cached id without creating anything when already provisioned', async () => {
      vi.mocked(repo.findPlatformSettingValue).mockResolvedValue({ sellerId: 'house-profile-1' });

      const id = await service.getOrCreateHouseSellerProfile();

      expect(id).toBe('house-profile-1');
      expect(repo.createHouseSellerUserAndProfile).not.toHaveBeenCalled();
    });

    it('provisions the house seller once and caches its id when not yet created', async () => {
      vi.mocked(repo.findPlatformSettingValue).mockResolvedValue(null);
      vi.mocked(repo.createHouseSellerUserAndProfile).mockResolvedValue({
        user: buildUser({ id: 'house-user-1', email: 'house@solomonbharat.internal' }),
        profile: {
          id: 'house-profile-1',
          userId: 'house-user-1',
          applicationId: null,
          businessName: 'Solomon Bharat',
          contactName: 'Solomon Bharat',
          phone: 'N/A',
          businessAddress: 'N/A',
          bankDetails: null,
          notificationPrefs: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      });

      const id = await service.getOrCreateHouseSellerProfile();

      expect(id).toBe('house-profile-1');
      expect(repo.createHouseSellerUserAndProfile).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'house@solomonbharat.internal', businessName: 'Solomon Bharat' }),
      );
      expect(repo.upsertPlatformSetting).toHaveBeenCalledWith('house_seller_profile_id', {
        sellerId: 'house-profile-1',
      });
    });
  });
});
